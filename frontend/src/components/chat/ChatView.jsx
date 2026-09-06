import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api } from "../../lib/api";
import { getSocket, subscribeChannel, onChannelSubscribed } from "../../lib/socket";
import MessageList from "./MessageList.jsx";
import Composer from "./Composer.jsx";
import { useChannelEncryption } from "./useChannelEncryption.js";
import ChannelSidePanel from "./ChannelSidePanel.jsx";
import EventBoard from "./EventBoard.jsx";
import GalleryBoard from "./GalleryBoard.jsx";
import TaskBoard from "./TaskBoard.jsx";
import TicketBoard from "./TicketBoard.jsx";
import DocumentBoard from "./DocumentBoard.jsx";
import WorktreeBoard from "./WorktreeBoard.jsx";
import ForumBoard from "./ForumBoard.jsx";
import Modal from "../ui/Modal.jsx";
import { useChannelResource } from "../../hooks/useChannelResource.js";
import EmojiPicker from "./EmojiPicker.jsx";
import Icon from "../ui/Icon.jsx";
import { enqueue, flush as flushOutbox, pending as pendingFor, remove as removeFromOutbox } from "../../lib/outbox.js";
import { COMMANDS } from "../../lib/slashCommands.js";
import PollComposer from "./PollComposer.jsx";
import Tooltip from "../ui/Tooltip.jsx";

