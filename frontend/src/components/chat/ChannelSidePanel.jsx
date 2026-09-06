import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { isEncrypted } from "../../lib/e2ee/crypto.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";

function ResultRow({ message, onGo }) {
    const encrypted = isEncrypted(message.content);
    return (
        <li>
            <button type="button" onClick={() => onGo?.(message)}>
                <Avatar user={message.author} size={26} />
                <span className="side-result-body">
                    <strong>
                        {message.author.displayName || message.author.handle}
                        {message.channel && <em> · #{message.channel.name}</em>}
                    </strong>
                    <span className="side-result-text">
                        {encrypted ? "Message chiffré — ouvrez le salon pour le lire." : message.content}
                        {typeof message.score === "number" && (
                            <em> · recouvrement {Math.round(message.score * 100)} %</em>
                        )}
                    </span>
                </span>
                <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleDateString("fr-FR")}</time>
            </button>
        </li>
    );
}

export default function ChannelSidePanel({ channel, guildId, canManageMessages, tab: initialTab = "pins", onClose, onGo, onUnpin, onOpenThread }) {
    const [tab, setTab] = useState(initialTab);
    const [threads, setThreads] = useState(null);
    const [pins, setPins] = useState(null);
    const [term, setTerm] = useState("");
    const [scope, setScope] = useState("channel");
    const [search, setSearch] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState(null);
    const [summaryOptIn, setSummaryOptIn] = useState(false);

    const [seenChannel, setSeenChannel] = useState(channel.channelId);
    if (seenChannel !== channel.channelId) {
        setSeenChannel(channel.channelId);
        setPins(null);
        setSearch(null);
        setThreads(null);
    }

    useEffect(() => {
        let cancelled = false;
        api(`/channels/${channel.channelId}/pins`)
            .then(({ pins: list }) => !cancelled && setPins(list))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Épinglés indisponibles."));
        return () => {
            cancelled = true;
        };
    }, [channel.channelId]);

    useEffect(() => {
        if (tab !== "threads") return undefined;
        let cancelled = false;
        api(`/channels/${channel.channelId}/threads`)
            .then(({ threads: list }) => !cancelled && setThreads(list))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Fils indisponibles."));
        return () => {
            cancelled = true;
        };
    }, [tab, channel.channelId]);

    async function toggleFollow(thread) {
        try {
            const { thread: updated } = await api(`/channels/${channel.channelId}/threads/${thread.rootId}/follow`, {
                method: thread.following ? "DELETE" : "PUT",
            });
            setThreads((current) =>
                current?.map((item) => (item.rootId === thread.rootId ? { ...item, following: updated.following } : item))
            );
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Suivi non modifié.");
        }
    }

    async function runSearch(event) {
        event.preventDefault();
        if (term.trim().length < 2) return;
        setBusy(true);
        setError(null);
        try {
            const path =
                scope === "lexical"
                    ? `/search/semantic?q=${encodeURIComponent(term.trim())}`
                    : scope === "guild" && guildId
                      ? `/guilds/${guildId}/search?q=${encodeURIComponent(term.trim())}`
                      : `/channels/${channel.channelId}/search?q=${encodeURIComponent(term.trim())}`;
            setSearch(await api(path));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Recherche indisponible.");
        } finally {
            setBusy(false);
        }
    }

    async function unpin(messageId) {
        try {
            const { pins: list } = await api(`/channels/${channel.channelId}/messages/${messageId}/pin`, { method: "DELETE" });
            setPins(list);
            onUnpin?.(messageId);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Message non désépinglé.");
        }
    }

    return (
        <aside className="side-panel" aria-label="Panneau du salon">
            <header className="side-panel-head">
                <div className="side-panel-tabs" role="tablist">
                    <button type="button" role="tab" aria-selected={tab === "pins"} className={tab === "pins" ? "is-on" : ""} onClick={() => setTab("pins")}>
                        Épinglés
                    </button>
                    <button type="button" role="tab" aria-selected={tab === "threads"} className={tab === "threads" ? "is-on" : ""} onClick={() => setTab("threads")}>
                        Fils
                    </button>
                    <button type="button" role="tab" aria-selected={tab === "search"} className={tab === "search" ? "is-on" : ""} onClick={() => setTab("search")}>
                        Recherche
                    </button>
                </div>
                <button type="button" className="tool" onClick={onClose} aria-label="Fermer le panneau"><Icon name="close" size={16} /></button>
            </header>

            {error && <p className="auth-error" role="alert">{error}</p>}

            {tab === "threads" ? (
                <div className="side-panel-body">
                    {threads === null && !error && <p className="popout-role-empty">Chargement…</p>}
                    {threads?.length === 0 && (
                        <p className="popout-role-empty">
                            Aucun fil ouvert. Un fil sort une discussion du flux principal sans la perdre.
                        </p>
                    )}
                    <ul className="side-threads">
                        {threads?.map((thread) => (
                            <li key={thread.rootId}>
                                <button type="button" className="side-thread" onClick={() => onOpenThread?.(thread)}>
                                    <strong>{thread.title}</strong>
                                    <small>
                                        {thread.replyCount} réponse{thread.replyCount > 1 ? "s" : ""}
                                        {thread.archived ? " · archivé faute d’activité" : ""}
                                    </small>
                                </button>
                                <button
                                    type="button"
                                    className={`side-follow${thread.following ? " is-on" : ""}`}
                                    aria-pressed={thread.following}
                                    onClick={() => toggleFollow(thread)}
                                >
                                    {thread.following ? "Suivi" : "Suivre"}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : tab === "pins" ? (
                <div className="side-panel-body">
                    {pins === null && !error && <p className="popout-role-empty">Chargement…</p>}
                    {pins?.length === 0 && (
                        <p className="popout-role-empty">
                            Aucun message épinglé. Les messages importants d’un salon se retrouvent ici.
                        </p>
                    )}
                    <ul className="side-results">
                        {pins?.map((message) => (
                            <div className="side-pin" key={message.messageId}>
                                <ResultRow message={message} onGo={onGo} />
                                {canManageMessages && (
                                    <button type="button" className="side-unpin" onClick={() => unpin(message.messageId)} aria-label="Retirer l’épingle">
                                        <Icon name="close" size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="side-panel-body">
                    <form onSubmit={runSearch} className="side-search">
                        <label className="field">
                            <span className="field-label">Rechercher</span>
                            <input
                                className="field-input"
                                value={term}
                                onChange={(event) => setTerm(event.target.value)}
                                placeholder="Deux caractères minimum"
                                minLength={2}
                            />
                        </label>
                        <div className="segmented side-scope" role="radiogroup" aria-label="Portée de la recherche">
                            <button type="button" role="radio" aria-checked={scope === "channel"} className={scope === "channel" ? "is-on" : ""} onClick={() => setScope("channel")}>
                                Ce salon
                            </button>
                            {guildId && (
                                <button type="button" role="radio" aria-checked={scope === "guild"} className={scope === "guild" ? "is-on" : ""} onClick={() => setScope("guild")}>
                                    Toute la communauté
                                </button>
                            )}
                            <button type="button" role="radio" aria-checked={scope === "lexical"} className={scope === "lexical" ? "is-on" : ""} onClick={() => setScope("lexical")}>
                                Proche
                            </button>
                        </div>
                        <button className="btn btn-accent btn-block" disabled={busy || term.trim().length < 2}>
                            {busy ? "Recherche…" : "Rechercher"}
                        </button>
                    </form>

                    {search?.method === "lexical-overlap" && (
                        <p className="settings-warning" role="status">
                            Recouvrement lexical des mots saisis — pas un modèle.
                        </p>
                    )}

                    {search?.excludedEncrypted?.length > 0 && (
                        <p className="settings-warning" role="status">
                            Salons chiffrés non parcourus : {search.excludedEncrypted.join(", ")}. Leur contenu n’existe
                            pas en clair côté serveur.
                        </p>
                    )}

                    {search && search.results.length === 0 && (
                        <p className="popout-role-empty">Aucun résultat parmi les salons que vous pouvez lire.</p>
                    )}

                    <ul className="side-results">
                        {search?.results.map((message) => (
                            <ResultRow key={message.messageId} message={message} onGo={onGo} />
                        ))}
                    </ul>

                    {!channel.e2eeEnabled && (
                        <form
                            className="side-summary"
                            onSubmit={async (event) => {
                                event.preventDefault();
                                if (!summaryOptIn) return;
                                setBusy(true);
                                setError(null);
                                try {
                                    setSummary(
                                        await api(`/channels/${channel.channelId}/summary`, {
                                            method: "POST",
                                            body: { optedIn: true },
                                        })
                                    );
                                } catch (err) {
                                    setError(err instanceof ApiError ? err.message : "Résumé indisponible.");
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            <label className="side-optin">
                                <input
                                    type="checkbox"
                                    checked={summaryOptIn}
                                    onChange={(event) => setSummaryOptIn(event.target.checked)}
                                />
                                Produire un résumé extractif de ce salon (phrases déjà écrites, pas un modèle)
                            </label>
                            <button className="btn" disabled={busy || !summaryOptIn}>
                                Résumer
                            </button>
                        </form>
                    )}
                    {summary?.method === "extractive" && (
                        <p className="side-summary-body" role="status">
                            <strong>Extractif · {summary.messageCount} messages. </strong>
                            {summary.body}
                        </p>
                    )}
                </div>
            )}
        </aside>
    );
}
