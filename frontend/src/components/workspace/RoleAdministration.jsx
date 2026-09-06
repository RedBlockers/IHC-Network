import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import { PERMISSION_GROUPS, PERMISSION_STATES } from "./permissionDefinitions.js";
import RoleTemplatePicker from "./RoleTemplatePicker.jsx";

export default function RoleAdministration({ guild }) {
    const [roles, setRoles] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const draftRef = useRef(null);
    const [members, setMembers] = useState(guild.members || []);
    const [filter, setFilter] = useState("");
    const [tab, setTab] = useState("permissions");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [templatesOpen, setTemplatesOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/roles`).then(({ roles: loaded }) => {
            if (cancelled) return;
            setRoles(loaded);
            const initial = loaded.find((role) => !role.isManaged) ?? loaded[0] ?? null;
            setSelectedId(initial?.roleId ?? null);
            const nextDraft = initial ? { ...initial, permissions: { ...initial.permissions } } : null;
            draftRef.current = nextDraft;
            setDraft(nextDraft);
        }).catch((err) => setError(err.message));
        return () => { cancelled = true; };
    }, [guild.guildId]);

    const selected = roles.find((role) => role.roleId === selectedId) ?? null;

    const visibleRoles = useMemo(() => roles.filter((role) => role.name.toLowerCase().includes(filter.toLowerCase())), [roles, filter]);

    function replaceDraft(next) {
        draftRef.current = next;
        setDraft(next);
    }

    function patchDraft(fields) {
        replaceDraft({ ...draftRef.current, ...fields });
    }

    async function createRole() {
        setBusy(true);
        setError(null);
        try {
            const { role } = await api(`/guilds/${guild.guildId}/roles`, {
                method: "POST",
                body: { name: `Nouveau rôle ${roles.length + 1}`, color: "#8895A5", iconEmoji: "✨", permissions: {} },
            });
            setRoles((current) => [role, ...current]);
            setSelectedId(role.roleId);
            replaceDraft({ ...role, permissions: { ...role.permissions } });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Création impossible.");
        } finally {
            setBusy(false);
        }
    }

    async function saveRole() {
        const currentDraft = draftRef.current;
        if (!currentDraft || currentDraft.isManaged) return;
        setBusy(true);
        setError(null);
        try {
            const { role } = await api(`/guilds/${guild.guildId}/roles/${currentDraft.roleId}`, {
                method: "PATCH",
                body: {
                    name: currentDraft.name,
                    iconEmoji: currentDraft.iconEmoji || null,
                    color: currentDraft.color,
                    mentionable: currentDraft.mentionable,
                    permissions: currentDraft.permissions,
                },
            });
            setRoles((current) => current.map((item) => item.roleId === role.roleId ? role : item));
            replaceDraft({ ...role, permissions: { ...role.permissions } });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
        } finally {
            setBusy(false);
        }
    }

    async function deleteRole() {
        if (!draft || draft.isManaged || draft.isDefault) return;
        setBusy(true);
        try {
            await api(`/guilds/${guild.guildId}/roles/${draft.roleId}`, { method: "DELETE" });
            const next = roles.filter((role) => role.roleId !== draft.roleId);
            setRoles(next);
            const initial = next.find((role) => !role.isManaged) ?? next[0] ?? null;
            setSelectedId(initial?.roleId ?? null);
            replaceDraft(initial ? { ...initial, permissions: { ...initial.permissions } } : null);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Suppression impossible.");
        } finally {
            setBusy(false);
        }
    }

    async function toggleMember(member, enabled) {
        const method = enabled ? "PUT" : "DELETE";
        const delta = enabled ? 1 : -1;
        setMembers((current) => current.map((item) => {
            if (item.userId !== member.userId) return item;
            const assigned = item.roles || [];
            return {
                ...item,
                roles: enabled
                    ? [...assigned.filter((role) => role.roleId !== selected.roleId), selected]
                    : assigned.filter((role) => role.roleId !== selected.roleId),
            };
        }));
        setRoles((current) => current.map((role) => role.roleId === selected.roleId ? { ...role, memberCount: role.memberCount + delta } : role));
        patchDraft({ memberCount: draftRef.current.memberCount + delta });
        try {
            const { roles: assigned } = await api(`/guilds/${guild.guildId}/members/${member.userId}/roles/${selected.roleId}`, { method });
            setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, roles: assigned } : item));
        } catch (err) {
            setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, roles: member.roles || [] } : item));
            setRoles((current) => current.map((role) => role.roleId === selected.roleId ? { ...role, memberCount: role.memberCount - delta } : role));
            patchDraft({ memberCount: draftRef.current.memberCount - delta });
            setError(err instanceof ApiError ? err.message : "Attribution impossible.");
        }
    }

    if (!draft) return <div className="admin-loading">Chargement des rôles…</div>;
    const changed = selected && JSON.stringify(draft) !== JSON.stringify(selected);

    function adoptRole(role) {
        setRoles((current) => [role, ...current]);
        setSelectedId(role.roleId);
        replaceDraft({ ...role, permissions: { ...role.permissions } });
    }

    return (
        <div className="role-admin">
            <RoleTemplatePicker
                guild={guild}
                open={templatesOpen}
                onClose={() => setTemplatesOpen(false)}
                onCreated={adoptRole}
            />
            <aside className="role-list-panel">
                <div className="role-list-title">
                    <strong>Rôles · {roles.length}</strong>
                    <span className="role-list-actions">
                        <button type="button" onClick={() => setTemplatesOpen(true)} disabled={busy}>Modèle…</button>
                        <button type="button" onClick={createRole} disabled={busy}>+ Vierge</button>
                    </span>
                </div>
                <label className="role-filter"><Icon name="search" size={14} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrer les rôles…" /></label>
                <div className="role-list">
                    {visibleRoles.map((role) => <button type="button" key={role.roleId} className={role.roleId === selectedId ? "is-active" : ""} onClick={() => { setSelectedId(role.roleId); replaceDraft({ ...role, permissions: { ...role.permissions } }); }}>
                        <span className="role-color" style={{ background: role.color }} />
                        <span>{role.iconEmoji} {role.name}</span><small>{role.memberCount}</small>
                    </button>)}
                </div>
                <p>Les rôles les plus hauts contrôlent uniquement ceux placés sous eux.</p>
            </aside>

            <section className="role-editor">
                <header className="role-editor-head">
                    <label className="role-emoji"><span>Icône</span><input value={draft.iconEmoji || ""} onChange={({ target: { value } }) => patchDraft({ iconEmoji: value })} maxLength={32} disabled={draft.isManaged} /></label>
                    <label className="role-name"><span>Nom du rôle</span><input value={draft.name} onChange={({ target: { value } }) => patchDraft({ name: value })} maxLength={50} disabled={draft.isManaged} /></label>
                    <label className="role-color-input" title="Couleur du rôle"><input type="color" value={draft.color} onChange={({ target: { value } }) => patchDraft({ color: value })} disabled={draft.isManaged} /><span style={{ background: draft.color }} /></label>
                    <div className="role-editor-tabs">
                        <button type="button" className={tab === "permissions" ? "is-active" : ""} onClick={() => setTab("permissions")}>Permissions</button>
                        <button type="button" className={tab === "members" ? "is-active" : ""} onClick={() => setTab("members")}>Membres · {draft.memberCount}</button>
                    </div>
                </header>

                {tab === "permissions" ? <div className="permission-groups">
                    <label className="role-mentionable"><input type="checkbox" checked={draft.mentionable} onChange={({ target: { checked } }) => patchDraft({ mentionable: checked })} disabled={draft.isManaged} /><span>Ce rôle peut être mentionné</span></label>
                    {PERMISSION_GROUPS.map(([group, permissions]) => <section key={group} className="permission-group">
                        <h3>{group}</h3>
                        {permissions.map(([key, label, detail]) => {
                            const value = draft.permissions[key] || "inherit";
                            return <div className="permission-row" key={key}>
                                <div><strong>{label}</strong><span>{detail}</span></div>
                                <div className="permission-segmented" aria-label={label}>
                                    {PERMISSION_STATES.map(([state, text]) => <button type="button" key={state} className={value === state ? `is-${state}` : ""} onClick={() => patchDraft({ permissions: { ...draftRef.current.permissions, [key]: state } })} disabled={draft.isManaged}>{text}</button>)}
                                </div>
                            </div>;
                        })}
                    </section>)}
                </div> : <div className="role-members">
                    {members.map((member) => {
                        const assigned = member.roles?.some((role) => role.roleId === selected.roleId) ?? false;
                        return <label key={member.userId}><Avatar user={member} size={34} /><span><strong>{member.displayName || member.handle}</strong><small>@{member.handle}</small></span><input type="checkbox" checked={assigned} onChange={(event) => toggleMember(member, event.target.checked)} disabled={draft.isManaged || draft.isDefault} /></label>;
                    })}
                </div>}

                {error && <p className="auth-error" role="alert">{error}</p>}
                <div className="role-savebar">
                    {!draft.isManaged && !draft.isDefault && <button type="button" className="btn btn-danger" onClick={deleteRole} disabled={busy}>Supprimer</button>}
                    <span>{changed ? "Modifications non enregistrées" : "Toutes les modifications sont enregistrées"}</span>
                    <button type="button" className="btn btn-ghost" onClick={() => replaceDraft({ ...selected, permissions: { ...selected.permissions } })} disabled={!changed || busy}>Annuler</button>
                    <button type="button" className="btn btn-accent" onClick={saveRole} disabled={!changed || busy || draft.isManaged}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
                </div>
            </section>
        </div>
    );
}
