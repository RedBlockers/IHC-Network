import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../lib/api";
import { getSocket, subscribeGuild } from "../lib/socket";
import { appendUniqueBy } from "../lib/collections.js";
import { useAuth } from "../context/useAuth.js";
import { useCustomization } from "../context/useCustomization.js";

import GuildRail from "../components/workspace/GuildRail.jsx";
import CommandBar from "../components/workspace/CommandBar.jsx";
import QuickSwitcher from "../components/workspace/QuickSwitcher.jsx";
import ChannelSidebar from "../components/workspace/ChannelSidebar.jsx";
import MemberList from "../components/workspace/MemberList.jsx";
import ChatView from "../components/chat/ChatView.jsx";
import ChannelAccessGate from "../components/chat/ChannelAccessGate.jsx";
import CreateGuildModal from "../components/workspace/CreateGuildModal.jsx";
import EmptyState from "../components/workspace/EmptyState.jsx";
import HomeView from "../components/workspace/HomeView.jsx";
import GuildHome from "../components/workspace/GuildHome.jsx";
import UserPopout from "../components/ui/UserPopout.jsx";
import JoinCommunityModal from "../components/workspace/JoinCommunityModal.jsx";
import CreateInviteModal from "../components/workspace/CreateInviteModal.jsx";
import CreateChannelModal from "../components/workspace/CreateChannelModal.jsx";
import NotificationCenter from "../components/workspace/NotificationCenter.jsx";
import useInbox from "../hooks/useInbox.js";
import useResizablePanel from "../hooks/useResizablePanel.js";
import useOrganisation from "../hooks/useOrganisation.js";
import useViewportInset from "../hooks/useViewportInset.js";
import MobileTabs from "../components/workspace/MobileTabs.jsx";
import { activeTab, showsTabBar } from "../lib/mobileShell.js";
import { insertIntoComposer } from "../lib/composerBridge.js";
import { isTyping, resolve } from "../lib/shortcuts.js";
import { announce } from "../lib/announce.js";
import CallDock from "../components/media/CallDock.jsx";
import SanctionModal from "../components/workspace/SanctionModal.jsx";
import OnboardingGate from "../components/workspace/OnboardingGate.jsx";
import { useVoiceSession } from "../context/useVoiceSession.js";
import { isVoiceChannel } from "../lib/voiceChannels.js";

const VoiceRoom = lazy(() => import("../components/media/VoiceRoom.jsx"));
const SettingsModal = lazy(() => import("../components/settings/SettingsModal.jsx"));
const ServerSettingsModal = lazy(() => import("../components/workspace/ServerSettingsModal.jsx"));
const ChannelPermissionModal = lazy(() => import("../components/workspace/ChannelPermissionModal.jsx"));

const HOME = "home";
const LOCATION_KEY = "qweillo.location";

function readSavedLocation() {
    try {
        const saved = JSON.parse(window.localStorage.getItem(LOCATION_KEY) ?? "null");
        if (saved && (saved.guildId === HOME || Number.isInteger(saved.guildId))) return saved;
    } catch {}
    return null;
}

