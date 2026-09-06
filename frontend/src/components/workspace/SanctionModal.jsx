import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Modal from "../ui/Modal.jsx";

const TYPES = [
    { id: "timeout", label: "Réduire au silence", note: "Le membre reste dans la communauté mais ne peut plus écrire." },
    { id: "kick", label: "Exclure", note: "Le membre quitte la communauté et peut revenir sur invitation." },
    { id: "ban", label: "Bannir", note: "Le membre quitte la communauté et aucune invitation ne le fera revenir." },
];

const DURATIONS = [
    { minutes: 5, label: "5 minutes" },
    { minutes: 60, label: "1 heure" },
    { minutes: 60 * 24, label: "1 jour" },
    { minutes: 60 * 24 * 7, label: "1 semaine" },
];

export default function SanctionModal({ open, guild, member, onClose, onDone }) {
    const [type, setType] = useState("timeout");
    const [reason, setReason] = useState("");
    const [duration, setDuration] = useState(60);
    const [confirmation, setConfirmation] = useState("");
    const [record, setRecord] = useState(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open || !guild || !member) return undefined;
        let cancelled = false;
        api(`/guilds/${guild.guildId}/members/${member.userId}/record`)
            .then((result) => !cancelled && setRecord(result))
            .catch(() => !cancelled && setRecord({ sanctions: [], notes: [] }));
        return () => {
            cancelled = true;
        };
    }, [open, guild, member]);

    const needsConfirmation = type === "ban";
    const confirmed = !needsConfirmation || confirmation.trim() === member?.handle;
    const canSubmit = reason.trim().length >= 3 && confirmed && !busy;

    async function submit(event) {
        event.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            const body = { type, reason: reason.trim() };
            if (type === "timeout") body.durationMinutes = duration;
            const { sanction } = await api(`/guilds/${guild.guildId}/members/${member.userId}/sanctions`, {
                method: "POST",
                body,
            });
            onDone?.(sanction);
            onClose();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Sanction non appliquée.");
        } finally {
            setBusy(false);
        }
    }

    async function addNote(event) {
        event.preventDefault();
        const body = note.trim();
        if (!body) return;
        setBusy(true);
        try {
            const result = await api(`/guilds/${guild.guildId}/members/${member.userId}/notes`, {
                method: "POST",
                body: { body },
            });
            setRecord(result);
            setNote("");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Note non enregistrée.");
        } finally {
            setBusy(false);
        }
    }

    if (!member) return null;

    return (
        <Modal open={open} onClose={onClose} title={`Modération · ${member.displayName || member.handle}`} className="modal-sanction">
            <form className="sanction-form" onSubmit={submit}>
                <fieldset className="sanction-types">
                    <legend className="field-label">Mesure</legend>
                    {TYPES.map((item) => (
                        <label key={item.id} className={type === item.id ? "is-on" : ""}>
                            <input type="radio" name="sanction-type" value={item.id} checked={type === item.id} onChange={() => setType(item.id)} />
                            <span>
                                <strong>{item.label}</strong>
                                <small>{item.note}</small>
                            </span>
                        </label>
                    ))}
                </fieldset>

                {type === "timeout" && (
                    <label className="field">
                        <span className="field-label">Durée</span>
                        <select className="field-input" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                            {DURATIONS.map((item) => (
                                <option key={item.minutes} value={item.minutes}>{item.label}</option>
                            ))}
                        </select>
                    </label>
                )}

                <label className="field">
                    <span className="field-label">Motif — transmis au membre</span>
                    <textarea
                        className="field-input field-textarea"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        maxLength={500}
                        required
                        placeholder="Ce que le membre a fait, en une phrase claire."
                    />
                </label>

                {needsConfirmation && (
                    <label className="field">
                        <span className="field-label">Saisissez « {member.handle} » pour confirmer</span>
                        <input className="field-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                    </label>
                )}

                <p className="sanction-notice">
                    Le membre est notifié du motif et dispose de 14 jours pour contester. L’action est consignée au
                    journal d’audit.
                </p>

                {error && <p className="auth-error" role="alert">{error}</p>}

                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                    <button className="btn btn-danger-confirm" disabled={!canSubmit}>
                        {busy ? "Application…" : TYPES.find((item) => item.id === type).label}
                    </button>
                </div>
            </form>

            <section className="sanction-record">
                <h4>Dossier</h4>
                {record === null && <p className="popout-role-empty">Chargement…</p>}
                {record?.sanctions.length === 0 && <p className="popout-role-empty">Aucune sanction à ce jour.</p>}
                <ul>
                    {record?.sanctions.map((sanction) => (
                        <li key={sanction.sanctionId}>
                            <strong>{sanction.type}</strong> — {sanction.reason}
                            {sanction.revokedAt && <em> · levée</em>}
                            {sanction.appeal && <em> · contestée</em>}
                        </li>
                    ))}
                </ul>

                <form className="sanction-note" onSubmit={addNote}>
                    <label className="field">
                        <span className="field-label">Note privée — invisible du membre</span>
                        <input className="field-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
                    </label>
                    <button className="btn btn-ghost" disabled={!note.trim() || busy}>Ajouter</button>
                </form>

                <ul>
                    {record?.notes.map((item) => (
                        <li key={item.noteId}>
                            <strong>{item.author.displayName || item.author.handle}</strong> — {item.body}
                        </li>
                    ))}
                </ul>
            </section>
        </Modal>
    );
}
