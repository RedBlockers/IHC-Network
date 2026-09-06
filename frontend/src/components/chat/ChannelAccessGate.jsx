import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import BoardState from "./BoardState.jsx";

export default function ChannelAccessGate({ channel, children }) {
    const access = useChannelResource(
        channel.channelId,
        channel.type === "gated" ? "access" : null,
        "channel:access channel:permissions"
    );
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [reviewing, setReviewing] = useState(false);
    if (channel.type !== "gated") return children;
    const pending = access.data?.requests.filter((request) => request.status === "pending") ?? [];

    async function act(path, body, method = "POST") {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await api(`/channels/${channel.channelId}/access${path}`, { method, body });
            access.reload();
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : "L’accès n’a pas pu être mis à jour. Réessayez.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="gated-shell">
            <BoardState loading={access.loading} error={access.error} onRetry={access.reload}>
                {access.data?.canReview && (
                    <div className="gate-toolbar">
                        <span>
                            Accès sur validation
                            {pending.length
                                ? ` · ${pending.length} demande${pending.length > 1 ? "s" : ""} en attente`
                                : ""}
                        </span>
                        <button type="button" className="btn btn-ghost" onClick={() => setReviewing(true)}>
                            Gérer les accès
                        </button>
                    </div>
                )}
                {access.data?.allowed ? (
                    children
                ) : (
                    <section className="gate-request workflow-empty" aria-label="Demander l’accès au salon">
                        <Icon name="lock" size={32} />
                        <h2>{channel.name}</h2>
                        <p>L’équipe doit valider votre accès avant que vous puissiez lire ce salon et participer.</p>
                        {access.data?.request?.status === "pending" ? (
                            <p className="workflow-notice" role="status">
                                Votre demande a été envoyée. Cet écran se mettra à jour dès sa validation.
                            </p>
                        ) : (
                            <form
                                className="form workflow-form"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    act("", { reason });
                                }}
                            >
                                {access.data?.request?.status === "declined" && (
                                    <p role="status">
                                        Votre demande précédente n’a pas été acceptée. Vous pouvez en envoyer une
                                        nouvelle avec davantage de précisions.
                                    </p>
                                )}
                                <label className="field">
                                    <span className="field-label">Pourquoi souhaitez-vous rejoindre ce salon ?</span>
                                    <textarea
                                        className="field-input field-textarea"
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        rows={4}
                                        maxLength={1000}
                                    />
                                </label>
                                {error && (
                                    <p className="form-error" role="alert">
                                        {error}
                                    </p>
                                )}
                                <button className="btn btn-accent" disabled={busy}>
                                    {busy ? "Envoi…" : "Demander l’accès"}
                                </button>
                            </form>
                        )}
                    </section>
                )}
            </BoardState>
            <Modal open={reviewing} onClose={() => !busy && setReviewing(false)} title="Accès au salon" size="dialog">
                <p>
                    Les autorisations accordées concernent uniquement ce salon. Les autres permissions des rôles restent
                    applicables.
                </p>
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                {!access.data?.requests.length ? (
                    <p className="board-state">Aucune demande reçue.</p>
                ) : (
                    <ul className="gate-requests">
                        {access.data.requests.map((request) => (
                            <li key={request.userId}>
                                <Avatar user={request} size={32} />
                                <div>
                                    <strong>{request.displayName || request.handle}</strong>
                                    <p>{request.reason || "Aucune précision ajoutée."}</p>
                                    <span>
                                        {request.status === "pending"
                                            ? "En attente"
                                            : request.status === "approved"
                                              ? "Accès accordé"
                                              : "Accès refusé"}
                                    </span>
                                </div>
                                <div className="gate-actions">
                                    {request.status !== "approved" && (
                                        <button
                                            type="button"
                                            className="btn btn-accent"
                                            disabled={busy}
                                            onClick={() => act(`/${request.userId}`, { status: "approved" }, "PATCH")}
                                        >
                                            Autoriser
                                        </button>
                                    )}
                                    {request.status !== "declined" && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            disabled={busy}
                                            onClick={() => act(`/${request.userId}`, { status: "declined" }, "PATCH")}
                                        >
                                            {request.status === "approved" ? "Retirer l’accès" : "Refuser"}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Modal>
        </div>
    );
}
