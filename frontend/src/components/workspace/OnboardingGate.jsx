import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Modal from "../ui/Modal.jsx";

export default function OnboardingGate({ guild, onDone }) {
    const [data, setData] = useState(null);
    const [accepted, setAccepted] = useState(false);
    const [chosen, setChosen] = useState(() => new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/onboarding`)
            .then((result) => !cancelled && setData(result))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Accueil indisponible."));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId]);

    if (!data || !data.status.required || data.status.completed) return null;

    const toggle = (optionId) =>
        setChosen((current) => {
            const next = new Set(current);
            if (next.has(optionId)) next.delete(optionId);
            else next.add(optionId);
            return next;
        });

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const { status } = await api(`/guilds/${guild.guildId}/onboarding/complete`, {
                method: "POST",
                body: { accepted: true, optionIds: [...chosen] },
            });
            onDone?.(status);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Accueil non validé.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open onClose={() => onDone?.(null)} title={`Bienvenue dans ${guild.name}`} className="modal-onboarding">
            <form className="onboarding-form" onSubmit={submit}>
                <section className="settings-section">
                    <h3 className="settings-h">Le règlement</h3>
                    <p className="onboarding-rules">{data.onboarding.rules}</p>
                    <label className="settings-toggles">
                        <span style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                            <span>
                                <strong>J’ai lu et j’accepte ce règlement</strong>
                                <small>Sans cela, vous pouvez lire la communauté mais pas y écrire.</small>
                            </span>
                        </span>
                    </label>
                </section>

                {data.onboarding.questions.map((question) => (
                    <section className="settings-section" key={question.questionId}>
                        <h3 className="settings-h">{question.prompt}</h3>
                        <p className="settings-p">Vos réponses peuvent vous ouvrir des salons.</p>
                        <div className="onboarding-options">
                            {question.options.map((option) => (
                                <button
                                    key={option.optionId}
                                    type="button"
                                    aria-pressed={chosen.has(option.optionId)}
                                    className={chosen.has(option.optionId) ? "is-on" : ""}
                                    onClick={() => toggle(option.optionId)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </section>
                ))}

                {data.status.quarantineUntil && (
                    <p className="settings-warning" role="status">
                        Cette communauté observe les arrivées : vous pourrez écrire à partir du{" "}
                        {new Date(data.status.quarantineUntil).toLocaleString("fr-FR")}.
                    </p>
                )}

                {error && <p className="auth-error" role="alert">{error}</p>}

                <div className="modal-actions">
                    <button className="btn btn-accent" disabled={!accepted || busy}>
                        {busy ? "Validation…" : "Rejoindre la conversation"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
