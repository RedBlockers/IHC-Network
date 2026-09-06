import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import PushDevices from "./PushDevices.jsx";

const LEVELS = [
    { id: "all", label: "Tout", note: "Chaque message notifie." },
    { id: "mentions", label: "Mentions", note: "Seulement quand on vous nomme." },
    { id: "none", label: "Rien", note: "Aucune interruption." },
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export default function NotificationSettings({ guilds = [] }) {
    const [data, setData] = useState(null);
    const [permission, setPermission] = useState(
        typeof Notification === "undefined" ? "unsupported" : Notification.permission
    );
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api("/notifications/settings")
            .then((result) => !cancelled && setData(result))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Réglages indisponibles."));
        return () => {
            cancelled = true;
        };
    }, []);

    if (!data) return <p className="popout-role-empty">{error ?? "Chargement des réglages…"}</p>;

    const levelOf = (guildId) =>
        data.settings.find((item) => item.scope === "guild" && item.targetId === guildId)?.level ?? "inherit";

    async function setGuildLevel(guildId, level) {
        try {
            const { setting } = await api(`/notifications/settings/guilds/${guildId}`, { method: "PUT", body: { level } });
            setData((current) => ({
                ...current,
                settings: [
                    ...current.settings.filter((item) => !(item.scope === "guild" && item.targetId === guildId)),
                    ...(setting.level === "inherit" ? [] : [setting]),
                ],
            }));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Réglage non enregistré.");
        }
    }

    async function saveQuietHours(patch) {
        const next = { ...data.quietHours, ...patch };
        try {
            setData(
                await api("/notifications/settings/quiet-hours", {
                    method: "PUT",
                    body: {
                        start: next.start,
                        end: next.end,
                        desktopNotifications: patch.desktopNotifications ?? data.desktopNotifications,
                    },
                })
            );
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Heures calmes non enregistrées.");
        }
    }

    return (
        <div className="appearance-settings">
            <section className="settings-section">
                <h3 className="settings-h">Notifications de bureau</h3>
                <p className="settings-p">
                    {permission === "unsupported"
                        ? "Ce navigateur ne propose pas de notification système."
                        : permission === "granted"
                          ? "Autorisées par le navigateur."
                          : "Le navigateur doit d’abord vous les autoriser."}
                </p>
                <ul className="settings-toggles">
                    <li>
                        <label>
                            <input
                                type="checkbox"
                                checked={data.desktopNotifications}
                                onChange={(event) => saveQuietHours({ desktopNotifications: event.target.checked })}
                            />
                            <span>
                                <strong>Autoriser les interruptions</strong>
                                <small>La boîte de réception continue d’être alimentée dans tous les cas.</small>
                            </span>
                        </label>
                    </li>
                </ul>
                {permission === "default" && (
                    <button type="button" className="btn btn-ghost" onClick={() => Notification.requestPermission().then(setPermission)}>
                        Demander l’autorisation au navigateur
                    </button>
                )}
            </section>

            <PushDevices />

            <section className="settings-section">
                <h3 className="settings-h">Heures calmes</h3>
                <p className="settings-p">Pendant cette plage, rien ne vous interrompt. Rien n’est perdu pour autant.</p>
                <div className="automod-pair">
                    <label className="field">
                        <span className="field-label">De</span>
                        <select className="field-input" value={data.quietHours.start ?? ""} onChange={(e) => saveQuietHours({ start: e.target.value === "" ? null : Number(e.target.value) })}>
                            <option value="">Aucune</option>
                            {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")} h</option>)}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">À</span>
                        <select className="field-input" value={data.quietHours.end ?? ""} onChange={(e) => saveQuietHours({ end: e.target.value === "" ? null : Number(e.target.value) })}>
                            <option value="">Aucune</option>
                            {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")} h</option>)}
                        </select>
                    </label>
                </div>
                <p className="settings-p">Une plage peut enjamber minuit : 22 h → 7 h est valide.</p>
            </section>

            <section className="settings-section">
                <h3 className="settings-h">Par communauté</h3>
                <p className="settings-p">Un salon peut ensuite affiner ce niveau depuis son propre menu.</p>
                <ul className="device-list">
                    {guilds.map((guild) => (
                        <li key={guild.guildId}>
                            <span><strong>{guild.name}</strong><small>Niveau hérité par ses salons.</small></span>
                            <select className="field-input" value={levelOf(guild.guildId)} onChange={(e) => setGuildLevel(guild.guildId, e.target.value)}>
                                <option value="inherit">Par défaut</option>
                                {LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
                            </select>
                        </li>
                    ))}
                    {guilds.length === 0 && <li><span><small>Aucune communauté pour l’instant.</small></span></li>}
                </ul>
            </section>

            {error && <p className="auth-error" role="alert">{error}</p>}
        </div>
    );
}
