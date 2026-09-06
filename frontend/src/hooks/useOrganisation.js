import { useCallback, useEffect, useState } from "react";

import { api } from "../lib/api.js";

const EMPTY = { folders: [], guilds: [], favoriteChannels: [], hideReadChannels: false };

export default function useOrganisation() {
    const [data, setData] = useState(EMPTY);
    const [loaded, setLoaded] = useState(false);

    const reload = useCallback(
        () =>
            api("/organisation")
                .then(setData)
                .catch(() => setData(EMPTY))
                .finally(() => setLoaded(true)),
        []
    );

    useEffect(() => {
        reload();
    }, [reload]);

    const toggleChannelFavorite = useCallback(
        async (channelId) => {
            const isFavorite = !data.favoriteChannels.includes(channelId);
            setData((current) => ({
                ...current,
                favoriteChannels: isFavorite
                    ? [...current.favoriteChannels, channelId]
                    : current.favoriteChannels.filter((id) => id !== channelId),
            }));
            await api(`/organisation/channels/${channelId}`, {
                method: "PUT",
                body: { isFavorite },
            }).catch(reload);
        },
        [data.favoriteChannels, reload]
    );

    const toggleGuildFavorite = useCallback(
        async (guildId) => {
            const current = data.guilds.find((row) => row.guildId === guildId);
            const isFavorite = !current?.isFavorite;
            setData((state) => ({
                ...state,
                guilds: [
                    ...state.guilds.filter((row) => row.guildId !== guildId),
                    { guildId, folderId: current?.folderId ?? null, isFavorite, position: current?.position ?? 0 },
                ],
            }));
            await api(`/organisation/guilds/${guildId}`, { method: "PUT", body: { isFavorite } }).catch(reload);
        },
        [data.guilds, reload]
    );

    const setHideReadChannels = useCallback(
        async (hide) => {
            setData((current) => ({ ...current, hideReadChannels: hide }));
            await api("/organisation/display", { method: "PUT", body: { hideReadChannels: hide } }).catch(reload);
        },
        [reload]
    );

    return {
        ...data,
        loaded,
        reload,
        isChannelFavorite: (channelId) => data.favoriteChannels.includes(channelId),
        isGuildFavorite: (guildId) => data.guilds.some((row) => row.guildId === guildId && row.isFavorite),
        toggleChannelFavorite,
        toggleGuildFavorite,
        setHideReadChannels,
    };
}
