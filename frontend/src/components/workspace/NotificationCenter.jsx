import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import { fullTimestamp } from "../../lib/format.js";

const labels = {
    mention: "vous a mentionné",
    reply: "a répondu à votre message",
    thread: "a écrit dans un fil que vous suivez",
    sanction: "a pris une mesure de modération",
    friend_request: "vous a envoyé une demande d’ami",
};

const TABS = [
    { id: "all", label: "Tout", countKey: "total" },
    { id: "mentions", label: "Mentions", countKey: "mentions" },
    { id: "threads", label: "Fils suivis", countKey: "threads" },
];

const EMPTY = {
    all: { title: "Rien à signaler.", hint: "Les mentions, réponses et fils suivis apparaîtront ici." },
    mentions: { title: "Aucune mention.", hint: "Vous verrez ici les messages où l’on vous cite ou vous répond." },
    threads: { title: "Aucun fil suivi.", hint: "Ouvrez un fil et suivez-le pour être averti des réponses." },
};

export default function NotificationCenter({
    open,
    notifications,
    filter,
    counts,
    digest,
    loading,
    loadingMore,
    hasMore,
    onFilter,
    onLoadMore,
    onClose,
    onRead,
    onReadAll,
    onNavigate,
}) {
    if (!open) return null;

    const empty = EMPTY[filter] ?? EMPTY.all;
    const hasUnread = notifications.some((item) => !item.readAt);

    return (
        <>
            <button className="notification-scrim" onClick={onClose} aria-label="Fermer les notifications" />
            <aside className="notification-center" aria-label="Notifications">
                <div className="notification-head">
                    <div><span className="eyebrow">Boîte de réception</span><h2>Notifications</h2></div>
                    <button className="icon-button" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
                </div>

                <div className="notification-tabs" role="tablist" aria-label="Filtrer les notifications">
                    {TABS.map((tab) => {
                        const count = counts?.[tab.countKey] ?? 0;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={filter === tab.id}
                                className={`notification-tab${filter === tab.id ? " is-active" : ""}`}
                                onClick={() => onFilter(tab.id)}
                            >
                                {tab.label}
                                {count > 0 && <span className="notification-tab-count">{count > 99 ? "99+" : count}</span>}
                            </button>
                        );
                    })}
                </div>

                {filter === "all" && digest?.enabled && digest.total > 0 && (
                    <div className="notification-digest">
                        <strong>
                            {digest.total} message{digest.total > 1 ? "s" : ""} en attente
                            {digest.mentions > 0 && ` · ${digest.mentions} vous cite${digest.mentions > 1 ? "nt" : ""}`}
                        </strong>
                        <span>
                            {digest.channels.slice(0, 3).map((entry) => `#${entry.channelName} (${entry.total})`).join(" · ")}
                            {digest.channels.length > 3 && ` · +${digest.channels.length - 3}`}
                        </span>
                    </div>
                )}

                {hasUnread && (
                    <button className="notification-read-all" onClick={onReadAll}>
                        <Icon name="check" size={15} />
                        {filter === "all" ? "Tout marquer comme lu" : "Marquer cet onglet comme lu"}
                    </button>
                )}

                <div className="notification-list">
                    {loading && (
                        <div className="notification-skeleton" aria-hidden="true">
                            {[0, 1, 2, 3].map((index) => (
                                <div className="notification-skeleton-row" key={index}>
                                    <span className="skeleton-dot" />
                                    <span className="skeleton-lines"><i /><i /></span>
                                </div>
                            ))}
                        </div>
                    )}
                    {loading && <span className="sr-only" role="status">Chargement des notifications…</span>}

                    {!loading && notifications.length === 0 && (
                        <div className="notification-empty">
                            <Icon name="bell" size={28} />
                            <p>{empty.title}</p>
                            <span>{empty.hint}</span>
                        </div>
                    )}

                    {!loading && notifications.map((item) => (
                        <button
                            key={item.notificationId}
                            className={`notification-item${item.readAt ? "" : " is-unread"}`}
                            onClick={() => { onRead(item.notificationId); onNavigate(item); }}
                        >
                            <Avatar user={item.actor || { displayName: "Qweillo" }} size={38} />
                            <span className="notification-copy">
                                <span><strong>{item.actor?.displayName || item.actor?.handle || "Un membre"}</strong> {labels[item.type] || "a envoyé une notification"}</span>
                                <small>{item.context.guildName ? `${item.context.guildName} · ` : ""}{item.context.channelName ? `#${item.context.channelName} · ` : ""}{fullTimestamp(item.createdAt)}</small>
                            </span>
                            {!item.readAt && <span className="notification-unread" />}
                        </button>
                    ))}

                    {!loading && hasMore && (
                        <button type="button" className="notification-more" onClick={onLoadMore} disabled={loadingMore}>
                            {loadingMore ? "Chargement…" : "Voir plus"}
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}
