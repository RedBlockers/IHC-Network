import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { localDateTime } from "../../lib/calendar.js";
import Modal from "../ui/Modal.jsx";

export default function ChannelSettings({ channel, onUpdated, onDeleted }) {
    const [draft, setDraft] = useState({
        name: channel.name,
        description: channel.description || "",
        expiresAt: localDateTime(channel.expiresAt),
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [removing, setRemoving] = useState(false);
    const [confirm, setConfirm] = useState("");
    async function act(run) {
        if (busy) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await run();
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : "L’opération n’a pas abouti.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <details className="channel-details">
            <summary>Informations du salon</summary>
            <form
                className="form workflow-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    act(async () => {
                        const body = {
                            name: draft.name.trim(),
                            description: draft.description.trim(),
                            ...(channel.type === "ephemeral"
                                ? { expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null }
                                : {}),
                        };
                        const result = await api(`/channels/${channel.channelId}`, { method: "PATCH", body });
                        onUpdated?.(result.channel);
                        setNotice("Informations enregistrées.");
                    });
                }}
            >
                <label className="field">
                    <span className="field-label">Nom du salon</span>
                    <input
                        className="field-input"
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                        maxLength={50}
                        required
                    />
                </label>
                <label className="field">
                    <span className="field-label">Description du salon</span>
                    <textarea
                        className="field-input field-textarea"
                        value={draft.description}
                        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                        rows={2}
                        maxLength={200}
                    />
                </label>
                {channel.type === "ephemeral" && (
                    <label className="field">
                        <span className="field-label">Fermeture automatique</span>
                        <input
                            type="datetime-local"
                            className="field-input"
                            value={draft.expiresAt}
                            onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
                        />
                        <small>
                            Après cette date, l’historique reste consultable. Retirez la date pour garder le salon
                            ouvert.
                        </small>
                    </label>
                )}
                {error && !removing && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                {notice && (
                    <p className="workflow-notice" role="status">
                        {notice}
                    </p>
                )}
                <div className="workflow-actions">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                            setRemoving(true);
                            setError(null);
                        }}
                    >
                        Supprimer le salon
                    </button>
                    <button className="btn btn-accent" disabled={busy || !draft.name.trim()}>
                        Enregistrer les informations
                    </button>
                </div>
            </form>
            <Modal
                open={removing}
                onClose={() => !busy && setRemoving(false)}
                title="Supprimer ce salon ?"
                size="dialog"
            >
                <form
                    className="form workflow-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        act(async () => {
                            await api(`/channels/${channel.channelId}`, { method: "DELETE", body: { confirm } });
                            setRemoving(false);
                            onDeleted?.(channel.channelId);
                        });
                    }}
                >
                    <p>Les messages, fichiers et contenus de ce salon seront supprimés. Cette action est définitive.</p>
                    <label className="field">
                        <span className="field-label">Recopiez {channel.name} pour confirmer</span>
                        <input
                            className="field-input"
                            value={confirm}
                            onChange={(event) => setConfirm(event.target.value)}
                            autoComplete="off"
                            required
                            data-autofocus
                        />
                    </label>
                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => setRemoving(false)}
                        >
                            Conserver le salon
                        </button>
                        <button className="btn btn-danger" disabled={busy || confirm !== channel.name}>
                            Supprimer définitivement
                        </button>
                    </div>
                </form>
            </Modal>
        </details>
    );
}
