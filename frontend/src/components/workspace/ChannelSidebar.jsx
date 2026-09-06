import { useEffect, useRef, useState } from "react";
import Avatar from "../ui/Avatar.jsx";
import Banner from "./Banner.jsx";
import UserBar from "./UserBar.jsx";
import Icon from "../ui/Icon.jsx";
import { announce } from "../../lib/announce.js";
import SidebarReorder from "./SidebarReorder.jsx";
import ContextMenu from "../ui/ContextMenu.jsx";
import useContextMenu from "../../hooks/useContextMenu.js";
import { moved } from "../../lib/reorder.js";
import { formatVoiceDuration } from "../../lib/voice.js";
import { groupChannelsByCategory } from "../../lib/channels.js";
import { isVoiceChannel } from "../../lib/voiceChannels.js";
import { channelTypeOf } from "../../lib/channelTypes.js";

function Category({ label, collapsed, onToggle, children, reorder = null, onAdd = null }) {
    return (
        <section>
            <div className="cat-head">
                <button className={`cat${collapsed ? " collapsed" : ""}`} onClick={onToggle}>
                    <Icon className="cat-caret" name="chevron" size={13} /> {label}
                </button>
                {onAdd && (
                    <button type="button" className="cat-add" onClick={onAdd} aria-label={`Créer un salon dans ${label}`}>
                        <Icon name="plus" size={14} />
                    </button>
                )}
                {reorder}
            </div>
            {!collapsed && <div className="chan-list">{children}</div>}
        </section>
    );
}


