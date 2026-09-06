import { Fragment, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

import Avatar from "../ui/Avatar.jsx";
import { UNREADABLE } from "./useChannelEncryption.js";
import AttachmentList from "./AttachmentList.jsx";
import Icon from "../ui/Icon.jsx";
import { dayLabel, fullTimestamp, messageTimestamp, shouldGroup } from "../../lib/format.js";
import ContextMenu from "../ui/ContextMenu.jsx";
import useContextMenu from "../../hooks/useContextMenu.js";
import { api } from "../../lib/api.js";
import { WINDOW_SIZE, grow, hiddenBefore, windowOf } from "../../lib/windowing.js";
import Tooltip from "../ui/Tooltip.jsx";
const SafeMarkdown = lazy(() => import("./SafeMarkdown.jsx"));
const PollCard = lazy(() => import("./PollCard.jsx"));

function ChannelSpoiler({ hidden, children }) {
    const [revealed, setRevealed] = useState(false);
    if (!hidden) return children;
    return (
        <div className={`channel-spoiler${revealed ? " is-revealed" : ""}`}>
            <button type="button" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>
                <Icon name="lock" size={14} />
                {revealed ? "Masquer le contenu" : "Révéler le contenu avec spoilers"}
            </button>
            {revealed && children}
        </div>
    );
}

function Reaction({ reaction, channelId, messageId, emojis, onToggle }) {
    const [authors, setAuthors] = useState(null);
    const custom = emojis.find((entry) => `:${entry.name}:` === reaction.emoji);

    const load = () => {
        if (authors !== null) return;
        setAuthors([]);
        api(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(reaction.emoji)}`)
            .then(({ users }) => setAuthors(users ?? []))
            .catch(() => setAuthors([]));
    };

    const names = (authors ?? []).map((user) => user.displayName || user.handle);
    const label =
        names.length > 0
            ? `${names.slice(0, 8).join(", ")}${names.length > 8 ? ` et ${names.length - 8} autres` : ""}`
            : reaction.me
              ? "Retirer votre réaction"
              : "Réagir";

    return (
        <Tooltip label={label}>
            <button
                className={`reaction${reaction.me ? " mine" : ""}`}
                onClick={onToggle}
                onMouseEnter={load}
                onFocus={load}
                aria-label={`${reaction.emoji} ${reaction.count} — ${label}`}
            >
                <span className="r-emoji">
                    {custom ? <img className="custom-emoji" src={custom.url} alt={reaction.emoji} /> : reaction.emoji}
                </span>
                {reaction.count}
            </button>
        </Tooltip>
    );
}

function MessageBody({ message, readable, roles, emojis }) {
    const text = readable ? readable(message) : message.content;

    if (text === UNREADABLE) {
        return (
            <p className="msg-locked" role="status">
                Message chiffré — cet appareil n’a pas la clé de cette période.
            </p>
        );
    }
    if (text === null) return <p className="msg-locked">Déchiffrement…</p>;

    return (
        <Suspense fallback={<p>{text}</p>}>
            <SafeMarkdown roles={roles} emojis={emojis}>
                {text}
            </SafeMarkdown>
        </Suspense>
    );
}

function MessageRow({
    message,
    compact,
    isOwn,
    canModerate,
    onReply,
    onEdit,
    onDelete,
    onPin,
    onThread,
    onReport,
    children,
}) {
    const menu = useContextMenu();

    const items = [
        { id: "reply", label: "Répondre", icon: "chevron", run: () => onReply(message) },
        onThread ? { id: "thread", label: "Ouvrir un fil", icon: "channels", run: () => onThread(message) } : null,
        {
            id: "copy",
            label: "Copier le texte",
            icon: "invite",
            run: () => navigator.clipboard?.writeText(message.content ?? ""),
        },
        isOwn ? { id: "edit", label: "Modifier", icon: "settings", run: () => onEdit(message) } : null,
        canModerate && onPin
            ? { id: "pin", label: "Épingler au salon", icon: "crown", run: () => onPin(message.messageId) }
            : null,
        !isOwn && onReport ? { separator: true } : null,
        !isOwn && onReport ? { id: "report", label: "Signaler", icon: "bell", run: () => onReport(message) } : null,
        isOwn || canModerate ? { separator: true } : null,
        isOwn || canModerate
            ? { id: "delete", label: "Supprimer", icon: "close", danger: true, run: () => onDelete(message.messageId) }
            : null,
    ].filter(Boolean);

    return (
        <article
            className={`msg${compact ? " msg-grouped" : ""}`}
            data-message-id={message.messageId}
            {...menu.triggerProps}
        >
            {menu.position && <ContextMenu items={items} position={menu.position} onClose={menu.close} />}
            {children}
        </article>
    );
}

function MessageActions({
    message,
    isOwn,
    canModerate,
    onReactRequest,
    onReply,
    onEdit,
    onDelete,
    onPin,
    onThread,
    onReport,
}) {
    return (
        <div className="msg-actions">
            <Tooltip label="Réagir">
                <button
                    className="msg-action"
                    aria-label="Réagir"
                    onClick={(e) => onReactRequest(message.messageId, e.currentTarget.getBoundingClientRect())}
                >
                    <Icon name="smile" size={16} />
                </button>
            </Tooltip>
            <Tooltip label="Répondre" shortcut="R">
                <button className="msg-action" aria-label="Répondre" onClick={() => onReply(message)}>
                    <Icon name="reply" size={16} />
                </button>
            </Tooltip>
            {isOwn && (
                <Tooltip label="Modifier">
                    <button className="msg-action" aria-label="Modifier" onClick={() => onEdit(message)}>
                        <Icon name="edit" size={16} />
                    </button>
                </Tooltip>
            )}
            {onThread && (
                <Tooltip label="Ouvrir un fil">
                    <button className="msg-action" aria-label="Ouvrir un fil" onClick={() => onThread(message)}>
                        <Icon name="channels" size={16} />
                    </button>
                </Tooltip>
            )}
            {!isOwn && onReport && (
                <Tooltip label="Signaler">
                    <button className="msg-action" aria-label="Signaler" onClick={() => onReport(message)}>
                        <Icon name="bell" size={16} />
                    </button>
                </Tooltip>
            )}
            {canModerate && onPin && (
                <Tooltip label="Épingler au salon">
                    <button
                        className="msg-action"
                        aria-label="Épingler au salon"
                        onClick={() => onPin(message.messageId)}
                    >
                        <Icon name="crown" size={16} />
                    </button>
                </Tooltip>
            )}
            {(isOwn || canModerate) && (
                <Tooltip label="Supprimer">
                    <button
                        className="msg-action danger"
                        aria-label="Supprimer"
                        onClick={() => onDelete(message.messageId)}
                    >
                        <Icon name="trash" size={16} />
                    </button>
                </Tooltip>
            )}
        </div>
    );
}

export default function MessageList({
    messages,
    readable,
    channelId,
    roles = [],
    emojis = [],
    channelType,
    loading,
    hasMore,
    onLoadOlder,
    channelName,
    isDm,
    currentUserId,
    canModerate,
    onReactRequest,
    onToggleReaction,
    onReply,
    onEditSave,
    onDelete,
    onPin,
    onThread,
    onReport,
}) {
    const scrollRef = useRef(null);
    const bottomRef = useRef(null);
    const atBottomRef = useRef(true);
    const prevHeightRef = useRef(0);
    const [windowSize, setWindowSize] = useState(WINDOW_SIZE);
    const shown = windowOf(messages, windowSize);
    const masked = hiddenBefore(messages, windowSize);

    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");

    useEffect(() => {
        if (atBottomRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
    }, [messages]);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (prevHeightRef.current && el.scrollHeight > prevHeightRef.current && el.scrollTop < 80) {
            el.scrollTop += el.scrollHeight - prevHeightRef.current;
        }
        prevHeightRef.current = el.scrollHeight;
    }, [messages]);

    function onScroll() {
        const el = scrollRef.current;
        if (!el) return;
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (el.scrollTop < 120 && hasMore) onLoadOlder();
    }

    function startEdit(message) {
        const text = readable ? readable(message) : message.content;
        if (text === UNREADABLE || text === null) return;
        setEditingId(message.messageId);
        setEditValue(text);
    }
    async function commitEdit(messageId) {
        const value = editValue.trim();
        if (value) await onEditSave(messageId, value);
        setEditingId(null);
    }

    if (loading) {
        return (
            <div className="msgs" ref={scrollRef}>
                <div className="msgs-skeleton">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div className="skel-row" key={i}>
                            <span className="skel-avatar" />
                            <span className="skel-lines">
                                <span className="skel-line" style={{ width: `${34 + ((i * 13) % 42)}%` }} />
                                <span className="skel-line" style={{ width: `${55 + ((i * 7) % 32)}%` }} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="msgs" ref={scrollRef} onScroll={onScroll}>
            <div className="msgs-lead">
                {!hasMore && (
                    <div className="msgs-origin">
                        <span className="msgs-origin-mark">{isDm ? "✦" : "#"}</span>
                        <h3>{isDm ? `Votre conversation avec ${channelName}` : `Bienvenue dans #${channelName}`}</h3>
                        <p>{isDm ? "Envoyez votre premier message." : "C'est le tout début de ce salon."}</p>
                    </div>
                )}
            </div>

            {masked > 0 && (
                <button
                    type="button"
                    className="msgs-reveal"
                    onClick={() => setWindowSize((size) => grow(size, messages.length))}
                >
                    Afficher {Math.min(masked, 40)} message{masked > 1 ? "s" : ""} de plus
                    <small>{masked} au-dessus</small>
                </button>
            )}

            {shown.map((message, index) => {
                const previous = shown[index - 1];
                const grouped = shouldGroup(previous, message);
                const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                const isOwn = message.author.userId === currentUserId;
                const compact = grouped && !newDay && !message.replyTo;

                return (
                    <Fragment key={message.messageId}>
                        {newDay && (
                            <div className="day-sep">
                                <span>{dayLabel(message.createdAt)}</span>
                            </div>
                        )}
                        <MessageRow
                            message={message}
                            compact={compact}
                            isOwn={isOwn}
                            canModerate={canModerate}
                            onReply={onReply}
                            onEdit={startEdit}
                            onDelete={onDelete}
                            onPin={onPin}
                            onThread={onThread}
                            onReport={onReport}
                        >
                            <MessageActions
                                message={message}
                                isOwn={isOwn}
                                canModerate={canModerate}
                                onReactRequest={onReactRequest}
                                onReply={onReply}
                                onEdit={startEdit}
                                onDelete={onDelete}
                                onPin={onPin}
                                onThread={onThread}
                                onReport={onReport}
                            />

                            {compact ? (
                                <time className="msg-gutter" dateTime={message.createdAt}>
                                    {messageTimestamp(message.createdAt).split(" ").pop()}
                                </time>
                            ) : (
                                <Avatar user={message.author} density />
                            )}

                            <div className="msg-body">
                                {message.replyTo && (
                                    <div className="reply-preview">
                                        <span className="reply-author">{message.replyTo.author || "quelqu'un"}</span>
                                        <span className="reply-text">
                                            {message.replyTo.content || "message supprimé"}
                                        </span>
                                    </div>
                                )}

                                {!compact && (
                                    <header className="msg-meta">
                                        <span className="msg-author">
                                            {message.author.displayName || message.author.handle}
                                        </span>
                                        {message.author.isBot && <span className="msg-flag">BOT</span>}
                                        {message.author.isWebhook && <span className="msg-flag">WEBHOOK</span>}
                                        <time
                                            className="msg-time"
                                            dateTime={message.createdAt}
                                            title={fullTimestamp(message.createdAt)}
                                        >
                                            {messageTimestamp(message.createdAt)}
                                        </time>
                                    </header>
                                )}

                                {editingId === message.messageId ? (
                                    <div className="msg-edit">
                                        <textarea
                                            value={editValue}
                                            autoFocus
                                            rows={Math.min(6, editValue.split("\n").length)}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    commitEdit(message.messageId);
                                                }
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                        />
                                        <div className="msg-edit-hint">
                                            échap pour <b>annuler</b> · entrée pour <b>enregistrer</b>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="msg-text">
                                        <ChannelSpoiler hidden={channelType === "spoiler"}>
                                            {!message.hasPoll && channelType !== "poll" && (
                                                <MessageBody
                                                    message={message}
                                                    readable={readable}
                                                    roles={roles}
                                                    emojis={emojis}
                                                />
                                            )}
                                            {message.editedAt && <span className="edited">(modifié)</span>}
                                            <AttachmentList attachments={message.attachments} />
                                            {(channelType === "poll" || message.hasPoll) && (
                                                <Suspense fallback={null}>
                                                    <PollCard
                                                        channelId={message.channelId}
                                                        messageId={message.messageId}
                                                        currentUserId={currentUserId}
                                                    />
                                                </Suspense>
                                            )}
                                        </ChannelSpoiler>
                                    </div>
                                )}

                                {message.reactions?.length > 0 && (
                                    <div className="reactions">
                                        {message.reactions.map((r) => (
                                            <Reaction
                                                key={r.emoji}
                                                reaction={r}
                                                channelId={channelId}
                                                messageId={message.messageId}
                                                emojis={emojis}
                                                onToggle={() => onToggleReaction(message.messageId, r.emoji, r.me)}
                                            />
                                        ))}
                                        <button
                                            className="reaction-add"
                                            aria-label="Ajouter une réaction"
                                            onClick={(e) =>
                                                onReactRequest(
                                                    message.messageId,
                                                    e.currentTarget.getBoundingClientRect()
                                                )
                                            }
                                        >
                                            <Icon name="plus" size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </MessageRow>
                    </Fragment>
                );
            })}
            <div ref={bottomRef} />
        </div>
    );
}