export default function ChatView({
    channel,
    contextLabel,
    currentUserId,
    members = [],
    roles = [],
    onToggleMembers,
    suspended = null,
}) {
    const [sidePanel, setSidePanel] = useState(false);
    const [panelTab] = useState("pins");
    const channelId = channel.channelId;
    const context = useChannelResource(channelId, "context", "channel:permissions channel:updated");
    const mode = context.data?.mode ?? {};
    const permissions = context.data?.permissions ?? [];
    const canModerate = Boolean(channel.guildId && permissions.includes("MANAGE_MESSAGES"));
    const canWrite = Boolean(context.data?.writable);
    const canCompose =
        canWrite &&
        mode.acceptsMessages !== false &&
        !mode.requiresThread &&
        !mode.requiresPoll &&
        (!mode.postPermission || permissions.includes(mode.postPermission));
    const isEvent = ["event", "meeting"].includes(channel.type);
    const pins = useChannelResource(
        channelId,
        mode.pinnedFirst ? "pins" : null,
        "message:pinned message:unpinned message:edit message:delete"
    );
    const [threadOpen, setThreadOpen] = useState(null);
    const [threadDraft, setThreadDraft] = useState(null);
    const [threadTitle, setThreadTitle] = useState("");
    const [dialogBusy, setDialogBusy] = useState(false);
    const [dialogError, setDialogError] = useState(null);
    const [report, setReport] = useState(null);
    const [reportReason, setReportReason] = useState("");
    const [messages, setMessages] = useState([]);
    const [emojis, setEmojis] = useState([]);
    const [queued, setQueued] = useState(() => pendingFor(channelId));
    const [notice, setNotice] = useState(null);
    const [pollOpen, setPollOpen] = useState(false);
    const [pollDraft, setPollDraft] = useState(null);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [replyTo, setReplyTo] = useState(null);
    const [reactPicker, setReactPicker] = useState(null);
    const [worktreeChannel, setWorktreeChannel] = useState(null);
    const worktreeOpen = worktreeChannel === channelId;
    const [typing, setTyping] = useState([]);
    const seenRef = useRef(new Set());
    const typingTimers = useRef(new Map());
    const encryption = useChannelEncryption(channel, messages);
    useEffect(() => {
        if (!channel.expiresAt) return undefined;
        const delay = Math.max(50, new Date(channel.expiresAt).getTime() - Date.now() + 50);
        if (delay > 2_147_483_647) return undefined;
        const timer = setTimeout(context.reload, delay);
        return () => clearTimeout(timer);
    }, [channel.expiresAt, context.reload]);

    const addMessages = useCallback((incoming, position) => {
        setMessages((current) => {
            const fresh = incoming.filter((m) => !seenRef.current.has(m.messageId));
            fresh.forEach((m) => seenRef.current.add(m.messageId));
            if (fresh.length === 0) return current;
            return position === "prepend" ? [...fresh, ...current] : [...current, ...fresh];
        });
    }, []);

    const replaceMessage = useCallback((updated) => {
        setMessages((current) => current.map((m) => (m.messageId === updated.messageId ? { ...m, ...updated } : m)));
    }, []);

    const removeMessage = useCallback((messageId) => {
        seenRef.current.delete(messageId);
        setMessages((current) => current.filter((m) => m.messageId !== messageId));
    }, []);

    const setReactionCount = useCallback((messageId, emoji, count) => {
        setMessages((current) =>
            current.map((m) => {
                if (m.messageId !== messageId) return m;
                const list = [...(m.reactions ?? [])];
                const idx = list.findIndex((r) => r.emoji === emoji);
                if (count <= 0) return { ...m, reactions: list.filter((r) => r.emoji !== emoji) };
                if (idx === -1) list.push({ emoji, count, me: false });
                else list[idx] = { ...list[idx], count };
                return { ...m, reactions: list };
            })
        );
    }, []);

    const flipMine = useCallback((messageId, emoji, mineNext) => {
        setMessages((current) =>
            current.map((m) => {
                if (m.messageId !== messageId) return m;
                const list = [...(m.reactions ?? [])];
                const idx = list.findIndex((r) => r.emoji === emoji);
                if (idx === -1) return mineNext ? { ...m, reactions: [...list, { emoji, count: 1, me: true }] } : m;
                const count = Math.max(0, list[idx].count + (mineNext ? 1 : -1));
                if (count === 0) return { ...m, reactions: list.filter((r) => r.emoji !== emoji) };
                list[idx] = { ...list[idx], count, me: mineNext };
                return { ...m, reactions: list };
            })
        );
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = () =>
            api(`/channels/${channelId}/messages?limit=50`)
                .then(({ messages: page, hasMore: more, nextCursor, emojis: cited }) => {
                    if (cancelled) return;
                    const chronological = [...page].reverse();
                    chronological.forEach((m) => seenRef.current.add(m.messageId));
                    setMessages(chronological);
                    setEmojis(cited ?? []);
                    setHasMore(more);
                    setCursor(nextCursor);
                    setLoading(false);
                })
                .catch((error) => {
                    if (!cancelled) {
                        setNotice(error.message || "Messages indisponibles. Réessayez.");
                        setLoading(false);
                    }
                });
        load();

        const stopRefresh = onChannelSubscribed((event) => {
            if (event.channelId === Number(channelId)) load();
        });
        const unsubscribe = subscribeChannel(channelId);
        return () => {
            cancelled = true;
            stopRefresh();
            unsubscribe();
        };
    }, [channelId]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return undefined;
        const inChannel = (m) => Number(m.channelId) === Number(channelId);

        const onNew = (m) => inChannel(m) && addMessages([m], "append");
        const onEdit = (m) => inChannel(m) && replaceMessage(m);
        const onDelete = (p) => inChannel(p) && removeMessage(p.messageId);
        const onReaction = (p) => inChannel(p) && setReactionCount(p.messageId, p.emoji, p.count);
        const onPoll = (payload) =>
            inChannel(payload.message) && addMessages([{ ...payload.message, hasPoll: true }], "append");
        const onTyping = (p) => {
            if (Number(p.channelId) !== Number(channelId) || p.userId === currentUserId) return;
            setTyping((t) =>
                t.some((u) => u.userId === p.userId) ? t : [...t, { userId: p.userId, displayName: p.displayName }]
            );
            clearTimeout(typingTimers.current.get(p.userId));
            typingTimers.current.set(
                p.userId,
                setTimeout(() => setTyping((t) => t.filter((u) => u.userId !== p.userId)), 4500)
            );
        };

        socket.on("message:new", onNew);
        socket.on("message:edit", onEdit);
        socket.on("message:delete", onDelete);
        socket.on("poll:created", onPoll);
        socket.on("reaction:update", onReaction);
        socket.on("typing:start", onTyping);
        return () => {
            socket.off("message:new", onNew);
            socket.off("message:edit", onEdit);
            socket.off("message:delete", onDelete);
            socket.off("poll:created", onPoll);
            socket.off("reaction:update", onReaction);
            socket.off("typing:start", onTyping);
        };
    }, [channelId, currentUserId, addMessages, replaceMessage, removeMessage, setReactionCount]);

    const loadOlder = useCallback(async () => {
        if (!hasMore || !cursor) return;
        const {
            messages: page,
            hasMore: more,
            nextCursor,
        } = await api(`/channels/${channelId}/messages?limit=50&before=${cursor}`);
        addMessages([...page].reverse(), "prepend");
        setHasMore(more);
        setCursor(nextCursor);
    }, [channelId, cursor, hasMore, addMessages]);

    const newestId = messages.length > 0 ? messages[messages.length - 1].messageId : null;
    useEffect(() => {
        if (!newestId) return;
        api(`/notifications/read/${channelId}/${newestId}`, { method: "PUT" }).catch(() => {});
    }, [channelId, newestId]);

    async function send(content, attachmentIds = []) {
        const encrypted = await encryption.encryptOutgoing(content);
        const entry = enqueue({ channelId, content: encrypted, replyToId: replyTo?.messageId ?? null });
        setReplyTo(null);

        try {
            const { message } = await api(`/channels/${channelId}/messages`, {
                method: "POST",
                body: {
                    content: encrypted,
                    attachmentIds,
                    replyToId: entry.replyToId ?? undefined,
                    clientNonce: entry.id,
                },
            });
            removeFromOutbox(entry.id);
            addMessages([message], "append");
        } catch (error) {
            if (error?.status >= 400 && error.status < 500) {
                removeFromOutbox(entry.id);
                throw error;
            }
            setQueued(pendingFor(channelId));
        }
    }

    async function runCommand(command, args) {
        if (command.action === "me") return send(`*${args}*`);
        if (command.action === "read") {
            await api(`/notifications/read/${channelId}`, { method: "PUT" }).catch(() => {});
            return true;
        }
        if (command.action === "help") {
            setNotice(COMMANDS.map((entry) => `/${entry.name} — ${entry.summary}`).join("\n"));
            return true;
        }
        if (command.action === "poll") {
            if (!args) {
                setPollOpen(true);
                return true;
            }
            const [question, ...options] = args
                .split("|")
                .map((part) => part.trim())
                .filter(Boolean);
            if (!question || options.length < 2) {
                setPollDraft({ question: question ?? "", options });
                setPollOpen(true);
                return true;
            }

            await api(`/channels/${channelId}/polls`, {
                method: "POST",
                body: { question, options },
            });
            return true;
        }
        if (command.action === "mute") {
            await api(`/notifications/settings/channels/${channelId}`, {
                method: "PUT",
                body: { level: "none" },
            }).catch(() => {});
            setNotice("Notifications coupées pour ce salon.");
            return true;
        }
        if (command.action === "pin") {
            const last = messages.at(-1);
            if (!last) return false;
            return pinMessage(last.messageId);
        }
        return false;
    }

    useEffect(() => {
        const drain = () =>
            flushOutbox(async (entry) => {
                const { message } = await api(`/channels/${entry.channelId}/messages`, {
                    method: "POST",
                    body: { content: entry.content, replyToId: entry.replyToId ?? undefined, clientNonce: entry.id },
                });
                if (entry.channelId === channelId) addMessages([message], "append");
            }).then(() => setQueued(pendingFor(channelId)));

        window.addEventListener("online", drain);
        drain();
        return () => window.removeEventListener("online", drain);
    }, [addMessages, channelId]);

    async function openThread(message) {
        try {
            const result = await api(`/channels/${channelId}/threads?limit=100`);
            const existing = result.threads.find((thread) => thread.rootId === message.messageId);
            if (existing) {
                setThreadOpen(existing.rootId);
                return;
            }
            setThreadDraft(message);
            const content = encryption.readable(message);
            setThreadTitle(typeof content === "string" ? content.slice(0, 60) : "Discussion");
            setDialogError(null);
        } catch (error) {
            setNotice(error.message || "La discussion n’a pas pu être ouverte.");
        }
    }

    function reportMessage(message) {
        setReport(message);
        setReportReason("");
        setDialogError(null);
    }

    async function submitDialog(event, kind) {
        event.preventDefault();
        if (dialogBusy) return;
        setDialogBusy(true);
        setDialogError(null);
        try {
            if (kind === "thread") {
                const result = await api(`/channels/${channelId}/messages/${threadDraft.messageId}/thread`, {
                    method: "POST",
                    body: { title: threadTitle.trim() },
                });
                setThreadDraft(null);
                setThreadOpen(result.thread.rootId);
            } else {
                await api(`/channels/${channelId}/messages/${report.messageId}/report`, {
                    method: "POST",
                    body: { reason: reportReason.trim() },
                });
                setReport(null);
                setNotice("Signalement transmis à l’équipe de modération.");
            }
        } catch (error) {
            setDialogError(error.message || "L’opération n’a pas abouti.");
        } finally {
            setDialogBusy(false);
        }
    }

    async function pinMessage(messageId) {
        try {
            await api(`/channels/${channelId}/messages/${messageId}/pin`, { method: "PUT" });
            setSidePanel(true);
        } catch (error) {
            setNotice(error.message || "Le message n’a pas pu être épinglé.");
        }
    }

    async function toggleReaction(messageId, emoji) {
        const message = messages.find((m) => m.messageId === messageId);
        const mine = message?.reactions?.find((r) => r.emoji === emoji)?.me ?? false;
        flipMine(messageId, emoji, !mine);
        try {
            if (mine)
                await api(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
                    method: "DELETE",
                });
            else
                await api(`/channels/${channelId}/messages/${messageId}/reactions`, {
                    method: "POST",
                    body: { emoji },
                });
        } catch {
            flipMine(messageId, emoji, mine);
        }
    }

    async function editMessage(messageId, content) {
        const { message } = await api(`/channels/${channelId}/messages/${messageId}`, {
            method: "PATCH",
            body: { content: await encryption.encryptOutgoing(content) },
        });
        replaceMessage(message);
    }

    async function deleteMessage(messageId) {
        removeMessage(messageId);
        try {
            await api(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
        } catch {
            const { messages: page } = await api(`/channels/${channelId}/messages?limit=50`);
            const chronological = [...page].reverse();
            seenRef.current = new Set(chronological.map((m) => m.messageId));
            setMessages(chronological);
        }
    }

    function openReactPicker(messageId, rect) {
        const left = Math.max(12, Math.min(rect.left - 150, window.innerWidth - 320));
        const top = Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 300));
        setReactPicker({ messageId, left, top });
    }

    function emitTyping() {
        getSocket()?.emit("typing:start", channelId);
    }

    const title = channel.user ? channel.user.displayName || channel.user.handle : channel.name;
    const placeholder = channel.user
        ? `Écrire à ${channel.user.displayName || channel.user.handle}`
        : `Écrire dans #${channel.name}`;

    return (
        <section className={`chat${sidePanel ? " has-side" : ""}`}>
            <header className="chat-head">
                <div className="chat-head-title">
                    {!channel.user && (
                        <span className="chat-head-glyph">
                            <Icon name="hash" size={19} />
                        </span>
                    )}
                    <span className="chat-head-name">{title}</span>
                    {channel.description && <span className="chat-head-topic">{channel.description}</span>}
                </div>
                <div className="chat-tools">
                    {contextLabel && (
                        <span className="chat-head-topic" style={{ border: "none" }}>
                            {contextLabel}
                        </span>
                    )}
                    {["development", "review", "incident"].includes(channel.type) && (
                        <Tooltip label="Worktree" placement="bottom">
                            <button
                                className={`tool${worktreeOpen ? " is-on" : ""}`}
                                onClick={() =>
                                    setWorktreeChannel((current) => (current === channelId ? null : channelId))
                                }
                                aria-pressed={worktreeOpen}
                                aria-label="Ouvrir le worktree"
                            >
                                <Icon name="edit" />
                            </button>
                        </Tooltip>
                    )}
                    <Tooltip label="Épinglés et recherche" placement="bottom">
                        <button
                            className={`tool${sidePanel ? " is-on" : ""}`}
                            onClick={() => setSidePanel((open) => !open)}
                            aria-pressed={sidePanel}
                            aria-label="Épinglés et recherche"
                        >
                            <Icon name="search" />
                        </button>
                    </Tooltip>
                    {onToggleMembers && (
                        <Tooltip label="Afficher les membres" placement="bottom">
                            <button className="tool" onClick={onToggleMembers} aria-label="Afficher les membres">
                                <Icon name="users" />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </header>

            {context.error && (
                <p className="form-error" role="alert">
                    {context.error}
                </p>
            )}
            {channel.expiresAt && (
                <p className="channel-lifetime" role="status">
                    {context.data?.expired
                        ? "Ce salon temporaire est fermé. L’historique reste consultable."
                        : `Fermeture prévue le ${new Date(channel.expiresAt).toLocaleString("fr-FR")}.`}
                </p>
            )}
            {mode.pinnedFirst && Boolean(pins.data?.pins.length) && (
                <div className="incident-pins" aria-label="Informations importantes">
                    {pins.data.pins.slice(0, 3).map((message) => (
                        <button
                            type="button"
                            key={message.messageId}
                            onClick={() =>
                                document
                                    .querySelector(`[data-message-id="${message.messageId}"]`)
                                    ?.scrollIntoView({ block: "center" })
                            }
                        >
                            <Icon name="bell" size={15} />
                            <span>{message.content.slice(0, 220)}</span>
                        </button>
                    ))}
                </div>
            )}
            {context.data && !permissions.includes("READ_MESSAGE_HISTORY") ? (
                <p className="board-state">Votre rôle ne permet pas de consulter l’historique de ce salon.</p>
            ) : isEvent ? (
                <EventBoard channel={channel} currentUserId={currentUserId} readOnly={!canWrite} />
            ) : ["gallery", "design"].includes(channel.type) ? (
                <GalleryBoard
                    channel={channel}
                    currentUserId={currentUserId}
                    canModerate={permissions.includes("MANAGE_MESSAGES")}
                />
            ) : ["wiki", "documentation", "resources", "faq"].includes(channel.type) ? (
                <DocumentBoard
                    channel={channel}
                    readOnly={!canWrite}
                    canDelete={permissions.includes("MANAGE_CHANNELS")}
                />
            ) : channel.type === "ticket" ? (
                <TicketBoard channel={channel} readOnly={Boolean(suspended)} />
            ) : channel.type === "task" ? (
                <TaskBoard channel={channel} currentUserId={currentUserId} members={members} readOnly={!canWrite} />
            ) : (
                <>
                    {worktreeOpen && ["development", "review", "incident"].includes(channel.type) && (
                        <div className="worktree-split">
                            <WorktreeBoard channel={channel} currentUserId={currentUserId} />
                        </div>
                    )}
                    {pollOpen && (
                        <PollComposer
                            open
                            draft={pollDraft}
                            channelId={channelId}
                            onClose={() => {
                                setPollOpen(false);
                                setPollDraft(null);
                            }}
                        />
                    )}

                    {mode.requiresPoll && canWrite && (
                        <div className="channel-mode-action">
                            <button type="button" className="btn btn-accent" onClick={() => setPollOpen(true)}>
                                <Icon name="plus" size={16} />
                                Créer un sondage
                            </button>
                            <p>Chaque publication pose une question aux membres du salon.</p>
                        </div>
                    )}

                    {encryption.enabled && encryption.error && (
                        <p className="e2ee-notice" role="alert">
                            Chiffrement indisponible sur cet appareil : {encryption.error}
                        </p>
                    )}

                    {notice && (
                        <div className="command-notice" role="status">
                            <pre>{notice}</pre>
                            <button type="button" onClick={() => setNotice(null)} aria-label="Fermer">
                                Fermer
                            </button>
                        </div>
                    )}

                    {queued.length > 0 && (
                        <p className="outbox-pending" role="status">
                            {queued.length} message{queued.length > 1 ? "s" : ""} en attente —{" "}
                            {queued.length > 1 ? "ils partiront" : "il partira"} au retour de la connexion.
                        </p>
                    )}
                    {worktreeOpen ? null : mode.requiresThread ? (
                        <ForumBoard
                            channel={channel}
                            currentUserId={currentUserId}
                            canModerate={permissions.includes("MANAGE_MESSAGES")}
                            readOnly={!canWrite}
                        />
                    ) : (
                        <MessageList
                            roles={roles}
                            emojis={emojis}
                            channelId={channelId}
                            readable={encryption.readable}
                            channelType={channel.type}
                            onPin={canModerate ? pinMessage : null}
                            onThread={openThread}
                            onReport={channel.guildId ? reportMessage : null}
                            messages={messages}
                            loading={loading}
                            hasMore={hasMore}
                            onLoadOlder={loadOlder}
                            channelName={channel.name || channel.user?.displayName || channel.user?.handle || ""}
                            isDm={!!channel.user}
                            currentUserId={currentUserId}
                            canModerate={canModerate}
                            onReactRequest={openReactPicker}
                            onToggleReaction={toggleReaction}
                            onReply={setReplyTo}
                            onEditSave={editMessage}
                            onDelete={deleteMessage}
                        />
                    )}

                    <div className="typing" aria-live="polite">
                        {typing.length > 0 && (
                            <>
                                <span className="typing-dots">
                                    <i />
                                    <i />
                                    <i />
                                </span>
                                {typing.length === 1
                                    ? `${typing[0].displayName} est en train d'écrire…`
                                    : `${typing.length} personnes écrivent…`}
                            </>
                        )}
                    </div>
                </>
            )}

            {suspended ? (
                <div className="channel-frozen" role="status">
                    <Icon name="alert" size={17} />
                    <div>
                        <strong>Cette communauté est suspendue</strong>
                        <p>
                            {suspended.reason
                                ? suspended.reason
                                : "Aucun message ni aucune modification n\u2019est accepté pour le moment."}{" "}
                            L’historique reste consultable, et rien n’a été supprimé.
                        </p>
                    </div>
                </div>
            ) : (
                canCompose &&
                !worktreeOpen &&
                !["ticket", "task", "wiki", "documentation", "resources", "faq", "event", "meeting"].includes(
                    channel.type
                ) && (
                    <Composer
                        onSend={send}
                        channelId={channelId}
                        guildId={channel.guildId}
                        onCommand={runCommand}
                        placeholder={placeholder}
                        replyTo={replyTo}
                        onCancelReply={() => setReplyTo(null)}
                        onTyping={emitTyping}
                    />
                )
            )}

            {sidePanel && (
                <ChannelSidePanel
                    tab={panelTab}
                    channel={channel}
                    guildId={channel.guildId}
                    canManageMessages={canModerate}
                    onClose={() => setSidePanel(false)}
                    onOpenThread={(thread) => setThreadOpen(thread.rootId)}
                    onGo={(message) => {
                        document
                            .querySelector(`[data-message-id="${message.messageId}"]`)
                            ?.scrollIntoView({ block: "center", behavior: "smooth" });
                    }}
                />
            )}

            <Modal
                open={Boolean(threadOpen)}
                onClose={() => setThreadOpen(null)}
                title="Discussion"
                className="modal-thread"
            >
                <ForumBoard
                    key={threadOpen || "closed"}
                    channel={channel}
                    currentUserId={currentUserId}
                    initialRootId={threadOpen}
                    canModerate={permissions.includes("MANAGE_MESSAGES")}
                    readOnly={!canWrite}
                />
            </Modal>
            <Modal
                open={Boolean(threadDraft)}
                onClose={() => !dialogBusy && setThreadDraft(null)}
                title="Ouvrir une discussion"
                size="dialog"
            >
                <form className="form workflow-form" onSubmit={(event) => submitDialog(event, "thread")}>
                    <label className="field">
                        <span className="field-label">Titre de la discussion</span>
                        <input
                            className="field-input"
                            value={threadTitle}
                            onChange={(event) => setThreadTitle(event.target.value)}
                            maxLength={100}
                            required
                            data-autofocus
                        />
                    </label>
                    {dialogError && (
                        <p className="form-error" role="alert">
                            {dialogError}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setThreadDraft(null)}>
                            Annuler
                        </button>
                        <button className="btn btn-accent" disabled={dialogBusy || !threadTitle.trim()}>
                            Ouvrir la discussion
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={Boolean(report)}
                onClose={() => !dialogBusy && setReport(null)}
                title="Signaler ce message"
                size="dialog"
            >
                <form className="form workflow-form" onSubmit={(event) => submitDialog(event, "report")}>
                    <p>
                        Votre signalement est transmis à l’équipe de modération. L’auteur du message n’en est pas
                        informé.
                    </p>
                    <label className="field">
                        <span className="field-label">Motif du signalement</span>
                        <textarea
                            className="field-input field-textarea"
                            rows={4}
                            value={reportReason}
                            onChange={(event) => setReportReason(event.target.value)}
                            maxLength={500}
                            required
                            data-autofocus
                        />
                    </label>
                    {dialogError && (
                        <p className="form-error" role="alert">
                            {dialogError}
                        </p>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setReport(null)}>
                            Annuler
                        </button>
                        <button className="btn btn-accent" disabled={dialogBusy || !reportReason.trim()}>
                            Envoyer le signalement
                        </button>
                    </div>
                </form>
            </Modal>

            {reactPicker &&
                createPortal(
                    <EmojiPicker
                        guildId={channel.guildId}
                        style={{
                            position: "fixed",
                            left: reactPicker.left,
                            top: reactPicker.top,
                            right: "auto",
                            bottom: "auto",
                            zIndex: 60,
                        }}
                        onPick={(emoji) => {
                            toggleReaction(reactPicker.messageId, emoji);
                            setReactPicker(null);
                        }}
                        onClose={() => setReactPicker(null)}
                    />,
                    document.body
                )}
        </section>
    );
}
