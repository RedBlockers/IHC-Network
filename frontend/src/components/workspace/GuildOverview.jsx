import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import Icon from "../ui/Icon.jsx";
import { fullTimestamp } from "../../lib/format.js";

export default function GuildOverview({ guild, onGo }) {
    const [state, setState] = useState({ status: "loading", guildId: guild.guildId });

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/overview`)
            .then((result) => {
                if (!cancelled) setState({ status: "ready", guildId: guild.guildId, data: result });
            })
            .catch(() => {
                if (!cancelled) setState({ status: "failed", guildId: guild.guildId });
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId]);

    const current = state.guildId === guild.guildId ? state : { status: "loading" };

    if (current.status === "failed") {
        return (
            <div className="server-admin-content">
                <p className="admin-empty">Les chiffres n’ont pas pu être chargés. Réessayez dans un instant.</p>
            </div>
        );
    }

    if (current.status !== "ready") {
        return (
            <div className="server-admin-content">
                <div className="overview-grid" aria-hidden="true">
                    {[0, 1, 2, 3].map((index) => <div className="overview-card is-loading" key={index} />)}
                </div>
                <span className="sr-only" role="status">Chargement de la vue d’ensemble…</span>
            </div>
        );
    }

    const { members, activity, moderation, structure, health, storage } = current.data;

    const todo = [
        moderation.openReports > 0 && {
            id: "reports",
            text: `${moderation.openReports} signalement${moderation.openReports > 1 ? "s" : ""} en attente`,
            detail: moderation.oldestReportAt ? `le plus ancien : ${fullTimestamp(moderation.oldestReportAt)}` : null,
            action: "Traiter",
            go: () => onGo?.("reports"),
            urgent: true,
        },
        storage && storage.level !== "ok" && {
            id: "storage",
            text: storage.level === "full" ? "L’espace de stockage est plein" : "L’espace de stockage se remplit",
            detail: `${storage.share} % utilisés · ${storage.files} fichiers`,
            action: "Voir",
            go: () => onGo?.("media"),
            urgent: storage.level === "full",
        },
        health?.accentContrast && !health.accentContrast.ok && {
            id: "contrast",
            text: "La teinte de la communauté n’atteint pas le contraste minimal",
            detail: `mesurée à ${health.accentContrast.ratio}:1`,
            action: "Corriger",
            go: () => onGo?.("identity"),
            urgent: true,
        },
        members.joinedMonth > 0 && members.joinedWeek > members.joinedMonth / 2 && {
            id: "wave",
            text: "Plus de la moitié des arrivées du mois datent de cette semaine",
            detail: "vérifiez les invitations actives",
            action: "Vérifier",
            go: () => onGo?.("members"),
        },
    ].filter(Boolean);

    return (
        <div className="server-admin-content">

            <div className="overview-grid">
                <Card
                    label="Membres"
                    value={members.total}
                    hint={members.joinedWeek > 0 ? `+${members.joinedWeek} cette semaine` : "Aucune arrivée cette semaine"}
                />
                <Card
                    label="Messages (7 j)"
                    value={activity.messagesWeek}
                    hint={
                        activity.activeShare === null
                            ? "Pas encore de membres"
                            : `${activity.activeAuthors} auteur${activity.activeAuthors > 1 ? "s" : ""} · ${activity.activeShare} % des membres`
                    }
                />
                <Card
                    label="Sanctions actives"
                    value={moderation.activeBans + moderation.activeTimeouts}
                    hint={`${moderation.activeBans} bannissement${moderation.activeBans > 1 ? "s" : ""} · ${moderation.activeTimeouts} exclusion${moderation.activeTimeouts > 1 ? "s" : ""} temporaire${moderation.activeTimeouts > 1 ? "s" : ""}`}
                />
                <Card
                    label="Stockage"
                    value={storage ? storage.share : 0}
                    hint={storage ? `${Math.round(storage.usedBytes / 1024 / 1024)} Mo sur ${Math.round(storage.quotaBytes / 1024 / 1024 / 1024)} Go` : "—"}
                    suffix="%"
                />
                <Card
                    label="Structure"
                    value={structure.channels}
                    hint={`${structure.roles} rôle${structure.roles > 1 ? "s" : ""} · ${structure.invites} invitation${structure.invites > 1 ? "s" : ""}`}
                />
            </div>

            {todo.length > 0 && (
                <section className="overview-todo">
                    <div className="guild-section-head">
                        <h3>À traiter</h3>
                        <span className="guild-section-rule" />
                    </div>
                    <ul>
                        {todo.map((item) => (
                            <li key={item.id} className={item.urgent ? "is-urgent" : ""}>
                                <span className="overview-todo-copy">
                                    <strong>{item.text}</strong>
                                    {item.detail && <small>{item.detail}</small>}
                                </span>
                                <button type="button" className="btn btn-ghost" onClick={item.go}>{item.action}</button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {health && (
                <section className="overview-health">
                    <div className="guild-section-head">
                        <h3>Santé de la communauté</h3>
                        <span className="guild-section-rule" />
                    </div>
                    <div className="overview-health-grid">
                        <Indicator label="Accueil complété" value={health.onboardingRate} suffix="%" />
                        <Indicator label="Actifs à J+7" value={health.retentionRate} suffix="%" />
                        <Indicator label="Sanctions / 30 jours" value={health.sanctionsPerMonth} />
                        <Indicator
                            label="Contraste de la teinte"
                            value={health.accentContrast ? (health.accentContrast.ok ? "AA" : "insuffisant") : null}
                            ok={health.accentContrast?.ok}
                        />
                    </div>
                </section>
            )}

            <section className="overview-detail">
                <h3>Arrivées</h3>
                <dl>
                    <div><dt>Cette semaine</dt><dd>{members.joinedWeek}</dd></div>
                    <div><dt>Ce mois-ci</dt><dd>{members.joinedMonth}</dd></div>
                    <div><dt>Comptes automatisés</dt><dd>{members.bots}</dd></div>
                </dl>
                {members.joinedMonth > 0 && members.joinedWeek > members.joinedMonth / 2 && (
                    <p className="overview-note">
                        Plus de la moitié des arrivées du mois datent de cette semaine.
                    </p>
                )}
            </section>
        </div>
    );
}

function Indicator({ label, value, suffix = "", ok }) {
    return (
        <div className={`overview-indicator${ok === false ? " is-warn" : ""}`}>
            <span>{label}</span>
            <strong>{value === null || value === undefined ? "pas encore" : `${value}${suffix}`}</strong>
        </div>
    );
}

function Card({ label, value, hint, suffix = "" }) {
    return (
        <div className="overview-card">
            <span className="overview-card-label">{label}</span>
            <strong className="overview-card-value">{value.toLocaleString("fr-FR")}{suffix}</strong>
            <span className="overview-card-hint">{hint}</span>
        </div>
    );
}
