import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Icon from "../ui/Icon.jsx";

export default function OnboardingAdmin({ guild }) {
    const [enabled, setEnabled] = useState(false);
    const [rules, setRules] = useState("");
    const [quarantine, setQuarantine] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([api(`/guilds/${guild.guildId}/onboarding`), api(`/guilds/${guild.guildId}/roles`)])
            .then(([{ onboarding }, { roles: list }]) => {
                if (cancelled) return;
                setEnabled(onboarding.enabled);
                setRules(onboarding.rules);
                setQuarantine(onboarding.quarantineMinutes);
                setQuestions(onboarding.questions);
                setRoles(list.filter((role) => !role.isDefault && !role.isManaged));
            })
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Accueil indisponible."));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId]);

    const patchQuestion = (index, patch) =>
        setQuestions((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    const patchOption = (qi, oi, patch) =>
        patchQuestion(qi, {
            options: questions[qi].options.map((option, i) => (i === oi ? { ...option, ...patch } : option)),
        });

    async function save(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await api(`/guilds/${guild.guildId}/onboarding`, {
                method: "PUT",
                body: {
                    enabled,
                    rules,
                    quarantineMinutes: Number(quarantine) || 0,
                    questions: questions.map((question) => ({
                        prompt: question.prompt,
                        options: question.options.map((option) => ({ label: option.label, roleId: option.roleId ?? null })),
                    })),
                },
            });
            setNotice("Accueil enregistré.");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Accueil non enregistré.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="audit-log" onSubmit={save}>
            <p className="settings-p">
                Tant que l’accueil n’est pas terminé, un arrivant lit la communauté mais n’y écrit pas.
            </p>

            <ul className="settings-toggles">
                <li>
                    <label>
                        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                        <span>
                            <strong>Demander un accueil avant de participer</strong>
                            <small>Exige un règlement lisible.</small>
                        </span>
                    </label>
                </li>
            </ul>

            <label className="field">
                <span className="field-label">Règlement</span>
                <textarea
                    className="field-input field-textarea"
                    rows={6}
                    maxLength={4000}
                    value={rules}
                    onChange={(event) => setRules(event.target.value)}
                    placeholder="Ce que vous attendez des membres, en clair."
                />
            </label>

            <label className="field">
                <span className="field-label">Période d’observation (minutes, 0 pour aucune)</span>
                <input
                    className="field-input"
                    type="number"
                    min={0}
                    max={10080}
                    value={quarantine}
                    onChange={(event) => setQuarantine(event.target.value)}
                />
            </label>

            {questions.map((question, qi) => (
                <section className="settings-section" key={qi}>
                    <div className="popout-card-head">
                        <label className="field field-grow">
                            <span className="field-label">Question {qi + 1}</span>
                            <input
                                className="field-input"
                                value={question.prompt}
                                maxLength={200}
                                onChange={(event) => patchQuestion(qi, { prompt: event.target.value })}
                            />
                        </label>
                        <button type="button" className="popout-manage" onClick={() => setQuestions((c) => c.filter((_, i) => i !== qi))}>
                            <Icon name="trash" size={13} /> Retirer
                        </button>
                    </div>

                    {question.options.map((option, oi) => (
                        <div className="onboarding-option-row" key={oi}>
                            <input
                                className="field-input"
                                value={option.label}
                                maxLength={80}
                                placeholder="Réponse proposée"
                                onChange={(event) => patchOption(qi, oi, { label: event.target.value })}
                            />
                            <select
                                className="field-input"
                                value={option.roleId ?? ""}
                                onChange={(event) => patchOption(qi, oi, { roleId: event.target.value ? Number(event.target.value) : null })}
                            >
                                <option value="">Aucun rôle</option>
                                {roles.map((role) => (
                                    <option key={role.roleId} value={role.roleId}>{role.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="side-unpin"
                                aria-label="Retirer la réponse"
                                onClick={() => patchQuestion(qi, { options: question.options.filter((_, i) => i !== oi) })}
                            >
                                <Icon name="close" size={13} />
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        className="popout-manage"
                        onClick={() => patchQuestion(qi, { options: [...question.options, { label: "", roleId: null }] })}
                    >
                        <Icon name="plus" size={13} /> Ajouter une réponse
                    </button>
                </section>
            ))}

            {questions.length < 10 && (
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setQuestions((c) => [...c, { prompt: "", options: [{ label: "", roleId: null }] }])}
                >
                    Ajouter une question
                </button>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="settings-notice" role="status">{notice}</p>}

            <div className="modal-actions">
                <button className="btn btn-accent" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer l’accueil"}</button>
            </div>
        </form>
    );
}
