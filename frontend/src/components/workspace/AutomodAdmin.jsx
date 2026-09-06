import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";

export default function AutomodAdmin({ guild }) {
    const [config, setConfig] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/automod`)
            .then(({ automod }) => !cancelled && setConfig(automod))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Filtres indisponibles."));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId]);

    if (!config) return <p className="popout-role-empty">{error ?? "Chargement des filtres…"}</p>;

    const patch = (next) => setConfig((current) => ({ ...current, ...next }));

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const { automod } = await api(`/guilds/${guild.guildId}/automod`, { method: "PUT", body: config });
            setConfig(automod);
            setNotice("Filtres enregistrés.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Filtres non enregistrés.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="audit-log" onSubmit={save}>
            <p className="settings-p">
                Chaque déclenchement nomme sa règle au membre et laisse une entrée au journal d’audit. Aucun filtre
                n’agit en silence.
            </p>

            <ul className="settings-toggles">
                <li>
                    <label>
                        <input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                        <span>
                            <strong>Activer les filtres</strong>
                            <small>Sans cela, rien de ce qui suit ne s’applique.</small>
                        </span>
                    </label>
                </li>
            </ul>

            <section className="settings-section">
                <h3 className="settings-h">Mesure</h3>
                <div className="segmented" role="radiogroup" aria-label="Mesure appliquée">
                    {[
                        ["flag", "Signaler", "Le message part, l’équipe est prévenue."],
                        ["delete", "Refuser", "Le message n’est pas publié, l’auteur reçoit la raison."],
                    ].map(([id, label, note]) => (
                        <button key={id} type="button" role="radio" aria-checked={config.action === id} className={config.action === id ? "is-on" : ""} onClick={() => patch({ action: id })}>
                            {label}
                            <small>{note}</small>
                        </button>
                    ))}
                </div>
            </section>

            <label className="field">
                <span className="field-label">Mots filtrés — un par ligne</span>
                <textarea className="field-input field-textarea" rows={4} maxLength={4000} value={config.blockedWords} onChange={(e) => patch({ blockedWords: e.target.value })} />
            </label>

            <label className="field">
                <span className="field-label">Domaines filtrés — un par ligne, sous-domaines compris</span>
                <textarea className="field-input field-textarea" rows={3} maxLength={4000} value={config.blockedDomains} onChange={(e) => patch({ blockedDomains: e.target.value })} />
            </label>

            <section className="settings-section">
                <h3 className="settings-h">Débit de messages</h3>
                <p className="settings-p">Zéro désactive la règle.</p>
                <div className="automod-pair">
                    <label className="field"><span className="field-label">Messages</span><input className="field-input" type="number" min={0} max={100} value={config.spamMessages} onChange={(e) => patch({ spamMessages: Number(e.target.value) })} /></label>
                    <label className="field"><span className="field-label">Par (secondes)</span><input className="field-input" type="number" min={0} max={3600} value={config.spamSeconds} onChange={(e) => patch({ spamSeconds: Number(e.target.value) })} /></label>
                </div>
            </section>

            <section className="settings-section">
                <h3 className="settings-h">Arrivées massives</h3>
                <p className="settings-p">Signale une vague d’inscriptions à l’équipe. Zéro désactive la règle.</p>
                <div className="automod-pair">
                    <label className="field"><span className="field-label">Arrivées</span><input className="field-input" type="number" min={0} max={500} value={config.raidJoins} onChange={(e) => patch({ raidJoins: Number(e.target.value) })} /></label>
                    <label className="field"><span className="field-label">Par (secondes)</span><input className="field-input" type="number" min={0} max={3600} value={config.raidSeconds} onChange={(e) => patch({ raidSeconds: Number(e.target.value) })} /></label>
                </div>
            </section>

            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="settings-notice" role="status">{notice}</p>}

            <div className="modal-actions">
                <button className="btn btn-accent" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les filtres"}</button>
            </div>
        </form>
    );
}