function ChannelRow({ channel, active, onClick, onSettings, unread = 0, onMarkRead, onCopyLink, onToggleFavorite, isFavorite }) {
    const menu = useContextMenu();

    const items = [
        { id: "open", label: "Ouvrir le salon", icon: "hash", run: onClick },
        onMarkRead && unread > 0
            ? { id: "read", label: "Marquer comme lu", icon: "check", run: () => onMarkRead(channel) }
            : null,
        onCopyLink ? { id: "copy", label: "Copier le lien", icon: "invite", run: () => onCopyLink(channel) } : null,
        onToggleFavorite
            ? {
                  id: "favorite",
                  label: isFavorite?.(channel.channelId) ? "Retirer des favoris" : "Mettre en favori",
                  icon: "crown",
                  run: () => onToggleFavorite(channel.channelId),
              }
            : null,
        onSettings ? { separator: true } : null,
        onSettings ? { id: "settings", label: "Configurer", icon: "settings", run: onSettings } : null,
    ].filter(Boolean);

    return (
        <div
            className={`chan-shell${active ? " is-active" : ""}${unread > 0 && !active ? " has-unread" : ""}`}
            {...menu.triggerProps}
        >
            {menu.position && <ContextMenu items={items} position={menu.position} onClose={menu.close} />}
            <button className={`chan${active ? " is-active" : ""}`} data-channel-id={channel.channelId} onClick={onClick}>
                <span className="chan-glyph"><Icon name={channelTypeOf(channel.type).icon ?? "hash"} size={17} /></span>
                <span className="chan-name">{channel.name}</span>
                {unread > 0 && !active && (
                    <span className="chan-unread" aria-label={`${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`}>
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>
            {onSettings && <button type="button" className="chan-settings" onClick={onSettings} aria-label={`Configurer ${channel.name}`}><Icon name="settings" size={14} /></button>}
        </div>
    );
}

function VoiceMembers({ participants }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (!participants.length) return undefined;
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, [participants.length]);

    if (!participants.length) return null;
    return (
        <div className="voice-channel-members">
            {participants.map((participant) => (
                <div className="voice-member" key={participant.userId}>
                    <span className="voice-member-avatar">
                        <Avatar user={participant} size={22} />
                    </span>
                    <span className="voice-member-name">{participant.displayName || participant.handle}</span>
                    <time className="voice-member-duration" dateTime={participant.joinedAt}>
                        {formatVoiceDuration(participant.joinedAt, now)}
                    </time>
                </div>
            ))}
        </div>
    );
}

export default function ChannelSidebar({
    mode,
    guild,
    channels,
    categories = [],
    unread = {},
    voicePresence = {},
    activeChannelId,
    onSelectChannel,
    user,
    onOpenServerSettings,
    onOpenSettings,
    canEditGuild,
    onCreateChannel,
    onCreateInvite,
    onOpenChannelSettings,
    mobileOpen,
    onMobileClose,
    onReorderCategories,
    onReorderChannels,
    onOpenHome,
    homeActive = false,
    onMarkRead,
    organisation,
}) {
    const storageKey = guild ? `qweillo.collapsed.${guild.guildId}` : null;
    const [collapsed, setCollapsed] = useState({});
    const [loadedKey, setLoadedKey] = useState(null);

    if (storageKey && loadedKey !== storageKey) {
        setLoadedKey(storageKey);
        try {
            setCollapsed(JSON.parse(localStorage.getItem(storageKey) || "{}"));
        } catch {
            setCollapsed({});
        }
    }

    const toggle = (key) =>
        setCollapsed((current) => {
            const next = { ...current, [key]: !current[key] };
            if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });

    const voiceChannels = channels.filter((c) => isVoiceChannel(c.type));
    const textChannels = channels.filter((c) => !isVoiceChannel(c.type));
    const groups = groupChannelsByCategory(categories, channels);

    const [arranging, setArranging] = useState(false);

    const moveCategory = (from, to) => {
        const ordered = moved(categories.map((category) => category.categoryId), from, to);
        if (ordered !== categories.map((category) => category.categoryId)) onReorderCategories?.(ordered);
    };

    const moveChannel = (group) => (from, to) => {
        const ordered = moved(group.channels.map((channel) => channel.channelId), from, to);
        onReorderChannels?.(group.categoryId ?? null, ordered);
    };

    const favorites = channels.filter((channel) => organisation?.isChannelFavorite(channel.channelId));

    const visible = (channel) =>
        !organisation?.hideReadChannels ||
        channel.channelId === activeChannelId ||
        (unread[channel.channelId] ?? 0) > 0 ||
        organisation?.isChannelFavorite(channel.channelId);

    const channelActions = {
        onMarkRead,
        onToggleFavorite: organisation?.toggleChannelFavorite,
        isFavorite: organisation?.isChannelFavorite,
        onCopyLink: (channel) => {
            const link = `${window.location.origin}/channels/${channel.channelId}`;
            navigator.clipboard?.writeText(link).then(
                () => announce("Lien du salon copié."),
                () => announce("Le lien n’a pas pu être copié.")
            );
        },
    };

    const renderChannel = (c) =>
        isVoiceChannel(c.type) ? (
            <div className="voice-channel" key={c.channelId}>
                <ChannelRow
                    channel={c}
                    unread={unread[c.channelId] ?? 0}
                    active={c.channelId === activeChannelId}
                    onClick={() => { onSelectChannel(c.channelId); onMobileClose?.(); }}
                    onSettings={onOpenChannelSettings ? () => onOpenChannelSettings(c) : null}
                    {...channelActions}
                />
                <VoiceMembers participants={voicePresence[c.channelId] ?? []} />
            </div>
        ) : (
            <ChannelRow
                key={c.channelId}
                unread={unread[c.channelId] ?? 0}
                channel={c}
                active={c.channelId === activeChannelId}
                onClick={() => { onSelectChannel(c.channelId); onMobileClose?.(); }}
                onSettings={onOpenChannelSettings ? () => onOpenChannelSettings(c) : null}
                {...channelActions}
            />
        );

    const scrollRef = useRef(null);
    const [scrolled, setScrolled] = useState(false);
    const onScroll = () => setScrolled((scrollRef.current?.scrollTop ?? 0) >= 36);

    return (
        <aside className={`sidebar${mobileOpen ? " is-mobile-open" : ""}`}>
            <button className="sidebar-mobile-close" onClick={onMobileClose} aria-label="Fermer les salons"><Icon name="close" /></button>
            {mode === "guild" && guild ? (
                <Banner
                    guild={guild}
                    onOpenSettings={onOpenServerSettings}
                    onCreateInvite={canEditGuild ? onCreateInvite : null}
                    canEdit={canEditGuild}
                    scrolled={scrolled}
                />
            ) : (
                <div className="sidebar-plain-head">
                    <h1>Messages privés</h1>
                </div>
            )}

            <div className="sidebar-scroll" ref={scrollRef} onScroll={onScroll}>
                {mode === "guild" ? (
                    <>
                        <button
                            type="button"
                            className={`sidebar-home${homeActive ? " is-active" : ""}`}
                            onClick={() => { onOpenHome?.(); onMobileClose?.(); }}
                            aria-current={homeActive ? "page" : undefined}
                        >
                            <Icon name="home" size={16} /> Accueil
                        </button>
                        {canEditGuild && categories.length > 0 && (
                            <div className="sidebar-arrange">
                                <button
                                    type="button"
                                    onClick={() => setArranging((current) => !current)}
                                    aria-pressed={arranging}
                                    className={arranging ? "is-active" : ""}
                                >
                                    {arranging ? "Terminer le rangement" : "Ranger les salons"}
                                </button>
                            </div>
                        )}
                        {favorites.length > 0 && (
                            <Category
                                label="Favoris"
                                collapsed={collapsed.favorites}
                                onToggle={() => toggle("favorites")}
                                onAdd={canEditGuild ? () => onCreateChannel?.(null) : null}
                            >
                                {favorites.map(renderChannel)}
                            </Category>
                        )}
                        {categories.length > 0 ? (
                            groups.map((group) => {
                                const key = `cat-${group.categoryId ?? "none"}`;
                                const categoryIndex = categories.findIndex((item) => item.categoryId === group.categoryId);
                                return (
                                    <Category
                                        key={key}
                                        label={group.name}
                                        collapsed={collapsed[key]}
                                        onToggle={() => toggle(key)}
                                        onAdd={canEditGuild ? () => onCreateChannel?.(group.categoryId) : null}
                                        reorder={arranging && categoryIndex >= 0 ? (
                                            <SidebarReorder
                                                label={`la catégorie ${group.name}`}
                                                index={categoryIndex}
                                                count={categories.length}
                                                onMove={moveCategory}
                                            />
                                        ) : null}
                                    >
                                        {group.channels.length === 0
                                            ? <p className="cat-empty">Aucun salon dans cette catégorie.</p>
                                            : group.channels.filter(visible).map((channel, channelIndex) => (
                                                arranging ? (
                                                    <div className="chan-arrange" key={channel.channelId}>
                                                        {renderChannel(channel)}
                                                        <SidebarReorder
                                                            label={`le salon ${channel.name}`}
                                                            index={channelIndex}
                                                            count={group.channels.length}
                                                            onMove={moveChannel(group)}
                                                        />
                                                    </div>
                                                ) : renderChannel(channel)
                                            ))}
                                    </Category>
                                );
                            })
                        ) : (
                        <>
                        <Category
                            label="Salons"
                            collapsed={collapsed.text}
                            onToggle={() => toggle("text")}
                            onAdd={canEditGuild ? () => onCreateChannel?.(null) : null}
                        >
                            {textChannels.map((c) => (
                                <ChannelRow
                                    key={c.channelId}
                                    unread={unread[c.channelId] ?? 0}
                                    channel={c}
                                    active={c.channelId === activeChannelId}
                                    onClick={() => { onSelectChannel(c.channelId); onMobileClose?.(); }}
                                    onSettings={onOpenChannelSettings ? () => onOpenChannelSettings(c) : null}
                                />
                            ))}
                        </Category>
                        {voiceChannels.length > 0 && (
                            <Category
                                label="Salons vocaux"
                                collapsed={collapsed.voice}
                                onToggle={() => toggle("voice")}
                                onAdd={canEditGuild ? () => onCreateChannel?.(null) : null}
                            >
                                {voiceChannels.map((c) => (
                                    <div className="voice-channel" key={c.channelId}>
                                        <ChannelRow
                                            channel={c}
                                            unread={unread[c.channelId] ?? 0}
                                            active={c.channelId === activeChannelId}
                                            onClick={() => { onSelectChannel(c.channelId); onMobileClose?.(); }}
                                            onSettings={onOpenChannelSettings ? () => onOpenChannelSettings(c) : null}
                                        />
                                        <VoiceMembers participants={voicePresence[c.channelId] ?? []} />
                                    </div>
                                ))}
                            </Category>
                        )}
                        </>
                        )}
                    </>
                ) : (
                    <ul className="dm-list">
                        {channels.length === 0 && <li className="dm-empty">Aucune conversation pour l'instant.</li>}
                        {channels.map((c) => (
                            <li key={c.channelId}>
                                <button
                                    className={`dm${c.channelId === activeChannelId ? " is-active" : ""}`}
                                    onClick={() => { onSelectChannel(c.channelId); onMobileClose?.(); }}
                                >
                                    <Avatar user={c.user} size={34} presence={c.user?.presence} />
                                    <span className="dm-name">{c.user?.displayName || c.user?.handle}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <UserBar user={user} onOpenSettings={onOpenSettings} />
        </aside>
    );
}
