import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import ActivityFrame from "./ActivityFrame.jsx";

const TABS = [
    { id: "bots", label: "Bots" },
    { id: "activities", label: "Activités" },
    { id: "automations", label: "Automatisations" },
];

export default function CommunityAppsAdmin({ guild, channelId = null }) {
    const [tab, setTab] = useState("bots");
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [bots, setBots] = useState([]);
    const [revealed, setRevealed] = useState(null);
    const [activities, setActivities] = useState([]);
    const [launch, setLaunch] = useState(null);
    const [automations, setAutomations] = useState([]);
    const [botName, setBotName] = useState("");
    const [activityName, setActivityName] = useState("");
    const [activityOrigin, setActivityOrigin] = useState("");
    const [autoName, setAutoName] = useState("");
    const [autoEvent, setAutoEvent] = useState("member.joined");
    const [autoTemplate, setAutoTemplate] = useState("Bienvenue @{handle}");
    const [autoChannel, setAutoChannel] = useState(channelId ?? "");

    const reload = useCallback(
        () =>
            Promise.all([
                api(`/guilds/${guild.guildId}/bots`)
                    .then((result) => result.bots ?? [])
                    .catch(() => []),
                api(`/guilds/${guild.guildId}/activities`)
                    .then((result) => result.activities ?? [])
                    .catch(() => []),
                api(`/guilds/${guild.guildId}/automations`)
                    .then((result) => result.automations ?? [])
                    .catch(() => []),
            ]).then(([botList, activityList, autoList]) => {
                setBots(botList);
                setActivities(activityList);
                setAutomations(autoList);
            }),
        [guild.guildId]
    );

    useEffect(() => {
        reload();
    }, [reload]);

    return (
        <div className="server-admin-content community-apps">
            <p className="settings-p">
                Un bot a une identité et une file d’événements. Un webhook n’écrit que dans un salon, via un secret
                d’URL, sans lire. Une activité s’ouvre dans un cadre HTTPS signé.
            </p>
            <div className="notification-tabs" role="tablist">
                {TABS.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === entry.id}
                        className={`notification-tab${tab === entry.id ? " is-active" : ""}`}
                        onClick={() => setTab(entry.id)}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>
            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            {notice && (
                <p className="settings-warning" role="status">
                    {notice}
                </p>
            )}

            {tab === "bots" && (
                <div className="community-apps-form">
                    <label className="field">
                        <span className="field-label">Nom du bot</span>
                        <input
                            className="field-input"
                            value={botName}
                            onChange={(event) => setBotName(event.target.value)}
                            minLength={2}
                            required
                        />
                    </label>
                    <button
                        className="btn btn-accent"
                        type="button"
                        onClick={async () => {
                            setError(null);
                            try {
                                const { bot } = await api(`/guilds/${guild.guildId}/bots`, {
                                    method: "POST",
                                    body: { name: botName.trim(), events: ["message.created"] },
                                });
                                setRevealed(bot);
                                setBotName("");
                                setNotice("Le secret du bot n’est montré qu’une fois.");
                                await reload();
                            } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Bot non créé.");
                            }
                        }}
                    >
                        Créer un bot
                    </button>
                    {revealed?.token && (
                        <p className="settings-warning">
                            Secret (une seule fois) : <code>{revealed.token}</code>
                        </p>
                    )}
                    <ul className="community-apps-list">
                        {bots.map((bot) => (
                            <li key={bot.botId}>
                                <strong>{bot.name}</strong>
                                <span>{bot.revoked ? "révoqué" : bot.publicId}</span>
                                {!bot.revoked && (
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() =>
                                            api(`/guilds/${guild.guildId}/bots/${bot.botId}`, { method: "DELETE" })
                                                .then(reload)
                                                .catch((err) =>
                                                    setError(
                                                        err instanceof ApiError ? err.message : "Révocation refusée."
                                                    )
                                                )
                                        }
                                    >
                                        Révoquer
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {tab === "activities" && (
                <div className="community-apps-form">
                    <label className="field">
                        <span className="field-label">Nom</span>
                        <input
                            className="field-input"
                            value={activityName}
                            onChange={(event) => setActivityName(event.target.value)}
                            required
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Origine HTTPS</span>
                        <input
                            className="field-input"
                            value={activityOrigin}
                            onChange={(event) => setActivityOrigin(event.target.value)}
                            placeholder="https://…"
                            required
                        />
                    </label>
                    <button
                        className="btn btn-accent"
                        type="button"
                        onClick={async () => {
                            setError(null);
                            try {
                                await api(`/guilds/${guild.guildId}/activities`, {
                                    method: "POST",
                                    body: { name: activityName.trim(), origin: activityOrigin.trim() },
                                });
                                setActivityName("");
                                setActivityOrigin("");
                                await reload();
                            } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Activité refusée.");
                            }
                        }}
                    >
                        Enregistrer l’activité
                    </button>
                    <ul className="community-apps-list">
                        {activities.map((activity) => (
                            <li key={activity.activityId}>
                                <strong>{activity.name}</strong>
                                <span>{activity.origin}</span>
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={!channelId}
                                    onClick={async () => {
                                        try {
                                            const session = await api(
                                                `/guilds/${guild.guildId}/activities/${activity.activityId}/launch`,
                                                { method: "POST", body: { channelId } }
                                            );
                                            setLaunch(session);
                                        } catch (err) {
                                            setError(err instanceof ApiError ? err.message : "Lancement refusé.");
                                        }
                                    }}
                                >
                                    Ouvrir
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() =>
                                        api(`/guilds/${guild.guildId}/activities/${activity.activityId}`, {
                                            method: "DELETE",
                                        })
                                            .then(reload)
                                            .catch((err) =>
                                                setError(err instanceof ApiError ? err.message : "Retrait refusé.")
                                            )
                                    }
                                >
                                    Retirer
                                </button>
                            </li>
                        ))}
                    </ul>
                    {!channelId && (
                        <p className="popout-role-empty">
                            Ouvrez un salon de cette communauté pour lancer une activité.
                        </p>
                    )}
                    {launch && <ActivityFrame session={launch} onClose={() => setLaunch(null)} />}
                </div>
            )}

            {tab === "automations" && (
                <div className="community-apps-form">
                    <label className="field">
                        <span className="field-label">Nom</span>
                        <input
                            className="field-input"
                            value={autoName}
                            onChange={(event) => setAutoName(event.target.value)}
                            required
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Événement</span>
                        <select
                            className="field-input"
                            value={autoEvent}
                            onChange={(event) => setAutoEvent(event.target.value)}
                        >
                            <option value="member.joined">Un membre rejoint</option>
                            <option value="message.created">Un message est publié</option>
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">Salon cible</span>
                        <input
                            className="field-input"
                            value={autoChannel}
                            onChange={(event) => setAutoChannel(event.target.value)}
                            required
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Modèle</span>
                        <input
                            className="field-input"
                            value={autoTemplate}
                            onChange={(event) => setAutoTemplate(event.target.value)}
                        />
                    </label>
                    <p className="settings-p">
                        Action : publier le modèle dans le salon cible. Pas de processus externe, pas de boucle.
                    </p>
                    <button
                        className="btn btn-accent"
                        type="button"
                        onClick={async () => {
                            setError(null);
                            try {
                                await api(`/guilds/${guild.guildId}/automations`, {
                                    method: "POST",
                                    body: {
                                        name: autoName.trim(),
                                        event: autoEvent,
                                        action: "post_message",
                                        channelId: Number(autoChannel),
                                        template: autoTemplate,
                                    },
                                });
                                setAutoName("");
                                await reload();
                            } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Règle refusée.");
                            }
                        }}
                    >
                        Ajouter la règle
                    </button>
                    <ul className="community-apps-list">
                        {automations.map((rule) => (
                            <li key={rule.automationId}>
                                <strong>{rule.name}</strong>
                                <span>
                                    {rule.event} → {rule.action}
                                </span>
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={() =>
                                        api(`/guilds/${guild.guildId}/automations/${rule.automationId}`, {
                                            method: "PATCH",
                                            body: { enabled: !rule.enabled },
                                        })
                                            .then(reload)
                                            .catch((err) =>
                                                setError(err instanceof ApiError ? err.message : "Règle inchangée.")
                                            )
                                    }
                                >
                                    {rule.enabled ? "Désactiver" : "Activer"}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() =>
                                        api(`/guilds/${guild.guildId}/automations/${rule.automationId}`, {
                                            method: "DELETE",
                                        })
                                            .then(reload)
                                            .catch((err) =>
                                                setError(err instanceof ApiError ? err.message : "Suppression refusée.")
                                            )
                                    }
                                >
                                    Supprimer
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
