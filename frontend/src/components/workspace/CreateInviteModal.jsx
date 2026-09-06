import { useState } from "react";

import { api, ApiError } from "../../lib/api";
import Modal from "../ui/Modal.jsx";

const DURATIONS = [
    { value: "1", label: "1 heure" },
    { value: "24", label: "1 jour" },
    { value: "168", label: "7 jours" },
    { value: "", label: "Jamais" },
];

const USES = [
    { value: "", label: "Illimitées" },
    { value: "1", label: "1 utilisation" },
    { value: "5", label: "5 utilisations" },
    { value: "10", label: "10 utilisations" },
    { value: "25", label: "25 utilisations" },
    { value: "50", label: "50 utilisations" },
    { value: "100", label: "100 utilisations" },
];

export default function CreateInviteModal({ open, guild, onClose }) {
    const [maxUses, setMaxUses] = useState("50");
    const [expiresInHours, setExpiresInHours] = useState("168");
    const [invite, setInvite] = useState(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function create(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const { invite: created } = await api(`/guilds/${guild.guildId}/invites`, {
                method: "POST",
                body: {
                    maxUses: maxUses ? Number(maxUses) : null,
                    expiresInHours: expiresInHours ? Number(expiresInHours) : null,
                },
            });
            setInvite({ ...created, url: `${window.location.origin}/invite/${created.code}` });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Impossible de créer l’invitation.");
        } finally {
            setBusy(false);
        }
    }

    async function copy() {
        if (!invite) return;
        try {
            await navigator.clipboard.writeText(invite.url);
            setCopied(true);
        } catch {
            document.querySelector("#invite-link-output")?.select();
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={`Inviter des amis sur ${guild?.name || "le serveur"}`} size="dialog">
            {invite ? (
                <div className="form form-discord">
                    <label className="field">
                        <span className="field-label">Lien d’invitation</span>
                        <div className="copy-field">
                            <input id="invite-link-output" className="field-input field-mono" readOnly value={invite.url} />
                            <button className="btn btn-accent" type="button" onClick={copy}>{copied ? "Copié" : "Copier"}</button>
                        </div>
                    </label>
                    <div className="modal-actions">
                        <button className="btn btn-ghost" type="button" onClick={onClose}>Terminé</button>
                    </div>
                </div>
            ) : (
                <form className="form form-discord" onSubmit={create}>
                    <label className="field">
                        <span className="field-label">Expire après</span>
                        <select className="field-input field-select" value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)}>
                            {DURATIONS.map((option) => (
                                <option key={option.label} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span className="field-label">Nombre max. d’utilisations</span>
                        <select className="field-input field-select" value={maxUses} onChange={(event) => setMaxUses(event.target.value)}>
                            {USES.map((option) => (
                                <option key={option.label} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                        <button className="btn btn-accent" disabled={busy}>{busy ? "Création…" : "Générer un lien"}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
