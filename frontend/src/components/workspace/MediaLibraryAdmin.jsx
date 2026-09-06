import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import AsyncSection from "../ui/AsyncSection.jsx";

const KINDS = [
    {
        id: "emoji",
        label: "Emojis",
        hint: "PNG, GIF ou WebP · 256 Ko · 100 par communauté",
        accept: "image/png,image/gif,image/webp",
    },
    {
        id: "sticker",
        label: "Autocollants",
        hint: "PNG ou WebP · 512 Ko · 60 par communauté",
        accept: "image/png,image/webp",
    },
    { id: "gif", label: "GIFs", hint: "GIF ou WebP animé · 2 Mo · 60 par communauté", accept: "image/gif,image/webp" },
    {
        id: "sound",
        label: "Sons",
        hint: "MP3, OGG, WAV ou WebM · 512 Ko · 40 par communauté",
        accept: "audio/mpeg,audio/ogg,audio/wav,audio/webm",
    },
];

export default function MediaLibraryAdmin({ guild }) {
    const [kind, setKind] = useState("emoji");
    const [items, setItems] = useState([]);
    const [loadedKind, setLoadedKind] = useState(null);
    const [error, setError] = useState(null);
    const [name, setName] = useState("");

    const reload = useCallback(
        () =>
            api(`/guilds/${guild.guildId}/emojis?kind=${kind}`)
                .then(({ emojis }) => setItems(emojis ?? []))
                .catch(() => setItems([]))
                .finally(() => setLoadedKind(`${guild.guildId}:${kind}`)),
        [guild.guildId, kind]
    );

    useEffect(() => {
        reload();
    }, [reload]);

    const loading = loadedKind !== `${guild.guildId}:${kind}`;

    async function upload(file) {
        if (!file) return;
        setError(null);
        const body = new FormData();
        body.append("image", file);
        body.append(
            "name",
            name ||
                file.name
                    .replace(/\.\w+$/, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "_")
                    .slice(0, 32)
        );
        body.append("kind", kind);

        try {
            await api(`/guilds/${guild.guildId}/emojis`, { method: "POST", body });
            setName("");
            await reload();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Envoi impossible.");
        }
    }

    async function remove(emojiId) {
        await api(`/guilds/${guild.guildId}/emojis/${emojiId}`, { method: "DELETE" }).catch(() => {});
        await reload();
    }

    const current = KINDS.find((entry) => entry.id === kind);

    return (
        <div className="server-admin-content">
            <div className="notification-tabs" role="tablist">
                {KINDS.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={kind === entry.id}
                        className={`notification-tab${kind === entry.id ? " is-active" : ""}`}
                        onClick={() => setKind(entry.id)}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            <p className="media-limits">{current.hint}</p>

            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}

            <div className="media-upload">
                <label>
                    <span className="sr-only">Nom</span>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value.toLowerCase())}
                        placeholder="nom_court"
                        maxLength={32}
                    />
                </label>
                <label className="btn btn-ghost">
                    Ajouter
                    <input
                        type="file"
                        accept={current.accept}
                        className="sr-only"
                        onChange={(event) => upload(event.target.files?.[0])}
                    />
                </label>
            </div>

            <AsyncSection
                status={loading ? "loading" : "ready"}
                count={loading ? 0 : items.length}
                empty={`Aucun ${current.label.toLowerCase().replace(/s$/, "")} pour l’instant.`}
                announce={(n) => `${n} élément${n > 1 ? "s" : ""}.`}
            >
                <ul className="media-grid">
                    {items.map((item) => (
                        <li key={item.emojiId}>
                            {kind === "sound" ? (
                                <audio controls src={item.url} preload="none">
                                    {item.name}
                                </audio>
                            ) : (
                                <img src={item.url} alt={item.name} loading="lazy" />
                            )}
                            <strong>:{item.name}:</strong>
                            <button type="button" className="btn btn-danger" onClick={() => remove(item.emojiId)}>
                                Retirer
                            </button>
                        </li>
                    ))}
                </ul>
            </AsyncSection>
        </div>
    );
}
