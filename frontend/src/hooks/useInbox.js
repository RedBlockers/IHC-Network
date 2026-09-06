import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

const EMPTY_COUNTS = { total: 0, mentions: 0, threads: 0 };

export default function useInbox() {
    const [filter, setFilter] = useState("all");
    const [notifications, setNotifications] = useState([]);
    const [counts, setCounts] = useState(EMPTY_COUNTS);
    const [cursor, setCursor] = useState(null);
    const [loadedFilter, setLoadedFilter] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [digest, setDigest] = useState(null);
    const knownIds = useRef(new Set());

    useEffect(() => {
        let cancelled = false;
        api(`/notifications?limit=30&filter=${filter}`)
            .then((result) => {
                if (cancelled) return;
                for (const item of result.notifications) knownIds.current.add(item.notificationId);
                setNotifications(result.notifications);
                setCounts(result.counts ?? EMPTY_COUNTS);
                setCursor(result.nextCursor ?? null);
            })
            .finally(() => {
                if (!cancelled) setLoadedFilter(filter);
            });
        return () => {
            cancelled = true;
        };
    }, [filter]);

    const loading = loadedFilter !== filter;

    useEffect(() => {
        let cancelled = false;
        api("/notifications/digest")
            .then((result) => {
                if (!cancelled) setDigest(result);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const socket = getSocket();
        const onNotification = (notification) => {
            const isMention = notification.type === "mention" || notification.type === "reply";
            const isThread = notification.type === "thread";

            if (!knownIds.current.has(notification.notificationId)) {
                knownIds.current.add(notification.notificationId);
                setCounts((current) => ({
                    total: current.total + 1,
                    mentions: current.mentions + (isMention ? 1 : 0),
                    threads: current.threads + (isThread ? 1 : 0),
                }));
            }

            const belongs = filter === "all" || (filter === "mentions" && isMention) || (filter === "threads" && isThread);
            if (!belongs) return;

            setNotifications((current) => [
                notification,
                ...current.filter((item) => item.notificationId !== notification.notificationId),
            ]);
        };

        socket?.on("notification:new", onNotification);
        return () => socket?.off("notification:new", onNotification);
    }, [filter]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await api(`/notifications?limit=30&filter=${filter}&before=${cursor}`);
            for (const item of result.notifications) knownIds.current.add(item.notificationId);
            setNotifications((current) => {
                const known = new Set(current.map((item) => item.notificationId));
                return [...current, ...result.notifications.filter((item) => !known.has(item.notificationId))];
            });
            setCursor(result.nextCursor ?? null);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, filter, loadingMore]);

    const read = useCallback(async (notificationId) => {
        const target = notifications.find((item) => item.notificationId === notificationId);
        if (target && !target.readAt) {
            const now = new Date().toISOString();
            setNotifications((current) =>
                current.map((item) =>
                    item.notificationId === notificationId && !item.readAt ? { ...item, readAt: now } : item
                )
            );
            setCounts((current) => ({ ...current, total: Math.max(current.total - 1, 0) }));
        }
        await api(`/notifications/${notificationId}/read`, { method: "PATCH" });
    }, [notifications]);

    const readAll = useCallback(async () => {
        const now = new Date().toISOString();
        setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || now })));
        setCounts((current) => {
            if (filter === "mentions") return { ...current, total: Math.max(current.total - current.mentions, 0), mentions: 0 };
            if (filter === "threads") return { ...current, total: Math.max(current.total - current.threads, 0), threads: 0 };
            return EMPTY_COUNTS;
        });
        await api(`/notifications/read?filter=${filter}`, { method: "PATCH" });
    }, [filter]);

    return {
        filter,
        setFilter,
        notifications,
        counts,
        unreadCount: counts.total,
        hasMore: Boolean(cursor),
        loading,
        loadingMore,
        loadMore,
        digest,
        read,
        readAll,
    };
}
