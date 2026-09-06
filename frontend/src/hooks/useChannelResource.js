import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { connectSocket, onChannelSubscribed } from "../lib/socket.js";

export function useChannelResource(channelId, path, events = "") {
    const [state, setState] = useState({ key: null, data: null, error: null });
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((current) => current + 1), []);
    const key = path ? `${channelId}:${path}` : null;
    const request = useRef(0);
    const replace = useCallback(
        (data) => {
            request.current += 1;
            setState({ key, data, error: null });
        },
        [key]
    );
    useEffect(() => {
        if (!path) return undefined;
        const sequence = ++request.current;
        let active = true;
        api(`/channels/${channelId}/${path}`)
            .then((data) => active && sequence === request.current && setState({ key, data, error: null }))
            .catch(
                (error) =>
                    active &&
                    sequence === request.current &&
                    setState((previous) => ({
                        key,
                        data: previous.key === key ? previous.data : null,
                        error: error instanceof ApiError ? error.message : "Connexion interrompue. Réessayez.",
                    }))
            );
        return () => {
            active = false;
        };
    }, [channelId, path, key, version]);
    useEffect(() => {
        if (!events || !path) return undefined;
        const socket = connectSocket();
        const names = events.split(" ").filter(Boolean);
        let timer;
        const refresh = (payload) => {
            if (payload?.channelId != null && Number(payload.channelId) !== Number(channelId)) return;
            clearTimeout(timer);
            timer = setTimeout(reload, 100);
        };
        names.forEach((name) => socket.on(name, refresh));
        socket.on("connect", refresh);
        const unsubscribe = onChannelSubscribed(refresh);
        return () => {
            unsubscribe();
            clearTimeout(timer);
            names.forEach((name) => socket.off(name, refresh));
            socket.off("connect", refresh);
        };
    }, [channelId, events, path, reload]);
    return {
        data: state.key === key ? state.data : null,
        error: state.key === key ? state.error : null,
        loading: Boolean(path && state.key !== key),
        reload,
        replace,
    };
}
