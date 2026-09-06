import { lazy, Suspense, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { isEncrypted } from "../../lib/e2ee/crypto.js";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import { useChannelEncryption, UNREADABLE } from "./useChannelEncryption.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import Modal from "../ui/Modal.jsx";
import BoardState from "./BoardState.jsx";

const SafeMarkdown = lazy(() => import("./SafeMarkdown.jsx"));
const EVENTS = "thread:opened thread:message thread:updated message:edit message:delete";
const LABELS = {
    forum: ["Sujets de discussion", "Nouveau sujet"],
    support: ["Entraide", "Nouvelle question"],
    review: ["Revues", "Nouvelle revue"],
    development: ["Discussions de développement", "Nouveau sujet"],
};

export default function ForumBoard({
    channel,
    currentUserId,
    canModerate = false,
    readOnly = false,
    initialRootId = null,
}) {
    const [selected, setSelected] = useState(initialRootId);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState({ title: "", content: "" });
    const [reply, setReply] = useState("");
    const [editing, setEditing] = useState(null);
    const [editText, setEditText] = useState("");
    const [removing, setRemoving] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const topics = useChannelResource(channel.channelId, "threads?limit=100", EVENTS);
    const conversation = useChannelResource(
        channel.channelId,
        selected ? `threads/${selected}/messages` : null,
        EVENTS
    );
    const messages = conversation.data?.messages ?? [];
    const encryption = useChannelEncryption(channel, messages);
    const thread = conversation.data?.thread;
    const followed = topics.data?.threads.find((entry) => entry.rootId === selected)?.following ?? false;
    const labels = LABELS[channel.type] || ["Discussion", "Nouveau sujet"];
    const visible = (topics.data?.threads ?? []).filter(
        (topic) =>
            topic.title.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")) &&
            (filter === "all" ||
                (filter === "followed" ? topic.following : filter === "resolved" ? topic.resolved : !topic.resolved))
    );

    async function act(run) {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await run();
            topics.reload();
            conversation.reload();
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : "L’opération n’a pas abouti. Réessayez.");
        } finally {
            setBusy(false);
        }
    }

    function open(event) {
        event.preventDefault();
        act(async () => {
            const result = await api(`/channels/${channel.channelId}/topics`, {
                method: "POST",
                body: { title: draft.title.trim(), content: await encryption.encryptOutgoing(draft.content.trim()) },
            });
            setSelected(result.thread.rootId);
            setDraft({ title: "", content: "" });
            setCreating(false);
            setFilter("all");
            setSearch("");
        });
    }

    function send(event) {
        event.preventDefault();
        act(async () => {
            await api(`/channels/${channel.channelId}/threads/${selected}/messages`, {
                method: "POST",
                body: { content: await encryption.encryptOutgoing(reply.trim()) },
            });
            setReply("");
        });
    }

    return (
        <section
            className={`forum-board workflow-board${selected ? " has-selection" : ""}${initialRootId ? " is-embedded" : ""}`}
            aria-label={labels[0]}
        >
            {!initialRootId && (
                <header className="workflow-heading">
                    <div>
                        <h2>{labels[0]}</h2>
                        <p>
                            {channel.type === "support"
                                ? "Les questions et les réponses sont visibles par les membres de ce salon."
                                : "Chaque sujet conserve sa discussion, ses réponses et son suivi."}
                        </p>
                    </div>
                    {!readOnly && (
                        <button
                            type="button"
                            className="btn btn-accent"
                            onClick={() => {
                                setCreating(true);
                                setError(null);
                            }}
                        >
                            <Icon name="plus" size={16} />
                            {labels[1]}
                        </button>
                    )}
                </header>
            )}
            {error && !creating && !editing && !removing && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            <div className="forum-workspace">
                {!initialRootId && (
                    <aside className="forum-index">
                        <label className="field">
                            <span className="field-label">Rechercher un sujet</span>
                            <input
                                className="field-input"
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </label>
                        <label className="field">
                            <span className="field-label">Afficher les sujets</span>
                            <select
                                className="field-input"
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                            >
                                <option value="all">Tous</option>
                                <option value="open">Non résolus</option>
                                <option value="resolved">Résolus</option>
                                <option value="followed">Suivis</option>
                            </select>
                        </label>
                        <BoardState loading={topics.loading} error={topics.error} onRetry={topics.reload}>
                            {visible.length === 0 ? (
                                <p className="board-state">Aucun sujet ne correspond pour le moment.</p>
                            ) : (
                                <ul className="forum-topics">
                                    {visible.map((topic) => (
                                        <li key={topic.rootId}>
                                            <button
                                                type="button"
                                                className={topic.rootId === selected ? "is-selected" : ""}
                                                onClick={() => {
                                                    setSelected(topic.rootId);
                                                    setReply("");
                                                    setError(null);
                                                }}
                                                aria-current={topic.rootId === selected ? "true" : undefined}
                                            >
                                                <strong>{topic.title}</strong>
                                                {topic.resolved && (
                                                    <span className="workflow-status">
                                                        <Icon name="check" size={13} /> Résolu
                                                    </span>
                                                )}
                                                <span>
                                                    {isEncrypted(topic.rootContent)
                                                        ? "Discussion chiffrée"
                                                        : topic.rootContent?.slice(0, 120)}
                                                </span>
                                                <small>
                                                    {topic.replyCount} réponse{topic.replyCount > 1 ? "s" : ""}
                                                    {topic.following ? " · Suivi" : ""}
                                                </small>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </BoardState>
                    </aside>
                )}
                <div className="forum-conversation">
                    {!selected ? (
                        <div className="workflow-empty">
                            <Icon name="channels" size={28} />
                            <h3>Une discussion à la fois</h3>
                            <p>Ouvrez un sujet pour lire les réponses et participer.</p>
                        </div>
                    ) : (
                        <BoardState
                            loading={conversation.loading}
                            error={conversation.error}
                            onRetry={conversation.reload}
                        >
                            {thread && (
                                <>
                                    <header className="forum-topic-head">
                                        {!initialRootId && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost forum-back"
                                                onClick={() => setSelected(null)}
                                            >
                                                <Icon name="chevron-left" size={15} /> Tous les sujets
                                            </button>
                                        )}
                                        <h3>{thread.title}</h3>
                                        <div className="workflow-toolbar">
                                            <span>
                                                {thread.replyCount} réponse{thread.replyCount > 1 ? "s" : ""}
                                                {thread.resolved ? " · Résolu" : ""}
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-ghost"
                                                aria-pressed={followed}
                                                disabled={busy}
                                                onClick={() =>
                                                    act(() =>
                                                        api(
                                                            `/channels/${channel.channelId}/threads/${selected}/follow`,
                                                            { method: followed ? "DELETE" : "PUT" }
                                                        )
                                                    )
                                                }
                                            >
                                                {followed ? "Ne plus suivre" : "Suivre le sujet"}
                                            </button>
                                            {!readOnly &&
                                                (canModerate || Number(thread.createdBy) === Number(currentUserId)) && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            act(() =>
                                                                api(
                                                                    `/channels/${channel.channelId}/threads/${selected}`,
                                                                    {
                                                                        method: "PATCH",
                                                                        body: { resolved: !thread.resolved },
                                                                    }
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {thread.resolved ? "Marquer non résolu" : "Marquer résolu"}
                                                    </button>
                                                )}
                                        </div>
                                    </header>
                                    {encryption.error && (
                                        <p className="form-error" role="alert">
                                            {encryption.error}
                                        </p>
                                    )}
                                    <ol className="thread-messages" aria-label="Messages du sujet">
                                        {messages.map((message) => {
                                            const content = encryption.readable(message);
                                            return (
                                                <li key={message.messageId}>
                                                    <Avatar user={message.author} size={34} />
                                                    <div>
                                                        <header>
                                                            <strong>
                                                                {message.author.displayName || message.author.handle}
                                                            </strong>
                                                            <time dateTime={message.createdAt}>
                                                                {fullTimestamp(message.createdAt)}
                                                            </time>
                                                            {message.editedAt && <span>Modifié</span>}
                                                        </header>
                                                        {content === UNREADABLE ? (
                                                            <p>
                                                                La clé de ce message n’est pas disponible sur cet
                                                                appareil.
                                                            </p>
                                                        ) : content == null ? (
                                                            <p role="status">Déchiffrement…</p>
                                                        ) : (
                                                            <Suspense fallback={<p>{content}</p>}>
                                                                <SafeMarkdown>{content}</SafeMarkdown>
                                                            </Suspense>
                                                        )}
                                                        {!readOnly && (
                                                            <div className="thread-message-actions">
                                                                {Number(message.author.userId) ===
                                                                    Number(currentUserId) &&
                                                                    typeof content === "string" && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-ghost"
                                                                            onClick={() => {
                                                                                setEditing(message);
                                                                                setEditText(content);
                                                                                setError(null);
                                                                            }}
                                                                        >
                                                                            Modifier le message
                                                                        </button>
                                                                    )}
                                                                {(canModerate ||
                                                                    Number(message.author.userId) ===
                                                                        Number(currentUserId)) && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost"
                                                                        onClick={() => {
                                                                            setRemoving(message);
                                                                            setError(null);
                                                                        }}
                                                                    >
                                                                        Supprimer{" "}
                                                                        {message.messageId === selected
                                                                            ? "le sujet"
                                                                            : "le message"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                    {!readOnly && (
                                        <form className="thread-reply" onSubmit={send}>
                                            <label className="field">
                                                <span className="field-label">Répondre au sujet</span>
                                                <textarea
                                                    className="field-input field-textarea"
                                                    value={reply}
                                                    onChange={(event) => setReply(event.target.value)}
                                                    maxLength={1800}
                                                    rows={4}
                                                    required
                                                />
                                            </label>
                                            <div className="workflow-actions">
                                                <button className="btn btn-accent" disabled={busy || !reply.trim()}>
                                                    {busy ? "Envoi…" : "Publier la réponse"}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </BoardState>
                    )}
                </div>
            </div>
            <Modal open={creating} onClose={() => !busy && setCreating(false)} title={labels[1]} size="dialog">
                <form className="form workflow-form" onSubmit={open}>
                    <label className="field">
                        <span className="field-label">Titre du sujet</span>
                        <input
                            className="field-input"
                            value={draft.title}
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            maxLength={100}
                            required
                            data-autofocus
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Premier message</span>
                        <textarea
                            className="field-input field-textarea"
                            value={draft.content}
                            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                            maxLength={1800}
                            rows={7}
                            required
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
                            onClick={() => setCreating(false)}
                        >
                            Annuler
                        </button>
                        <button
                            className="btn btn-accent"
                            disabled={busy || !draft.title.trim() || !draft.content.trim()}
                        >
                            {busy ? "Publication…" : "Publier le sujet"}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={Boolean(editing)}
                onClose={() => !busy && setEditing(null)}
                title="Modifier le message"
                size="dialog"
            >
                <form
                    className="form workflow-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        act(async () => {
                            await api(`/channels/${channel.channelId}/messages/${editing.messageId}`, {
                                method: "PATCH",
                                body: { content: await encryption.encryptOutgoing(editText.trim()) },
                            });
                            setEditing(null);
                        });
                    }}
                >
                    <label className="field">
                        <span className="field-label">Message</span>
                        <textarea
                            className="field-input field-textarea"
                            rows={7}
                            value={editText}
                            maxLength={1800}
                            onChange={(event) => setEditText(event.target.value)}
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
                            onClick={() => setEditing(null)}
                        >
                            Annuler
                        </button>
                        <button className="btn btn-accent" disabled={busy || !editText.trim()}>
                            Enregistrer
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={Boolean(removing)}
                onClose={() => !busy && setRemoving(null)}
                title={removing?.messageId === selected ? "Supprimer ce sujet ?" : "Supprimer ce message ?"}
                size="dialog"
            >
                <p>
                    {removing?.messageId === selected
                        ? "Le sujet et toutes ses réponses seront supprimés."
                        : "Ce message sera supprimé de la discussion."}
                </p>
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setRemoving(null)}>
                        Conserver
                    </button>
                    <button
                        className="btn btn-danger"
                        disabled={busy}
                        onClick={() =>
                            act(async () => {
                                await api(`/channels/${channel.channelId}/messages/${removing.messageId}`, {
                                    method: "DELETE",
                                });
                                if (removing.messageId === selected) setSelected(null);
                                setRemoving(null);
                            })
                        }
                    >
                        Supprimer
                    </button>
                </div>
            </Modal>
        </section>
    );
}
