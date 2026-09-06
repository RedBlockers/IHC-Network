import { useEffect, useState } from "react";
import AsyncSection from "../ui/AsyncSection.jsx";

import { api, ApiError } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";

export default function ReportQueue({ guild }) {
    const [status, setStatus] = useState("open");
    const [data, setData] = useState(null);
    const [openContext, setOpenContext] = useState(null);
    const [error, setError] = useState(null);

    async function load(next = status) {
        try {
            setData(await api(`/guilds/${guild.guildId}/reports?status=${next}&limit=50`));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "File indisponible.");
        }
    }

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/reports?status=${status}&limit=50`)
            .then((result) => !cancelled && setData(result))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "File indisponible."));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, status]);

    async function showContext(report) {
        if (openContext?.reportId === report.reportId) return setOpenContext(null);
        try {
            setOpenContext(await api(`/guilds/${guild.guildId}/reports/${report.reportId}/context`));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Contexte indisponible.");
        }
        return undefined;
    }

    async function resolve(report, outcome) {
        const resolution = window.prompt(
            outcome === "resolved" ? "Qu’avez-vous fait de ce signalement ?" : "Pourquoi ce signalement est-il écarté ?"
        );
        if (!resolution?.trim()) return;
        try {
            await api(`/guilds/${guild.guildId}/reports/${report.reportId}`, {
                method: "PATCH",
                body: { status: outcome, resolution: resolution.trim() },
            });
            setOpenContext(null);
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Signalement non clos.");
        }
    }

    return (
        <section className="audit-log">
            <header>
                <p className="settings-p">
                    {data ? `${data.openCount} en attente.` : "Chargement…"} L’auteur d’un message signalé n’en est
                    jamais informé.
                </p>
                <div className="audit-filters" role="tablist">
                    {[
                        ["open", "En attente"],
                        ["resolved", "Traités"],
                        ["rejected", "Écartés"],
                    ].map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={status === id} className={status === id ? "is-on" : ""} onClick={() => setStatus(id)}>
                            {label}
                        </button>
                    ))}
                </div>
            </header>

            <AsyncSection
                status={error ? "failed" : data === null ? "loading" : "ready"}
                count={data?.reports.length ?? 0}
                error={error}
                empty="Rien dans cette file. Les messages signalés apparaîtront ici."
                announce={(n) => `${n} signalement${n > 1 ? "s" : ""} dans la file.`}
            >
            <ul className="report-list">
                {data?.reports.map((report) => (
                    <li key={report.reportId}>
                        <div className="report-head">
                            <span>
                                <strong>#{report.channel.name}</strong>
                                <small>
                                    signalé par {report.reporter.displayName || report.reporter.handle} ·{" "}
                                    {new Date(report.createdAt).toLocaleString("fr-FR")}
                                </small>
                            </span>
                            {report.status === "open" && (
                                <div className="report-actions">
                                    <button type="button" className="btn btn-ghost" onClick={() => showContext(report)}>
                                        {openContext?.reportId === report.reportId ? "Masquer" : "Voir en contexte"}
                                    </button>
                                    <button type="button" className="btn btn-ghost" onClick={() => resolve(report, "rejected")}>Écarter</button>
                                    <button type="button" className="btn btn-ghost" onClick={() => resolve(report, "resolved")}>Traiter</button>
                                </div>
                            )}
                        </div>

                        <p className="report-reason">« {report.reason} »</p>

                        {report.message ? (
                            <div className="report-message">
                                <Avatar user={report.message.author} size={26} />
                                <span>
                                    <strong>{report.message.author.displayName || report.message.author.handle}</strong>
                                    <small>{report.message.content}</small>
                                </span>
                            </div>
                        ) : (
                            <p className="popout-role-empty">
                                Message supprimé depuis le signalement — le dossier reste ouvert.
                            </p>
                        )}

                        {report.resolution && <p className="report-reason">Clos : {report.resolution}</p>}

                        {openContext?.reportId === report.reportId && (
                            <ol className="report-context">
                                {openContext.context.map((entry) => (
                                    <li key={entry.messageId} className={entry.messageId === openContext.messageId ? "is-target" : ""}>
                                        <strong>{entry.author.displayName || entry.author.handle}</strong>
                                        <span>{entry.content}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </li>
                ))}
            </ul>
            </AsyncSection>
        </section>
    );
}