export default function Workspace() {
    const { user } = useAuth();
    const { setGuildAccent } = useCustomization();
    const voice = useVoiceSession();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedGuild = Number(searchParams.get("guild"));

    const [guilds, setGuilds] = useState([]);
    const [activeGuildId, setActiveGuildId] = useState(() => {
        if (Number.isInteger(requestedGuild) && requestedGuild > 0) return requestedGuild;
        return readSavedLocation()?.guildId ?? HOME;
    });
    const [activeGuild, setActiveGuild] = useState(null);
    const [voicePresence, setVoicePresence] = useState({});
    const [directChannels, setDirectChannels] = useState([]);
    const [activeChannelId, setActiveChannelId] = useState(null);

    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [channelCreating, setChannelCreating] = useState(false);
    const [newChannelCategoryId, setNewChannelCategoryId] = useState("");
    const [inviting, setInviting] = useState(false);
    const [membersOpen, setMembersOpen] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [userSettings, setUserSettings] = useState(false);
    const [serverSettings, setServerSettings] = useState(false);
    const [popout, setPopout] = useState(null);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [channelSettings, setChannelSettings] = useState(null);
    const [sanctioning, setSanctioning] = useState(null);
    const [herePing, setHerePing] = useState(null);
    const [unread, setUnread] = useState({});
    const requestedChannelRef = useRef(
        Number.isInteger(requestedGuild) && requestedGuild > 0 ? null : (readSavedLocation()?.channelId ?? null)
    );
    const inbox = useInbox();
    const memberPanel = useResizablePanel("qweillo.members.width");
    const organisation = useOrganisation();
    useViewportInset();

    const refreshGuilds = useCallback(async () => {
        const { guilds: list } = await api("/users/me/guilds");
        setGuilds(list);
        return list;
    }, []);

    const refreshDirectChannels = useCallback(async () => {
        const { channels } = await api("/users/me/channels");
        setDirectChannels(channels);
        return channels;
    }, []);

    useEffect(() => {
        const timer = setTimeout(refreshGuilds, 0);
        return () => clearTimeout(timer);
    }, [refreshGuilds]);

    useEffect(() => {
        const socket = getSocket();
        const onHerePing = (ping) => setHerePing(ping);
        socket?.on("mention:here", onHerePing);
        return () => socket?.off("mention:here", onHerePing);
    }, []);

    useEffect(() => {
        if (!herePing) return undefined;
        const timer = window.setTimeout(() => setHerePing(null), 5000);
        return () => window.clearTimeout(timer);
    }, [herePing]);

    useEffect(() => {
        if (!searchParams.has("guild")) return;
        const timer = setTimeout(() => setSearchParams({}, { replace: true }), 0);
        return () => clearTimeout(timer);
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                LOCATION_KEY,
                JSON.stringify({ guildId: activeGuildId, channelId: activeChannelId })
            );
        } catch {}
    }, [activeGuildId, activeChannelId]);

    useEffect(() => {
        let cancelled = false;
        let unsubscribeGuild = null;

        async function load() {
            if (activeGuildId === HOME) {
                const channels = await refreshDirectChannels();
                if (cancelled) return;
                setActiveGuild(null);
                setVoicePresence({});
                const wanted = requestedChannelRef.current;
                requestedChannelRef.current = null;
                setActiveChannelId(channels.some((c) => c.channelId === wanted) ? wanted : null);
            } else {
                let guild;
                try {
                    ({ guild } = await api(`/guilds/${activeGuildId}`));
                } catch {
                    if (!cancelled) setActiveGuildId(HOME);
                    return;
                }
                if (cancelled) return;
                setActiveGuild(guild);
                setVoicePresence(guild.voicePresence ?? {});
                const requested = guild.channels.find((c) => c.channelId === requestedChannelRef.current);
                setActiveChannelId(requested?.channelId ?? null);
                requestedChannelRef.current = null;
                unsubscribeGuild = subscribeGuild(guild.guildId);
            }
        }

        load();
        return () => {
            cancelled = true;
            unsubscribeGuild?.();
        };
    }, [activeGuildId, refreshDirectChannels]);

    useEffect(() => {
        const media = window.matchMedia("(min-width: 1280px)");
        const sync = () => setMembersOpen(activeGuildId !== HOME && media.matches);
        const timer = setTimeout(sync, 0);
        media.addEventListener("change", sync);
        return () => {
            clearTimeout(timer);
            media.removeEventListener("change", sync);
        };
    }, [activeGuildId]);

    useEffect(() => {
        setGuildAccent(activeGuild?.accent ?? null);
    }, [activeGuild, setGuildAccent]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket || activeGuildId === HOME) return undefined;

        const onChannelCreated = (channel) => {
            if (Number(channel.guildId) !== Number(activeGuildId)) return;
            setActiveGuild((g) => (g ? { ...g, channels: appendUniqueBy(g.channels, channel, "channelId") } : g));
        };
        const onChannelUpdated = (channel) => {
            if (Number(channel.guildId) !== Number(activeGuildId)) return;
            setActiveGuild((guild) =>
                guild
                    ? {
                          ...guild,
                          channels: guild.channels.map((item) =>
                              item.channelId === channel.channelId ? { ...item, ...channel } : item
                          ),
                      }
                    : guild
            );
        };
        const onChannelDeleted = ({ channelId, guildId }) => {
            if (Number(guildId) !== Number(activeGuildId)) return;
            setActiveGuild((guild) =>
                guild ? { ...guild, channels: guild.channels.filter((item) => item.channelId !== channelId) } : guild
            );
            setActiveChannelId((current) => (current === channelId ? null : current));
        };
        const onMemberJoined = ({ guildId, member }) => {
            if (Number(guildId) !== Number(activeGuildId)) return;
            setActiveGuild((g) =>
                g && !g.members.some((m) => m.userId === member.userId) ? { ...g, members: [...g.members, member] } : g
            );
        };
        const onPresence = ({ userId, status }) => {
            setActiveGuild((g) =>
                g ? { ...g, members: g.members.map((m) => (m.userId === userId ? { ...m, presence: status } : m)) } : g
            );
        };
        const onGuildUpdate = (updated) => applyGuildUpdate(updated);
        const onOwnerChanged = ({ guildId }) => {
            if (Number(guildId) !== Number(activeGuildId)) return;
            api(`/guilds/${guildId}`)
                .then(({ guild }) => applyGuildUpdate(guild))
                .catch(() => {});
        };
        const onGuildDeleted = ({ guildId }) => {
            setGuilds((list) => list.filter((guild) => Number(guild.guildId) !== Number(guildId)));
            if (Number(guildId) === Number(activeGuildId)) {
                setActiveGuildId(HOME);
                setActiveGuild(null);
                setActiveChannelId(null);
                setServerSettings(false);
            }
        };
        const onVoicePresence = ({ channelId, participants }) => {
            setVoicePresence((current) => ({ ...current, [channelId]: participants }));
        };
        const onUserProfile = (profile) => {
            setActiveGuild((guild) =>
                guild
                    ? {
                          ...guild,
                          members: guild.members.map((member) =>
                              member.userId === profile.userId ? { ...member, ...profile } : member
                          ),
                      }
                    : guild
            );
        };
        const onMemberRoles = ({ userId, roles }) => {
            setActiveGuild((guild) =>
                guild
                    ? {
                          ...guild,
                          members: guild.members.map((member) =>
                              member.userId === userId ? { ...member, roles } : member
                          ),
                      }
                    : guild
            );
        };

        socket.on("channel:created", onChannelCreated);
        socket.on("channel:updated", onChannelUpdated);
        socket.on("channel:deleted", onChannelDeleted);
        socket.on("guild:owner", onOwnerChanged);
        socket.on("guild:deleted", onGuildDeleted);
        socket.on("member:joined", onMemberJoined);
        socket.on("presence:update", onPresence);
        socket.on("guild:update", onGuildUpdate);
        socket.on("voice:presence", onVoicePresence);
        socket.on("user:profile", onUserProfile);
        socket.on("member:roles", onMemberRoles);
        return () => {
            socket.off("channel:created", onChannelCreated);
            socket.off("channel:updated", onChannelUpdated);
            socket.off("channel:deleted", onChannelDeleted);
            socket.off("guild:owner", onOwnerChanged);
            socket.off("guild:deleted", onGuildDeleted);
            socket.off("member:joined", onMemberJoined);
            socket.off("presence:update", onPresence);
            socket.off("guild:update", onGuildUpdate);
            socket.off("voice:presence", onVoicePresence);
            socket.off("user:profile", onUserProfile);
            socket.off("member:roles", onMemberRoles);
        };
    }, [activeGuildId]);

    const channels = useMemo(
        () => (activeGuildId === HOME ? directChannels : (activeGuild?.channels ?? [])),
        [activeGuild, activeGuildId, directChannels]
    );

    const channelKey = channels.map((channel) => channel.channelId).join(",");
    useEffect(() => {
        if (!channelKey) return undefined;
        let cancelled = false;
        api(`/notifications/unread?channels=${channelKey}`)
            .then(({ unread: counts }) => !cancelled && setUnread(counts))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [channelKey, activeChannelId]);

    const activeChannel = channels.find((c) => c.channelId === activeChannelId) ?? null;

    const markChannelRead = useCallback(async (channel) => {
        setUnread((current) => ({ ...current, [channel.channelId]: 0 }));
        await api(`/notifications/read/${channel.channelId}`, { method: "PUT" }).catch(() => {});
    }, []);

    const openFriend = useCallback(
        async (userId) => {
            const list = await refreshDirectChannels();
            const channel = list.find((item) => item.user?.userId === userId);
            if (channel) setActiveChannelId(channel.channelId);
        },
        [refreshDirectChannels]
    );

    useEffect(() => {
        const onKeyDown = (event) => {
            const shortcut = resolve(event, { typing: isTyping(event.target) });
            if (!shortcut) return;

            const actions = {
                palette: () => setSwitcherOpen(true),
                inbox: () => setNotificationsOpen((open) => !open),
                microphone: () => voice.channel && voice.toggleMicrophone(),
                "next-unread": () => {
                    const list = channels.filter((channel) => (unread[channel.channelId] ?? 0) > 0);
                    if (list.length === 0) return;
                    const from = list.findIndex((channel) => channel.channelId === activeChannelId);
                    setActiveChannelId(list[(from + 1) % list.length].channelId);
                },
                "reply-last": () => insertIntoComposer(""),
                "mark-read": () => {
                    if (switcherOpen) return setSwitcherOpen(false);
                    if (notificationsOpen) return setNotificationsOpen(false);
                    if (mobileSidebarOpen) return setMobileSidebarOpen(false);
                    if (activeChannel) markChannelRead(activeChannel);
                    return undefined;
                },
            };

            const run = actions[shortcut.id];
            if (!run) return;
            event.preventDefault();
            run();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        activeChannel,
        activeChannelId,
        channels,
        markChannelRead,
        mobileSidebarOpen,
        notificationsOpen,
        switcherOpen,
        unread,
        voice,
    ]);

    const memberAction = useCallback(
        async (action, member) => {
            if (action === "profile") {
                setPopout({ member, position: { x: window.innerWidth / 2, y: window.innerHeight / 3 } });
                return;
            }
            if (action === "mention") {
                insertIntoComposer(`@${member.handle} `);
                return;
            }
            if (action === "message") await openFriend(member.userId);
        },
        [openFriend]
    );

    const reorderCategories = useCallback(
        async (order) => {
            setActiveGuild((current) => {
                if (!current) return current;
                const byId = new Map(current.categories.map((category) => [category.categoryId, category]));
                return { ...current, categories: order.map((id) => byId.get(id)).filter(Boolean) };
            });
            try {
                await api(`/guilds/${activeGuildId}/categories/order`, { method: "PATCH", body: { order } });
            } catch {
                const detail = await api(`/guilds/${activeGuildId}`);
                setActiveGuild(detail);
            }
        },
        [activeGuildId]
    );

    const reorderChannels = useCallback(
        async (categoryId, order) => {
            setActiveGuild((current) => {
                if (!current) return current;
                const rank = new Map(order.map((id, index) => [id, index]));
                return {
                    ...current,
                    channels: current.channels.map((channel) =>
                        rank.has(channel.channelId)
                            ? { ...channel, categoryId, position: rank.get(channel.channelId) }
                            : channel
                    ),
                };
            });
            try {
                await api(`/guilds/${activeGuildId}/channels/order`, { method: "PATCH", body: { categoryId, order } });
            } catch {
                const detail = await api(`/guilds/${activeGuildId}`);
                setActiveGuild(detail);
            }
        },
        [activeGuildId]
    );

    const paletteCommands = useMemo(() => {
        const list = [
            {
                id: "notifications",
                label: "Ouvrir la boîte de réception",
                hint: "Notifications",
                run: () => setNotificationsOpen(true),
            },
            { id: "settings", label: "Ouvrir mes réglages", hint: "Compte", run: () => setUserSettings(true) },
            {
                id: "hide-read",
                label: organisation.hideReadChannels ? "Afficher tous les salons" : "Masquer les salons lus",
                hint: "Affichage",
                run: () => organisation.setHideReadChannels(!organisation.hideReadChannels),
            },
            { id: "join", label: "Rejoindre une communauté", hint: "Communautés", run: () => setJoining(true) },
            { id: "create-guild", label: "Créer une communauté", hint: "Communautés", run: () => setCreating(true) },
        ];
        if (activeGuild) {
            list.push({
                id: "invite",
                label: "Créer une invitation",
                hint: activeGuild.name,
                run: () => setInviting(true),
            });
            list.push({
                id: "server-settings",
                label: "Ouvrir l’administration",
                hint: activeGuild.name,
                run: () => setServerSettings(true),
            });
        }
        if (voice.channel) {
            list.push({
                id: "leave-voice",
                label: "Quitter le salon vocal",
                hint: voice.channel.name,
                run: voice.leave,
            });
        }
        return list;
    }, [activeGuild, organisation, voice]);

    useEffect(() => {
        if (activeChannel) announce(`Salon ${activeChannel.name}.`);
    }, [activeChannel]);

    const myRole = useMemo(
        () => activeGuild?.members?.find((m) => m.userId === user.userId)?.role ?? null,
        [activeGuild, user.userId]
    );
    const canModerate =
        myRole === "owner" ||
        myRole === "admin" ||
        activeGuild?.permissions?.some((permission) =>
            ["MANAGE_GUILD", "MANAGE_CHANNELS", "MANAGE_ROLES", "MANAGE_MESSAGES"].includes(permission)
        );
    const canManageChannels = myRole === "owner" || activeGuild?.permissions?.includes("MANAGE_CHANNELS");
    const canManageRoles = myRole === "owner" || activeGuild?.permissions?.includes("MANAGE_ROLES");
    const showMembers = Boolean(activeGuild && membersOpen);
    const commandContext = activeGuild?.name || "Messages privés";

    function applyGuildUpdate(updated) {
        setActiveGuild((g) => (g && g.guildId === updated.guildId ? { ...g, ...updated } : g));
        setGuilds((list) => list.map((g) => (g.guildId === updated.guildId ? { ...g, ...updated } : g)));
    }

    async function onGuildCreated(guildId) {
        setCreating(false);
        await refreshGuilds();
        setActiveGuildId(guildId);
    }

    async function onGuildJoined(guildId) {
        setJoining(false);
        await refreshGuilds();
        setActiveGuildId(guildId);
    }

    function onChannelCreated(channel) {
        setChannelCreating(false);
        setActiveGuild((guild) =>
            guild ? { ...guild, channels: appendUniqueBy(guild.channels, channel, "channelId") } : guild
        );
        setActiveChannelId(channel.channelId);
    }

    async function navigateNotification(notification) {
        setNotificationsOpen(false);
        if (!notification.channelId) return;
        if (notification.context.guildId) {
            if (Number(activeGuildId) === Number(notification.context.guildId)) {
                setActiveChannelId(notification.channelId);
                return;
            }
            requestedChannelRef.current = notification.channelId;
            setActiveGuildId(notification.context.guildId);
            return;
        }
        setActiveGuildId(HOME);
        const list = await refreshDirectChannels();
        if (list.some((channel) => channel.channelId === notification.channelId))
            setActiveChannelId(notification.channelId);
    }

    const mobileTab = activeTab({
        notificationsOpen,
        settingsOpen: userSettings,
        atHome: activeGuildId === HOME,
        channel: activeChannelId,
    });

    function selectMobileTab(tab) {
        setNotificationsOpen(tab === "alerts");
        setUserSettings(tab === "profile");
        if (tab === "home") {
            setActiveGuildId(HOME);
            setActiveChannelId(null);
        }
        if (tab === "messages") setActiveGuildId(HOME);
        if (tab === "communities" && activeGuildId === HOME) setMobileSidebarOpen(true);
    }

    return (
        <div
            className={`workspace${showMembers ? " has-context" : ""}`}
            style={showMembers ? { "--members-width": `${memberPanel.width}px` } : undefined}
            data-context={isVoiceChannel(activeChannel?.type) ? "voice" : activeChannel ? "text" : "home"}
        >
            <CommandBar
                context={commandContext}
                onOpenSwitcher={() => setSwitcherOpen(true)}
                onToggleChannels={() => setMobileSidebarOpen((open) => !open)}
                unreadCount={inbox.unreadCount}
                onOpenNotifications={() => setNotificationsOpen(true)}
            />
            {herePing && (
                <button
                    type="button"
                    className="mention-pulse"
                    onClick={() => {
                        setActiveChannelId(herePing.channelId);
                        setHerePing(null);
                    }}
                >
                    <span>@here</span>
                    <strong>{herePing.actor.displayName || herePing.actor.handle}</strong>
                    <small>appelle les membres présents</small>
                </button>
            )}
            <GuildRail
                guilds={guilds}
                activeGuildId={activeGuildId}
                onSelect={setActiveGuildId}
                onCreate={() => setCreating(true)}
                onOpenSettings={() => setUserSettings(true)}
            />

            {mobileSidebarOpen && (
                <button
                    className="sidebar-scrim"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-label="Fermer les salons"
                />
            )}

            <ChannelSidebar
                mode={activeGuildId === HOME ? "home" : "guild"}
                guild={activeGuild}
                channels={channels}
                categories={activeGuild?.categories ?? []}
                unread={unread}
                voicePresence={voicePresence}
                activeChannelId={activeChannelId}
                onSelectChannel={setActiveChannelId}
                user={user}
                canEditGuild={canModerate}
                onOpenServerSettings={() => setServerSettings(true)}
                onOpenSettings={() => setUserSettings(true)}
                onMarkRead={markChannelRead}
                organisation={organisation}
                onOpenHome={() => setActiveChannelId(null)}
                homeActive={activeChannelId == null}
                onCreateChannel={(categoryId) => {
                    setNewChannelCategoryId(categoryId ? String(categoryId) : "");
                    setChannelCreating(true);
                }}
                onReorderCategories={reorderCategories}
                onReorderChannels={reorderChannels}
                onCreateInvite={() => setInviting(true)}
                onOpenChannelSettings={canManageChannels ? setChannelSettings : null}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
            />

            <div className="stage">
                {isVoiceChannel(activeChannel?.type) ? (
                    <Suspense
                        fallback={
                            <div className="media-loading">
                                <span />
                                Chargement du moteur média…
                            </div>
                        }
                    >
                        <VoiceRoom
                            channel={activeChannel}
                            communityName={activeGuild?.name}
                            onToggleMembers={() => setMembersOpen((open) => !open)}
                        />
                    </Suspense>
                ) : activeChannel ? (
                    <ChannelAccessGate key={activeChannel.channelId} channel={activeChannel}>
                        <ChatView
                            key={activeChannel.channelId}
                            channel={activeChannel}
                            contextLabel={activeGuild?.name}
                            currentUserId={user.userId}
                            members={activeGuild?.members ?? []}
                            canModerate={canModerate}
                            roles={activeGuild?.roles ?? []}
                            onToggleMembers={activeGuild ? () => setMembersOpen((open) => !open) : null}
                            suspended={
                                activeGuild?.suspendedAt
                                    ? { since: activeGuild.suspendedAt, reason: activeGuild.suspendedReason }
                                    : null
                            }
                        />
                    </ChannelAccessGate>
                ) : activeGuildId === HOME ? (
                    <HomeView
                        user={user}
                        guilds={guilds}
                        conversations={directChannels}
                        onSelectGuild={setActiveGuildId}
                        onSelectConversation={setActiveChannelId}
                        onCreate={() => setCreating(true)}
                        onJoin={() => setJoining(true)}
                        onOpenFriend={openFriend}
                        onDirectChannelsChanged={refreshDirectChannels}
                    />
                ) : activeGuild ? (
                    <GuildHome
                        guild={activeGuild}
                        unread={unread}
                        voicePresence={voicePresence}
                        onOpenChannel={setActiveChannelId}
                        onOpenMembers={() => setMembersOpen(true)}
                        onInvite={() => setInviting(true)}
                        onCreateChannel={() => setChannelCreating(true)}
                        onOpenSettings={() => setServerSettings(true)}
                        canManageChannels={canManageChannels}
                        canModerate={canModerate}
                    />
                ) : (
                    <EmptyState mode={activeGuildId === HOME ? "home" : "guild"} />
                )}
            </div>

            {showMembers && (
                <>
                    <button
                        className="members-scrim"
                        onClick={() => setMembersOpen(false)}
                        aria-label="Fermer la liste des membres"
                    />
                    <span
                        className={`panel-grip${memberPanel.dragging ? " is-dragging" : ""}`}
                        {...memberPanel.handleProps}
                    />
                    <MemberList
                        members={activeGuild.members}
                        ownerId={activeGuild.ownerId}
                        onMemberClick={(member, e) => setPopout({ member, position: { x: e.clientX, y: e.clientY } })}
                        onMemberAction={memberAction}
                        onClose={() => setMembersOpen(false)}
                    />
                </>
            )}

            {activeGuild && <OnboardingGate key={activeGuild.guildId} guild={activeGuild} onDone={() => {}} />}

            {voice.connected && voice.channel?.channelId !== activeChannelId && (
                <CallDock
                    onReturn={(target) => {
                        if (target.guildId) setActiveGuildId(Number(target.guildId));
                        setActiveChannelId(target.channelId);
                    }}
                />
            )}

            {sanctioning && activeGuild && (
                <SanctionModal open guild={activeGuild} member={sanctioning} onClose={() => setSanctioning(null)} />
            )}

            <QuickSwitcher
                open={switcherOpen}
                guilds={guilds}
                channels={channels}
                activeGuild={activeGuild}
                onClose={() => setSwitcherOpen(false)}
                commands={paletteCommands}
                onSelectGuild={setActiveGuildId}
                onSelectChannel={setActiveChannelId}
                onSelectMessage={(message) => {
                    if (message.channel?.channelId) setActiveChannelId(message.channel.channelId);
                }}
            />

            <CreateGuildModal
                open={creating}
                onClose={() => setCreating(false)}
                onCreated={onGuildCreated}
                onJoin={() => {
                    setCreating(false);
                    setJoining(true);
                }}
            />
            <JoinCommunityModal open={joining} onClose={() => setJoining(false)} onJoined={onGuildJoined} />
            {activeGuild && channelCreating && (
                <CreateChannelModal
                    open
                    guild={activeGuild}
                    defaultCategoryId={newChannelCategoryId}
                    onClose={() => setChannelCreating(false)}
                    onCreated={onChannelCreated}
                />
            )}
            {activeGuild && inviting && (
                <CreateInviteModal open guild={activeGuild} onClose={() => setInviting(false)} />
            )}
            {userSettings && (
                <Suspense fallback={null}>
                    <SettingsModal open guilds={guilds} onClose={() => setUserSettings(false)} />
                </Suspense>
            )}
            {serverSettings && activeGuild && (
                <Suspense fallback={null}>
                    <ServerSettingsModal
                        open
                        guild={activeGuild}
                        channelId={activeChannelId}
                        onClose={() => setServerSettings(false)}
                        onUpdated={applyGuildUpdate}
                        onDeleted={(guildId) => {
                            setGuilds((list) => list.filter((guild) => guild.guildId !== guildId));
                            setActiveGuildId(HOME);
                            setActiveGuild(null);
                            setActiveChannelId(null);
                            setServerSettings(false);
                        }}
                    />
                </Suspense>
            )}
            {channelSettings && activeGuild && (
                <Suspense fallback={null}>
                    <ChannelPermissionModal
                        onChannelUpdated={(updated) =>
                            setActiveGuild((guild) =>
                                guild
                                    ? {
                                          ...guild,
                                          channels: guild.channels.map((item) =>
                                              item.channelId === updated.channelId ? { ...item, ...updated } : item
                                          ),
                                      }
                                    : guild
                            )
                        }
                        open
                        guild={activeGuild}
                        channel={channelSettings}
                        onClose={() => setChannelSettings(null)}
                    />
                </Suspense>
            )}

            {popout && (
                <UserPopout
                    member={popout.member}
                    position={popout.position}
                    ownerId={activeGuild?.ownerId}
                    bannerKey={activeGuild?.banner}
                    guildId={activeGuild?.guildId}
                    currentUserId={user.userId}
                    canManageRoles={canManageRoles}
                    canModerate={canModerate}
                    onSanction={setSanctioning}
                    onClose={() => setPopout(null)}
                />
            )}
            <NotificationCenter
                open={notificationsOpen}
                notifications={inbox.notifications}
                filter={inbox.filter}
                counts={inbox.counts}
                digest={inbox.digest}
                loading={inbox.loading}
                loadingMore={inbox.loadingMore}
                hasMore={inbox.hasMore}
                onFilter={inbox.setFilter}
                onLoadMore={inbox.loadMore}
                onClose={() => setNotificationsOpen(false)}
                onRead={inbox.read}
                onReadAll={inbox.readAll}
                onNavigate={navigateNotification}
            />
            <MobileTabs
                active={mobileTab}
                user={user}
                counts={{
                    alerts: inbox.unreadCount,
                    messages: directChannels.reduce((total, channel) => total + (unread[channel.channelId] ?? 0), 0),
                }}
                hidden={!showsTabBar({ channel: activeChannel, call: voice.channel })}
                onSelect={selectMobileTab}
            />
        </div>
    );
}
