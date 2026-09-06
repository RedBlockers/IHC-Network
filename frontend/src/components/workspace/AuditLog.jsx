import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";
import AsyncSection from "../ui/AsyncSection.jsx";

const LABELS = {
    "member.kick": "Exclusion",
    "member.ban": "Bannissement",
    "member.timeout": "Réduction au silence",
    "member.note": "Note privée ajoutée",
    "sanction.revoke": "Sanction levée",
    "sanction.appeal": "Contestation déposée",
};

const FILTERS = [
    { id: "", label: "Tout" },
    { id: "member.kick", label: "Exclusions" },
    { id: "member.ban", label: "Bannissements" },
    { id: "member.timeout", label: "Silences" },
    { id: "sanction.appeal", label: "Contestations" },
];

export default function AuditLog({ guild }) {
    const [entries, setEntries] = useState(null);
    const [filter, setFilter] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const query = filter ? `?limit=100&action=${encodeURIComponent(filter)}` : "?limit=100";
        api(`/guilds/${guild.guildId}/audit${query}`)
            .then((result) => !cancelled && setEntries(result.entries))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Journal indisponible."));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, filter]);

    return (
        <section className="audit-log">
            <header>
                <p className="settings-p">Chaque action de modération y laisse une trace, avec son motif et son auteur.</p>
                <div className="audit-filters" role="tablist">
                    {FILTERS.map((item) => (
                        <button
                            key={item.id || "all"}
                            type="button"
                            role="tab"
                            aria-selected={filter === item.id}
                            className={filter === item.id ? "is-on" : ""}
                            onClick={() => setFilter(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </header>

            <AsyncSection
                status={error ? "failed" : entries === null ? "loading" : "ready"}
                count={entries?.length ?? 0}
                error={error}
                empty="Aucune action enregistrée pour ce filtre."
                announce={(n) => `${n} action${n > 1 ? "s" : ""} de modération.`}
            >
            <ul className="audit-entries">
                {entries?.map((entry) => (
                    <li key={entry.entryId}>
                        <Avatar user={entry.actor ?? { handle: "?" }} size={28} />
                        <div>
                            <strong>{LABELS[entry.action] ?? entry.action}</strong>
                            <small>
                                {entry.actor ? entry.actor.displayName || entry.actor.handle : "compte supprimé"}
                                {entry.targetId ? ` · cible ${entry.targetId}` : ""}
                            </small>
                            {entry.reason && <p>{entry.reason}</p>}
                        </div>
                        <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("fr-FR")}</time>
                    </li>
                ))}
            </ul>
            </AsyncSection>
        </section>
    );
}
