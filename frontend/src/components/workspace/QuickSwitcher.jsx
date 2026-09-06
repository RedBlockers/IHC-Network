import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Icon from "../ui/Icon.jsx";
import { api } from "../../lib/api.js";
import { rank } from "../../lib/paletteScore.js";

const KINDS = {
    guild: { icon: "home", section: "Communautés" },
    channel: { icon: "hash", section: "Salons" },
    command: { icon: "settings", section: "Commandes" },
    message: { icon: "search", section: "Messages" },
};

export default function QuickSwitcher({
    open,
    guilds,
    channels,
    activeGuild,
    commands = [],
    onClose,
    onSelectGuild,
    onSelectChannel,
    onSelectMessage,
}) {
    const [query, setQuery] = useState("");
    const [found, setFound] = useState({ query: "", items: [] });
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const close = useCallback(() => {
        setQuery("");
        setFound({ query: "", items: [] });
        setActive(0);
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;
        const timer = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        const needle = query.trim();
        if (!open || needle.length < 2) return undefined;

        let cancelled = false;
        const timer = setTimeout(() => {
            api(`/search?q=${encodeURIComponent(needle)}&limit=6`)
                .then((result) => {
                    if (!cancelled) setFound({ query: needle, items: result.messages ?? [] });
                })
                .catch(() => {
                    if (!cancelled) setFound({ query: needle, items: [] });
                });
        }, 220);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, query]);

    const results = useMemo(() => {
        const messages = found.query === query.trim() ? found.items : [];

        const local = rank(
            [
                ...guilds.map((guild) => ({
                    kind: "guild",
                    id: `guild:${guild.guildId}`,
                    target: guild.guildId,
                    label: guild.name,
                    hint: "Communauté",
                })),
                ...channels.map((channel) => ({
                    kind: "channel",
                    id: `channel:${channel.channelId}`,
                    target: channel.channelId,
                    label: channel.user?.displayName || channel.user?.handle || channel.name,
                    hint: activeGuild?.name || "Message privé",
                })),
                ...commands.map((command) => ({
                    kind: "command",
                    id: `command:${command.id}`,
                    target: command,
                    label: command.label,
                    hint: command.hint ?? "Commande",
                })),
            ],
            query
        );

        return [
            ...local,
            ...messages.map((message) => ({
                kind: "message",
                id: `message:${message.messageId}`,
                target: message,
                label: message.content,
                hint: `#${message.channel?.name ?? "salon"} · ${message.author?.displayName || message.author?.handle || "—"}`,
            })),
        ];
    }, [activeGuild, channels, commands, found, guilds, query]);

    const [lastCount, setLastCount] = useState(results.length);
    if (lastCount !== results.length) {
        setLastCount(results.length);
        if (active >= results.length) setActive(0);
    }

    const select = useCallback(
        (item) => {
            if (!item) return;
            if (item.kind === "guild") onSelectGuild(item.target);
            else if (item.kind === "channel") onSelectChannel(item.target);
            else if (item.kind === "command") item.target.run();
            else if (item.kind === "message") onSelectMessage?.(item.target);
            close();
        },
        [close, onSelectChannel, onSelectGuild, onSelectMessage]
    );

    function onKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
        }
        if (results.length === 0) return;

        if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
            event.preventDefault();
            setActive((current) => (current + 1) % results.length);
        } else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
            event.preventDefault();
            setActive((current) => (current - 1 + results.length) % results.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            setActive(0);
        } else if (event.key === "End") {
            event.preventDefault();
            setActive(results.length - 1);
        } else if (event.key === "Enter") {
            event.preventDefault();
            select(results[active]);
        }
    }

    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }, [active]);

    if (!open) return null;

    let previousSection = null;

    return (
        <div className="switcher-backdrop" onMouseDown={close}>
            <section
                className="switcher"
                role="dialog"
                aria-modal="true"
                aria-label="Palette de commandes"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <label className="switcher-search">
                    <Icon name="search" size={20} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Aller quelque part, lancer une action, retrouver un message…"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="switcher-results"
                        aria-activedescendant={results[active] ? `switcher-${results[active].id}` : undefined}
                        aria-autocomplete="list"
                    />
                    <kbd>Échap</kbd>
                </label>

                <div className="switcher-results" id="switcher-results" role="listbox" ref={listRef} aria-label="Résultats">
                    {results.length === 0 && (
                        <p role="status">
                            {query.trim() ? "Aucun résultat." : "Tapez pour chercher un salon, une commande ou un message."}
                        </p>
                    )}

                    {results.map((item, index) => {
                        const section = KINDS[item.kind].section;
                        const heading = section !== previousSection ? section : null;
                        previousSection = section;

                        return (
                            <div key={item.id}>
                                {heading && <p className="switcher-section" aria-hidden="true">{heading}</p>}
                                <button
                                    type="button"
                                    id={`switcher-${item.id}`}
                                    role="option"
                                    aria-selected={index === active}
                                    className={index === active ? "is-active" : ""}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => select(item)}
                                >
                                    <Icon name={KINDS[item.kind].icon} size={17} />
                                    <span>{item.label}</span>
                                    <small>{item.hint}</small>
                                </button>
                            </div>
                        );
                    })}
                </div>

                <footer className="switcher-hints" aria-hidden="true">
                    <span><kbd>↑</kbd><kbd>↓</kbd> parcourir</span>
                    <span><kbd>Entrée</kbd> ouvrir</span>
                    <span><kbd>Échap</kbd> fermer</span>
                </footer>
            </section>
        </div>
    );
}
