import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import Avatar from "../ui/Avatar.jsx";
import Modal from "../ui/Modal.jsx";
import Icon from "../ui/Icon.jsx";
import BoardState from "./BoardState.jsx";

export default function GalleryBoard({ channel, currentUserId, canModerate = false }) {
    const resource = useChannelResource(channel.channelId, "attachments", "message:new message:edit message:delete");
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const files = resource.data?.attachments ?? [];
    const file = files.find((entry) => entry.attachmentId === selected);
    const index = files.findIndex((entry) => entry.attachmentId === selected);
    async function remove() {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await api(`/channels/${channel.channelId}/messages/${file.messageId}`, { method: "DELETE" });
            setSelected(null);
            setConfirming(false);
            resource.reload();
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : "La publication n’a pas pu être supprimée.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className="gallery-board workflow-board"
            aria-label={channel.type === "design" ? "Propositions visuelles" : "Galerie"}
        >
            <header className="workflow-heading">
                <div>
                    <h2>{channel.type === "design" ? "Propositions visuelles" : "Galerie"}</h2>
                    <p>Joignez une image à votre publication pour la partager ici.</p>
                </div>
            </header>
            <BoardState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
                {!files.length ? (
                    <div className="workflow-empty">
                        <Icon name="image" size={28} />
                        <h3>La première image reste à partager</h3>
                        <p>Ajoutez votre image avec le bouton de pièce jointe du champ de message.</p>
                    </div>
                ) : (
                    <div className="gallery-grid">
                        {files.map((entry) => (
                            <figure key={entry.attachmentId} className={`gallery-item gallery-${entry.kind}`}>
                                <button
                                    type="button"
                                    className="gallery-open"
                                    onClick={() => {
                                        setSelected(entry.attachmentId);
                                        setError(null);
                                    }}
                                    aria-label={`Voir ${entry.name}`}
                                >
                                    {entry.kind === "image" ? (
                                        <img src={entry.url} alt={entry.name} loading="lazy" />
                                    ) : (
                                        <span className="gallery-placeholder">{entry.name}</span>
                                    )}
                                </button>
                                <figcaption>
                                    <Avatar user={entry.author} size={22} />
                                    <span>
                                        <strong>{entry.name}</strong>
                                        <small>
                                            {entry.size}
                                            {entry.version > 1 ? ` · version ${entry.version}` : ""}
                                        </small>
                                    </span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                )}
            </BoardState>
            <Modal
                open={Boolean(file)}
                onClose={() => !busy && setSelected(null)}
                title={file?.name || "Image"}
                className="modal-gallery"
            >
                <div className="gallery-preview">
                    {file?.kind === "image" ? <img src={file.url} alt={file.name} /> : <p>{file?.name}</p>}
                </div>
                <div className="gallery-preview-actions">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={index <= 0}
                        onClick={() => setSelected(files[index - 1].attachmentId)}
                    >
                        Précédente
                    </button>
                    <span>
                        {index + 1} / {files.length}
                    </span>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={index >= files.length - 1}
                        onClick={() => setSelected(files[index + 1].attachmentId)}
                    >
                        Suivante
                    </button>
                    {file && (
                        <a className="btn btn-ghost" href={file.url} target="_blank" rel="noreferrer noopener">
                            <Icon name="download" size={15} /> Ouvrir l’original
                        </a>
                    )}
                    {file?.messageId && (canModerate || Number(file.author.userId) === Number(currentUserId)) && (
                        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>
                            Supprimer la publication
                        </button>
                    )}
                </div>
            </Modal>
            <Modal
                open={confirming}
                onClose={() => !busy && setConfirming(false)}
                title="Supprimer cette publication ?"
                size="dialog"
            >
                <p>Le message et ses images disparaîtront de ce salon.</p>
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
                        Conserver
                    </button>
                    <button className="btn btn-danger" disabled={busy} onClick={remove}>
                        Supprimer
                    </button>
                </div>
            </Modal>
        </section>
    );
}
