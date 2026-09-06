import { useEffect, useRef, useState } from "react";
import { EMOJI_GROUPS } from "../../lib/emoji.js";
import { api } from "../../lib/api.js";

const TABS = [
    { id: "emoji", label: "Emojis" },
    { id: "sticker", label: "Autocollants" },
    { id: "gif", label: "GIFs" },
];

export default function EmojiPicker({ onPick, onClose, style, guildId }) {
    const ref = useRef(null);
    const [tab, setTab] = useState("emoji");
    const [media, setMedia] = useState([]);
    const [loadedFor, setLoadedFor] = useState(null);

    useEffect(() => {
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    useEffect(() => {
        if (!guildId) return undefined;
        const key = `${guildId}`;
        if (loadedFor === key) return undefined;

        let cancelled = false;
        api(`/guilds/${guildId}/emojis`)
            .then(({ emojis }) => {
                if (!cancelled) setMedia(emojis ?? []);
            })
            .catch(() => {
                if (!cancelled) setMedia([]);
            })
            .finally(() => {
                if (!cancelled) setLoadedFor(key);
            });
        return () => {
            cancelled = true;
        };
    }, [guildId, loadedFor]);

    const custom = media.filter((entry) => (entry.kind ?? "emoji") === tab);

    return (
        <div className="emoji-pop" ref={ref} role="dialog" aria-label="Sélecteur d'emoji" style={style}>
            {guildId && (
                <div className="emoji-tabs" role="tablist">
                    {TABS.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === entry.id}
                            className={tab === entry.id ? "is-active" : ""}
                            onClick={() => setTab(entry.id)}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="emoji-scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
                {custom.length > 0 && (
                    <div>
                        <div className="emoji-cat">Cette communauté</div>
                        <div className={tab === "emoji" ? "emoji-grid" : "sticker-grid"}>
                            {custom.map((entry) => (
                                <button
                                    key={entry.emojiId}
                                    type="button"
                                    onClick={() => onPick(`:${entry.name}:`, entry)}
                                    aria-label={entry.name}
                                    title={`:${entry.name}:`}
                                >
                                    <img src={entry.url} alt={entry.name} loading="lazy" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {guildId && tab !== "emoji" && custom.length === 0 && (
                    <p className="emoji-empty" role="status">
                        Cette communauté n’a pas encore {tab === "gif" ? "de GIF" : "d’autocollant"}.
                    </p>
                )}

                {tab === "emoji" && Object.entries(EMOJI_GROUPS).map(([cat, list]) => (
                    <div key={cat}>
                        <div className="emoji-cat">{cat}</div>
                        <div className="emoji-grid">
                            {list.map((e) => (
                                <button key={e} onClick={() => onPick(e)} aria-label={`Réagir ${e}`}>
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
