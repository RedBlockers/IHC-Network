import { useRef, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Modal from "../ui/Modal.jsx";
import Icon from "../ui/Icon.jsx";

const MAX_OPTIONS = 10;

const DURATIONS = [
    { hours: null, label: "Sans limite" },
    { hours: 1, label: "1 heure" },
    { hours: 24, label: "1 jour" },
    { hours: 72, label: "3 jours" },
    { hours: 168, label: "1 semaine" },
];

export default function PollComposer({ open, channelId, draft, onClose, onCreated }) {
    const [question, setQuestion] = useState(draft?.question ?? "");
    const [options, setOptions] = useState(() => {
        const carried = draft?.options ?? [];
        const texts = [...carried, "", ""].slice(0, Math.max(2, carried.length));
        return texts.map((text, index) => ({ id: index, text }));
    });
    const nextId = useRef(20);
    const [anonymous, setAnonymous] = useState(true);
    const [closesInHours, setCloses] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const fields = useRef({});

    const filled = options.map((option) => option.text.trim()).filter(Boolean);
    const duplicate = new Set(filled.map((o) => o.toLowerCase())).size !== filled.length;

    const blocking = !question.trim()
        ? "Écrivez la question."
        : filled.length < 2
          ? "Il faut au moins deux réponses."
          : duplicate
            ? "Deux réponses identiques ne se distinguent pas au dépouillement."
            : null;

    function setOption(id, text) {
        setOptions((current) => current.map((option) => (option.id === id ? { ...option, text } : option)));
    }

    function addOption() {
        if (options.length >= MAX_OPTIONS) return;
        const id = nextId.current++;
        setOptions((current) => [...current, { id, text: "" }]);
        requestAnimationFrame(() => fields.current[id]?.focus());
    }

    function removeOption(id) {
        if (options.length <= 2) return setOption(id, "");
        delete fields.current[id];
        return setOptions((current) => current.filter((option) => option.id !== id));
    }

    async function submit(event) {
        event.preventDefault();
        if (blocking || busy) return;

        setBusy(true);
        setError(null);
        try {
            await api(`/channels/${channelId}/polls`, {
                method: "POST",
                body: { question: question.trim(), options: filled, anonymous, closesInHours },
            });
            setQuestion("");
            setOptions([{ id: 0, text: "" }, { id: 1, text: "" }]);
            onCreated?.();
            onClose();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Le sondage n’a pas pu être créé.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Nouveau sondage">
            <form className="form poll-composer" onSubmit={submit}>
                {error && <p className="form-error" role="alert">{error}</p>}

                <label className="field">
                    <span className="field-label">Question</span>
                    <input
                        className="field-input"
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        placeholder="La taverne ouvre à quelle heure ?"
                        maxLength={300}
                        data-autofocus
                    />
                </label>

                <div className="field">
                    <span className="field-label">Réponses</span>
                    <ul className="poll-options">
                        {options.map((option, index) => (
                            <li key={option.id}>
                                <input
                                    className="field-input"
                                    ref={(node) => {
                                        fields.current[option.id] = node;
                                    }}
                                    value={option.text}
                                    onChange={(event) => setOption(option.id, event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Enter") return;
                                        event.preventDefault();
                                        if (index === options.length - 1) addOption();
                                        else fields.current[options[index + 1].id]?.focus();
                                    }}
                                    placeholder={`Réponse ${index + 1}`}
                                    maxLength={120}
                                />
                                <button
                                    type="button"
                                    className="icon-button"
                                    onClick={() => removeOption(option.id)}
                                    aria-label={`Retirer la réponse ${index + 1}`}
                                    disabled={options.length <= 2 && !option.text}
                                >
                                    <Icon name="close" size={15} />
                                </button>
                            </li>
                        ))}
                    </ul>

                    {options.length < MAX_OPTIONS && (
                        <button type="button" className="btn btn-quiet poll-add" onClick={addOption}>
                            <Icon name="plus" size={15} /> Ajouter une réponse
                        </button>
                    )}
                </div>

                <fieldset className="field segmented-field">
                    <legend className="field-label">Durée</legend>
                    <div className="segmented">
                        {DURATIONS.map((duration) => (
                            <label key={duration.label} className="segment">
                                <input
                                    type="radio"
                                    name="poll-duration"
                                    checked={closesInHours === duration.hours}
                                    onChange={() => setCloses(duration.hours)}
                                />
                                <span>{duration.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="poll-anonymous">
                    <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                    <span>
                        <strong>Vote anonyme</strong>
                        <small>Personne ne verra qui a voté quoi, vous compris.</small>
                    </span>
                </label>

                <div className="modal-actions">
                    {blocking && <p className="poll-blocking" role="status">{blocking}</p>}
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                    <button type="submit" className="btn btn-accent" disabled={Boolean(blocking) || busy}>
                        {busy ? "Création…" : "Créer le sondage"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
