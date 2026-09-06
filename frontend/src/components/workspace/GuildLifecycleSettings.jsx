import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.js";

export default function GuildLifecycleSettings({ guild, onTransferred, onDeleted }) {
    const [search, setSearch] = useState("");
    const [members, setMembers] = useState([]);
    const [target, setTarget] = useState("");
    const [transferName, setTransferName] = useState("");
    const [deleteName, setDeleteName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const query = new URLSearchParams({ search, limit: "40", page: "0", sort: "name" });
            api(`/guilds/${guild.guildId}/members?${query}`, { signal: controller.signal })
                .then((result) => setMembers(result.members || []))
                .catch((err) => {
                    if (!controller.signal.aborted)
                        setError(err instanceof ApiError ? err.message : "Membres indisponibles.");
                });
        }, 200);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [guild.guildId, search]);

    async function act(kind, event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (kind === "transfer") {
                const result = await api(`/guilds/${guild.guildId}/transfer`, {
                    method: "POST",
                    body: { userId: Number(target), confirm: transferName },
                });
                onTransferred({ ...guild, ownerId: result.ownerId });
            } else {
                await api(`/guilds/${guild.guildId}`, { method: "DELETE", body: { confirm: deleteName } });
                onDeleted(guild.guildId);
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "L’opération n’a pas abouti.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="server-admin-content">
            <section className="settings-section">
                <h3 className="settings-h">Transférer la communauté</h3>
                <p className="settings-p">
                    Le membre choisi devient propriétaire. Vous conservez un rôle d’administrateur.
                </p>
                <form className="profile-settings" onSubmit={(event) => act("transfer", event)}>
                    <label className="field">
                        <span className="field-label">Rechercher le prochain propriétaire</span>
                        <input
                            className="field-input"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            type="search"
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Nouveau propriétaire</span>
                        <select
                            className="field-input"
                            aria-label="Nouveau propriétaire"
                            value={target}
                            onChange={(event) => setTarget(event.target.value)}
                            required
                        >
                            <option value="">Choisir un membre</option>
                            {members
                                .filter((member) => Number(member.userId) !== Number(guild.ownerId))
                                .map((member) => (
                                    <option key={member.userId} value={member.userId}>
                                        {member.displayName || member.handle} · @{member.handle}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">Nom de la communauté pour confirmer le transfert</span>
                        <input
                            className="field-input"
                            value={transferName}
                            onChange={(event) => setTransferName(event.target.value)}
                            autoComplete="off"
                            required
                        />
                    </label>
                    <button className="btn btn-secondary" disabled={busy || !target || transferName !== guild.name}>
                        Transférer la propriété
                    </button>
                </form>
            </section>
            <section className="settings-section">
                <h3 className="settings-h">Supprimer la communauté</h3>
                <p className="settings-p">
                    Cette action supprime définitivement les salons et les messages pour tous les membres. Elle ne peut
                    pas être annulée.
                </p>
                <form className="profile-settings" onSubmit={(event) => act("delete", event)}>
                    <label className="field">
                        <span className="field-label">Nom de la communauté pour confirmer la suppression</span>
                        <input
                            className="field-input"
                            value={deleteName}
                            onChange={(event) => setDeleteName(event.target.value)}
                            autoComplete="off"
                            required
                        />
                    </label>
                    <button className="btn btn-danger" disabled={busy || deleteName !== guild.name}>
                        Supprimer définitivement la communauté
                    </button>
                </form>
            </section>
            {error && (
                <p className="auth-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
