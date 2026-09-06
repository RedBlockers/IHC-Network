import { useState } from "react";

import { api, ApiError } from "../../lib/api";
import Modal from "../ui/Modal.jsx";

function inviteCode(value) {
    const trimmed = value.trim().replace(/\/+$/, "");
    return trimmed.split("/").pop();
}

export default function JoinCommunityModal({ open, onClose, onJoined }) {
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function submit(event) {
        event.preventDefault();
        const code = inviteCode(value);
        if (!/^[A-Za-z0-9_-]{22}$/.test(code)) {
            setError("Saisissez un lien d’invitation ou un code valide.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const { guildId } = await api(`/invites/${encodeURIComponent(code)}/accept`, { method: "POST" });
            onJoined(guildId);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Impossible de rejoindre cette communauté.");
            setBusy(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Rejoindre un serveur">
            <form className="form form-discord" onSubmit={submit}>
                <p className="form-sub">Entrez un lien d’invitation pour rejoindre un serveur existant.</p>
                <label className="field">
                    <span className="field-label">Lien d’invitation</span>
                    <input
                        className="field-input field-mono"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        autoComplete="off"
                        data-autofocus
                        required
                    />
                </label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
                    <button className="btn btn-accent" disabled={busy}>{busy ? "Entrée…" : "Rejoindre"}</button>
                </div>
            </form>
        </Modal>
    );
}
