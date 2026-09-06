import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { getSocket } from "../../lib/socket.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";

export default function FriendsPanel({ onOpenFriend, onDirectChannelsChanged }) {
    const [friends, setFriends] = useState([]);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        const payload = await api("/friends");
        setFriends(payload.friends);
        return payload.friends;
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => refresh().catch(() => setError("Impossible de charger vos amis.")), 0);
        const socket = getSocket();
        const onUpdate = (list) => setFriends(list);
        socket?.on("friends:update", onUpdate);
        return () => {
            clearTimeout(timer);
            socket?.off("friends:update", onUpdate);
        };
    }, [refresh]);

    useEffect(() => {
        const value = query.trim();
        if (value.length < 2) {
            const timer = setTimeout(() => {
                setResults([]);
                setSearching(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSearching(true);
            setError(null);
            try {
                const payload = await api(`/users/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
                setResults(payload.users);
            } catch (err) {
                if (err.name !== "AbortError") setError(err instanceof ApiError ? err.message : "Recherche impossible.");
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 260);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const relationByUser = useMemo(
        () => new Map(friends.map((friendship) => [friendship.user.userId, friendship])),
        [friends]
    );
    const accepted = friends.filter((friendship) => friendship.status === "accepted");
    const incoming = friends.filter((friendship) => friendship.status === "pending" && !friendship.isOutgoing);
    const outgoing = friends.filter((friendship) => friendship.status === "pending" && friendship.isOutgoing);

    async function action(key, task) {
        setBusy(key);
        setError(null);
        try {
            await task();
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Action impossible pour le moment.");
        } finally {
            setBusy(null);
        }
    }

    const send = (user) => action(`user:${user.userId}`, () => api(`/friends/${encodeURIComponent(user.handle)}`, { method: "POST" }));
    const accept = (friendship) => action(`friend:${friendship.friendshipId}`, async () => {
        await api(`/friends/${friendship.friendshipId}`, { method: "PATCH" });
        await onDirectChannelsChanged?.();
    });
    const remove = (friendship) => action(`friend:${friendship.friendshipId}`, async () => {
        await api(`/friends/${friendship.friendshipId}`, { method: "DELETE" });
        await onDirectChannelsChanged?.();
    });

    return (
        <section className="friends-panel">
            <div className="home-section-head"><h2>Amis</h2><span>{accepted.length}</span></div>
            <label className="friend-search">
                <Icon name="search" size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par pseudo…" />
                {searching && <span>Recherche…</span>}
            </label>

            {error && <p className="friend-error" role="alert">{error}</p>}

            {query.trim().length >= 2 && (
                <div className="friend-results" aria-live="polite">
                    {!searching && results.length === 0 && <p>Aucun membre trouvé.</p>}
                    {results.map((user) => {
                        const relation = relationByUser.get(user.userId);
                        return (
                            <article key={user.userId} className="friend-row">
                                <Avatar user={user} size={38} presence={user.presence} />
                                <span className="friend-id"><strong>{user.displayName || user.handle}</strong><small>@{user.handle}</small></span>
                                {!relation && <button onClick={() => send(user)} disabled={busy === `user:${user.userId}`}>Ajouter</button>}
                                {relation?.status === "accepted" && <button onClick={() => onOpenFriend(relation.user.userId)}>Écrire</button>}
                                {relation?.status === "pending" && relation.isOutgoing && <span className="friend-state">Envoyée</span>}
                                {relation?.status === "pending" && !relation.isOutgoing && <button onClick={() => accept(relation)} disabled={busy === `friend:${relation.friendshipId}`}>Accepter</button>}
                            </article>
                        );
                    })}
                </div>
            )}

            {incoming.length > 0 && (
                <div className="friend-group">
                    <h3>Demandes reçues</h3>
                    {incoming.map((friendship) => (
                        <article key={friendship.friendshipId} className="friend-row">
                            <Avatar user={friendship.user} size={38} presence={friendship.user.presence} />
                            <span className="friend-id"><strong>{friendship.user.displayName || friendship.user.handle}</strong><small>@{friendship.user.handle}</small></span>
                            <button onClick={() => accept(friendship)} disabled={busy === `friend:${friendship.friendshipId}`}>Accepter</button>
                            <button className="quiet" onClick={() => remove(friendship)} disabled={busy === `friend:${friendship.friendshipId}`}>Refuser</button>
                        </article>
                    ))}
                </div>
            )}

            {accepted.length > 0 && (
                <div className="friend-group">
                    <h3>Vos amis</h3>
                    {accepted.map((friendship) => (
                        <article key={friendship.friendshipId} className="friend-row">
                            <Avatar user={friendship.user} size={38} presence={friendship.user.presence} />
                            <span className="friend-id"><strong>{friendship.user.displayName || friendship.user.handle}</strong><small>@{friendship.user.handle}</small></span>
                            <button onClick={() => onOpenFriend(friendship.user.userId)}>Écrire</button>
                            <button className="quiet" onClick={() => remove(friendship)} disabled={busy === `friend:${friendship.friendshipId}`}>Retirer</button>
                        </article>
                    ))}
                </div>
            )}

            {outgoing.length > 0 && (
                <div className="friend-group friend-group-compact">
                    <h3>Demandes envoyées</h3>
                    {outgoing.map((friendship) => (
                        <article key={friendship.friendshipId} className="friend-row">
                            <Avatar user={friendship.user} size={34} presence={friendship.user.presence} />
                            <span className="friend-id"><strong>{friendship.user.displayName || friendship.user.handle}</strong><small>@{friendship.user.handle}</small></span>
                            <button className="quiet" onClick={() => remove(friendship)} disabled={busy === `friend:${friendship.friendshipId}`}>Annuler</button>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
