import { useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import Icon from "../ui/Icon.jsx";

export default function GuildSuspension({ guild, onChanged }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const suspended = Boolean(guild.suspendedAt);
    const tooShort = reason.trim().length < 10;

    async function act(call) {
        setBusy(true);
        setError(null);
        try {
            const { guild: updated } = await call();
            setReason("");
            onChanged?.(updated);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "L’opération n’a pas abouti.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="server-admin-content">
            <p className="settings-p">
                Une suspension gèle les écritures — messages, salons, rôles, invitations. Rien n’est
                supprimé, l’historique reste lisible, et vous rouvrez quand vous voulez.
            </p>

            {error && <p className="form-error" role="alert">{error}</p>}

            {suspended ? (
                <section className="suspension-state" role="status">
                    <span className="suspension-mark" aria-hidden="true"><Icon name="alert" size={18} /></span>
                    <div>
                        <strong>Communauté suspendue depuis le {fullTimestamp(guild.suspendedAt)}</strong>
                        {guild.suspendedReason && <p>{guild.suspendedReason}</p>}
                    </div>
                    <button type="button" className="btn btn-accent" disabled={busy} onClick={() => act(() => api(`/guilds/${guild.guildId}/resume`, { method: "POST" }))}>
                        {busy ? "Réouverture…" : "Rouvrir la communauté"}
                    </button>
                </section>
            ) : (
                <div className="server-admin-fields">
                    <label className="field">
                        <span className="field-label">Motif, montré à tous les membres</span>
                        <textarea
                            className="field-input field-textarea"
                            rows={3}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Un raid est en cours, nous rouvrons dès qu’il est traité."
                            maxLength={300}
                        />
                        <span className="field-hint">
                            Sans explication, le gel se lit comme une panne et chacun écrit au support.
                        </span>
                    </label>

                    <div className="modal-actions">
                        {tooShort && (
                            <p className="poll-blocking" role="status">
                                Expliquez la suspension en une phrase.
                            </p>
                        )}
                        <button
                            type="button"
                            className="btn btn-danger"
                            disabled={tooShort || busy}
                            onClick={() =>
                                act(() =>
                                    api(`/guilds/${guild.guildId}/suspend`, {
                                        method: "POST",
                                        body: { reason: reason.trim() },
                                    })
                                )
                            }
                        >
                            {busy ? "Suspension…" : "Suspendre la communauté"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
