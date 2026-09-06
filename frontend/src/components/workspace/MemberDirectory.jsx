import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import { fullTimestamp } from "../../lib/format.js";

const SORTS = [
    { id: "joined", label: "Arrivée récente" },
    { id: "oldest", label: "Ancienneté" },
    { id: "name", label: "Nom" },
];

export default function MemberDirectory({ guild, onMemberClick }) {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [roleId, setRoleId] = useState("");
    const [sort, setSort] = useState("joined");
    const [page, setPage] = useState(0);
    const [result, setResult] = useState(null);
    const [loadedKey, setLoadedKey] = useState(null);

    const key = `${debounced}|${roleId}|${sort}|${page}`;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounced(search.trim());
            setPage(0);
        }, 220);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams({ sort, page: String(page), limit: "40" });
        if (debounced) params.set("search", debounced);
        if (roleId) params.set("roleId", roleId);

        api(`/guilds/${guild.guildId}/members?${params}`)
            .then((data) => {
                if (!cancelled) setResult(data);
            })
            .finally(() => {
                if (!cancelled) setLoadedKey(key);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, debounced, roleId, sort, page, key]);

    const loading = loadedKey !== key;
    const members = result?.members ?? [];
    const roles = (guild.roles ?? []).filter((role) => !role.isDefault);

    return (
        <div className="server-admin-content member-directory">
            <div className="directory-controls">
                <label className="directory-search">
                    <Icon name="search" size={15} />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Rechercher un membre"
                        aria-label="Rechercher un membre"
                    />
                </label>

                {roles.length > 0 && (
                    <label className="directory-filter">
                        <span className="sr-only">Filtrer par rôle</span>
                        <select value={roleId} onChange={(event) => { setRoleId(event.target.value); setPage(0); }}>
                            <option value="">Tous les rôles</option>
                            {roles.map((role) => (
                                <option key={role.roleId} value={role.roleId}>{role.name}</option>
                            ))}
                        </select>
                    </label>
                )}

                <label className="directory-filter">
                    <span className="sr-only">Trier</span>
                    <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}>
                        {SORTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                </label>
            </div>

            {result && (
                <p className="directory-count" role="status">
                    {debounced || roleId
                        ? `${members.length}${result.hasMore ? "+" : ""} résultat${members.length > 1 ? "s" : ""} sur ${result.total} membre${result.total > 1 ? "s" : ""}`
                        : `${result.total} membre${result.total > 1 ? "s" : ""}`}
                </p>
            )}

            {loading && (
                <div className="directory-skeleton" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((index) => (
                        <div className="directory-row is-loading" key={index}>
                            <span className="skeleton-dot" />
                            <span className="skeleton-lines"><i /><i /></span>
                        </div>
                    ))}
                </div>
            )}

            {!loading && members.length === 0 && (
                <p className="admin-empty">
                    {debounced || roleId
                        ? "Aucun membre ne correspond à cette recherche."
                        : "Cette communauté n’a pas encore de membres."}
                </p>
            )}

            {!loading && members.length > 0 && (
                <ul className="directory-list">
                    {members.map((member) => (
                        <li key={member.userId}>
                            <button type="button" className="directory-row" onClick={() => onMemberClick?.(member)}>
                                <Avatar user={member} size={36} />
                                <span className="directory-identity">
                                    <strong>{member.displayName || member.handle}</strong>
                                    <small>@{member.handle}</small>
                                </span>
                                <span className="directory-roles">
                                    {member.roles.filter((role) => !role.isDefault).slice(0, 3).map((role) => (
                                        <span className="directory-role" key={role.roleId} style={role.color ? { "--role": role.color } : undefined}>
                                            {role.iconEmoji} {role.name}
                                        </span>
                                    ))}
                                </span>
                                <span className="directory-joined">{fullTimestamp(member.joinedAt)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {(page > 0 || result?.hasMore) && (
                <div className="directory-pager">
                    <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 0))} disabled={page === 0}>
                        Précédent
                    </button>
                    <span>Page {page + 1}</span>
                    <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!result?.hasMore}>
                        Suivant
                    </button>
                </div>
            )}
        </div>
    );
}
