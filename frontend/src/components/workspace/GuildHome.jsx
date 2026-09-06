import { useEffect, useState } from "react";

import { api } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";
import Icon from "../ui/Icon.jsx";
import AsyncSection from "../ui/AsyncSection.jsx";
import { bannerGradient } from "../../lib/banners.js";
import { fullTimestamp } from "../../lib/format.js";

const preview = (content) => {
    if (/^QW1:/.test(content)) return "Message chiffré";
    return content.length > 110 ? `${content.slice(0, 109)}…` : content;
};

export default function GuildHome({ guild, unread = {}, voicePresence = {}, onOpenChannel, onOpenMembers, onInvite, onCreateChannel, onOpenSettings, canManageChannels = false, canModerate = false }) {
    const [state, setState] = useState({ status: "loading", guildId: guild.guildId });

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/home`)
            .then((data) => {
                if (!cancelled) setState({ status: "ready", guildId: guild.guildId, data });
            })
            .catch(() => {
                if (!cancelled) setState({ status: "failed", guildId: guild.guildId });
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId]);

    const current = state.guildId === guild.guildId ? state : { status: "loading" };
    const data = current.data;

    const voiceRooms = Object.entries(voicePresence)
        .map(([channelId, participants]) => ({
            channelId: Number(channelId),
            channel: guild.channels?.find((c) => c.channelId === Number(channelId)),
            count: participants?.length ?? 0,
        }))
        .filter((room) => room.count > 0 && room.channel);

    const busiest = Object.entries(unread)
        .map(([channelId, count]) => ({
            channelId: Number(channelId),
            channel: guild.channels?.find((c) => c.channelId === Number(channelId)),
            count: Number(count),
        }))
        .filter((entry) => entry.count > 0 && entry.channel)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    const nextEvent = data?.events?.[0] ?? null;
    const nothingLive = voiceRooms.length === 0 && busiest.length === 0 && !nextEvent;

    const textChannels = (guild.channels ?? []).filter((c) => c.type !== "voice" && c.type !== "event");
    const firstChannel = data?.activity?.[0]
        ? guild.channels?.find((c) => c.channelId === data.activity[0].channelId)
        : textChannels[0];
    const memberCount = guild.members?.length ?? 0;
    const voiceNow = voiceRooms.reduce((total, room) => total + room.count, 0);

    const isFresh = current.status === "ready"
        && memberCount <= 1
        && nothingLive
        && (data?.announcements?.length ?? 0) === 0;

    const starters = [
        onInvite && {
            key: "invite",
            icon: "invite",
            title: "Invitez vos premiers membres",
            detail: "Un lien suffit — il se règle et se révoque.",
            action: onInvite,
        },
        canManageChannels && onCreateChannel && {
            key: "channel",
            icon: "hash",
            title: "Créez un salon",
            detail: "Un salon par sujet, l'accueil reste lisible.",
            action: onCreateChannel,
        },
        canModerate && onOpenSettings && {
            key: "settings",
            icon: "settings",
            title: "Personnalisez l'accueil",
            detail: "Nom, bannière, thème et accueil des arrivants.",
            action: onOpenSettings,
        },
    ].filter(Boolean);

    const doors = [
        data?.announcements?.[0] ? {
            key: "Annonces",
            icon: "bell",
            title: data.announcements[0].channelName,
            detail: preview(data.announcements[0].content),
            channelId: data.announcements[0].channelId,
        } : firstChannel && {
            key: "Salons",
            icon: "hash",
            title: `# ${firstChannel.name}`,
            detail: "Reprendre la lecture là où ça bouge.",
            channelId: firstChannel.channelId,
        },
        nextEvent && {
            key: "Prochain rendez-vous",
            icon: "invite",
            title: nextEvent.title,
            detail: fullTimestamp(nextEvent.startsAt),
            channelId: nextEvent.channelId,
        },
        {
            key: "Membres",
            icon: "users",
            title: `${memberCount} membre${memberCount > 1 ? "s" : ""}`,
            detail: "Voir qui est là et qui fait quoi.",
            action: onOpenMembers,
        },
        onInvite && {
            key: "Inviter",
            icon: "invite",
            title: "Faire grandir la communauté",
            detail: "Un lien suffit à faire entrer quelqu'un.",
            action: onInvite,
        },
    ].filter(Boolean).slice(0, 3);

    return (
        <section className="guild-home">
            <header
                className="guild-hero"
                style={{
                    backgroundImage: guild.bannerImage ? `url(${guild.bannerImage})` : bannerGradient(guild.banner),
                    backgroundPosition: `${guild.bannerFocusX ?? 50}% ${guild.bannerFocusY ?? 50}%`,
                }}
            >
                <div className="guild-hero-veil" />
                <div className="guild-hero-copy">
                    <div className="guild-hero-id">
                        <span className="guild-hero-icon" aria-hidden="true">
                            {guild.icon ? <img src={guild.icon} alt="" /> : guild.name.slice(0, 1).toUpperCase()}
                        </span>
                        <p className="guild-hero-tagline">{guild.description ? "Communauté" : "Bienvenue"}</p>
                    </div>
                    <h1>{guild.name}</h1>
                    {guild.description && <p className="guild-hero-sub">{guild.description}</p>}
                    <p className="guild-hero-meta">
                        {memberCount} membre{memberCount > 1 ? "s" : ""} · {textChannels.length} salon{textChannels.length > 1 ? "s" : ""}
                        {voiceNow > 0 && ` · ${voiceNow} en vocal`}
                    </p>
                    <div className="guild-hero-actions">
                        {voiceRooms[0] ? (
                            <button type="button" className="btn btn-accent" onClick={() => onOpenChannel(voiceRooms[0].channelId)}>
                                Rejoindre {voiceRooms[0].channel.name}
                            </button>
                        ) : (
                            firstChannel && (
                                <button type="button" className="btn btn-accent" onClick={() => onOpenChannel(firstChannel.channelId)}>
                                    Reprendre la conversation
                                </button>
                            )
                        )}
                        <button type="button" className="btn guild-hero-glass" onClick={onOpenMembers}>
                            Voir les membres
                        </button>
                    </div>
                </div>
            </header>

            {isFresh && starters.length > 0 ? (
                <section className="guild-start">
                    <div className="guild-section-head">
                        <h2>Pour commencer</h2>
                        <span className="guild-section-rule" />
                    </div>
                    <div className="guild-doors">
                        {starters.map((starter) => (
                            <button type="button" className="guild-door" key={starter.key} onClick={starter.action}>
                                <span className="guild-door-icon" aria-hidden="true"><Icon name={starter.icon} size={16} /></span>
                                <span className="guild-door-key">{starter.title}</span>
                                <span className="guild-door-detail">{starter.detail}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ) : (
                <div className="guild-doors">
                    {doors.map((door) => (
                        <button
                            type="button"
                            className="guild-door"
                            key={door.key}
                            onClick={() => (door.action ? door.action() : onOpenChannel(door.channelId))}
                        >
                            <span className="guild-door-icon" aria-hidden="true"><Icon name={door.icon} size={16} /></span>
                            <span className="guild-door-key">{door.key}</span>
                            <span className="guild-door-title">{door.title}</span>
                            <span className="guild-door-detail">{door.detail}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="guild-section-head">
                <h2>En ce moment</h2>
                <span className="guild-section-rule" />
            </div>

            <div className="guild-live">
                {voiceRooms.map((room) => (
                    <button type="button" className="guild-chip is-voice" key={room.channelId} onClick={() => onOpenChannel(room.channelId)}>
                        <span className="guild-equalizer" aria-hidden="true"><i /><i /><i /></span>
                        <span className="guild-chip-copy">
                            <strong>{room.count} personne{room.count > 1 ? "s" : ""} en vocal</strong>
                            <small>{room.channel.name} · rejoindre en un clic</small>
                        </span>
                    </button>
                ))}

                {busiest.map((entry) => (
                    <button type="button" className="guild-chip" key={entry.channelId} onClick={() => onOpenChannel(entry.channelId)}>
                        <span className="guild-chip-copy">
                            <strong>
                                {entry.channel.name} <span>— {entry.count} nouveau{entry.count > 1 ? "x" : ""} message{entry.count > 1 ? "s" : ""}</span>
                            </strong>
                            <small>{data?.activity?.find((a) => a.channelId === entry.channelId)?.content ? preview(data.activity.find((a) => a.channelId === entry.channelId).content) : "Reprendre la lecture"}</small>
                        </span>
                    </button>
                ))}

                {nextEvent && (
                    <button type="button" className="guild-chip" onClick={() => onOpenChannel(nextEvent.channelId)}>
                        <span className="guild-chip-copy">
                            <strong>{nextEvent.title}</strong>
                            <small>{fullTimestamp(nextEvent.startsAt)}</small>
                        </span>
                    </button>
                )}

                {nothingLive && current.status === "ready" && (
                    <div className="guild-live-empty" role="status">
                        <span className="guild-door-icon" aria-hidden="true"><Icon name="volume" size={16} /></span>
                        <p>
                            Rien en cours. {data?.visibleChannels === 0 ? "Aucun salon ne vous est encore accessible ici." : "Ouvrez un salon pour lancer la journée."}
                        </p>
                        {firstChannel && data?.visibleChannels !== 0 && (
                            <button type="button" className="btn btn-ghost" onClick={() => onOpenChannel(firstChannel.channelId)}>
                                Ouvrir # {firstChannel.name}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {(data?.announcements?.length ?? 0) > 0 && (
                <section className="guild-feed">
                    <div className="guild-section-head">
                        <h2>Annonces</h2>
                        <span className="guild-section-rule" />
                    </div>
                    <AsyncSection
                        status={current.status}
                        count={data?.announcements.length ?? 0}
                        empty="Aucune annonce pour le moment."
                        announce={(n) => `${n} annonce${n > 1 ? "s" : ""}.`}
                        skeleton={<Skeleton rows={2} />}
                    >
                        <ul className="home-feed">
                            {data?.announcements.map((item) => (
                                <li key={item.messageId}>
                                    <button type="button" onClick={() => onOpenChannel(item.channelId)}>
                                        <Avatar user={item.author} size={34} />
                                        <span className="home-feed-copy">
                                            <strong>{item.author.displayName || item.author.handle}</strong>
                                            <span>{preview(item.content)}</span>
                                            <small>{item.channelName} · {fullTimestamp(item.createdAt)}</small>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </AsyncSection>
                </section>
            )}
        </section>
    );
}

function Skeleton({ rows }) {
    return (
        <div className="home-feed-skeleton" aria-hidden="true">
            {Array.from({ length: rows }, (_row, index) => (
                <div className="home-feed-row is-loading" key={index}>
                    <span className="skeleton-dot" />
                    <span className="skeleton-lines"><i /><i /></span>
                </div>
            ))}
        </div>
    );
}
