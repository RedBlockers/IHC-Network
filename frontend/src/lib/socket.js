import { io } from "socket.io-client";
import { tokenStore } from "./api";

const URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket = null;
const channelSubscriptions = new Map();
const guildSubscriptions = new Map();
const subscriptionListeners = new Set();
const subscriptionRetries = new Map();

export function onChannelSubscribed(listener) {
    subscriptionListeners.add(listener);
    return () => subscriptionListeners.delete(listener);
}

function requestSubscription(kind, id, attempt = 0) {
    const subscriptions = kind === "channel" ? channelSubscriptions : guildSubscriptions;
    const key = `${kind}:${id}`;
    clearTimeout(subscriptionRetries.get(key));
    subscriptionRetries.delete(key);
    const current = socket;
    if (!current?.connected || !subscriptions.has(id)) return;
    current.timeout(5000).emit(`${kind}:subscribe`, id, (error, result) => {
        if (socket !== current || !subscriptions.has(id)) return;
        if (!error && result?.ok) {
            if (kind === "channel") for (const listener of subscriptionListeners) listener({ channelId: id });
        } else if ((error || result?.error === "rate_limited") && attempt < 10) {
            subscriptionRetries.set(
                key,
                setTimeout(() => requestSubscription(kind, id, attempt + 1), 1100)
            );
        }
    });
}

export function connectSocket() {
    if (socket) {
        socket.auth = { token: tokenStore.get() };
        return socket;
    }
    socket = io(URL, {
        auth: { token: tokenStore.get() },
        transports: ["websocket"],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
    });
    socket.on("connect", () => {
        for (const id of channelSubscriptions.keys()) requestSubscription("channel", id);
        for (const id of guildSubscriptions.keys()) requestSubscription("guild", id);
    });
    socket.on("channel:permissions", ({ channelId }) => {
        if (channelSubscriptions.has(Number(channelId))) requestSubscription("channel", Number(channelId));
    });
    return socket;
}

export function getSocket() {
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
        channelSubscriptions.clear();
        guildSubscriptions.clear();
        for (const timer of subscriptionRetries.values()) clearTimeout(timer);
        subscriptionRetries.clear();
    }
}

export function subscribeChannel(channelId) {
    const s = connectSocket();
    const id = Number(channelId);
    const count = channelSubscriptions.get(id) ?? 0;
    channelSubscriptions.set(id, count + 1);
    if (!count && s.connected) requestSubscription("channel", id);
    return () => {
        const remaining = (channelSubscriptions.get(id) ?? 1) - 1;
        if (remaining > 0) channelSubscriptions.set(id, remaining);
        else {
            channelSubscriptions.delete(id);
            clearTimeout(subscriptionRetries.get(`channel:${id}`));
            subscriptionRetries.delete(`channel:${id}`);
            if (s.connected) s.emit("channel:unsubscribe", id);
        }
    };
}

export function subscribeGuild(guildId) {
    const s = connectSocket();
    const id = Number(guildId);
    const count = guildSubscriptions.get(id) ?? 0;
    guildSubscriptions.set(id, count + 1);
    if (!count && s.connected) requestSubscription("guild", id);
    return () => {
        const remaining = (guildSubscriptions.get(id) ?? 1) - 1;
        if (remaining > 0) guildSubscriptions.set(id, remaining);
        else {
            guildSubscriptions.delete(id);
            clearTimeout(subscriptionRetries.get(`guild:${id}`));
            subscriptionRetries.delete(`guild:${id}`);
            if (s.connected) s.emit("guild:unsubscribe", id);
        }
    };
}
