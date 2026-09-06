import { useState } from "react";

import { api, ApiError } from "../../lib/api";
import Modal from "../ui/Modal.jsx";
import AvatarPicker from "../auth/AvatarPicker.jsx";

export default function CreateGuildModal({ open, onClose, onCreated, onJoin }) {
    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const body = new FormData();
            body.append("name", name.trim());
            if (icon) body.append("icon", icon);
            const { guild } = await api("/guilds", { method: "POST", body });
            onCreated(guild.guildId);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Création impossible.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Créer un serveur" size="dialog">
            <form className="form form-discord" onSubmit={submit}>
                <p className="form-sub">Un nom, une icône. Le reste se règle après.</p>
                <div className="form-identity form-identity-stack">
                    <AvatarPicker value={icon} onChange={setIcon} displayName={name} />
                    <label className="field field-grow">
                        <span className="field-label">Nom du serveur</span>
                        <input
                            className="field-input"
                            type="text"
                            placeholder="Nom du serveur"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            minLength={3}
                            maxLength={50}
                            data-autofocus
                        />
                    </label>
                </div>
                {error && (
                    <p className="auth-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={onJoin}>
                        Rejoindre un serveur
                    </button>
                    <div className="modal-actions-end">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Annuler
                        </button>
                        <button type="submit" className="btn btn-accent" disabled={busy || name.trim().length < 3}>
                            {busy ? "Création…" : "Créer"}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
