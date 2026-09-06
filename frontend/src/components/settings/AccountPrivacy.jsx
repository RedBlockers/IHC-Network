import { useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { useAuth } from "../../context/useAuth.js";
import PasswordField from "../auth/PasswordField.jsx";

export default function AccountPrivacy({ guilds }) {
    const { user, logout, setAuthNotice } = useAuth();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const owned = guilds.filter((guild) => Number(guild.ownerId) === Number(user.userId));

    async function exportData() {
        setBusy(true);
        setError(null);
        try {
            const data = await api("/account/export");
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `qweillo-${user.handle}.json`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "L’export n’a pas pu être préparé.");
        } finally {
            setBusy(false);
        }
    }

    async function requestDeletion(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const result = await api("/account/deletion", { method: "POST", body: { password } });
            setAuthNotice(
                `Suppression demandée. Vous pouvez l’annuler en vous reconnectant dans les ${result.graceDays} prochains jours.`
            );
            await logout();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "La suppression n’a pas pu être demandée.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="appearance-settings">
            <section className="settings-section">
                <h3 className="settings-h">Exporter mes données</h3>
                <p className="settings-p">
                    Téléchargez votre profil, vos préférences, vos communautés et votre historique de connexion au
                    format JSON. Les messages partagés ne figurent pas dans cet export.
                </p>
                <button type="button" className="btn btn-secondary" onClick={exportData} disabled={busy}>
                    Télécharger mes données
                </button>
            </section>
            <section className="settings-section">
                <h3 className="settings-h">Supprimer mon compte</h3>
                <p className="settings-p">
                    La demande ferme vos sessions. Vous disposez de 30 jours pour l’annuler en vous reconnectant. Passé
                    ce délai, le compte est supprimé.
                </p>
                {owned.length > 0 ? (
                    <p className="settings-notice">
                        Transférez ou supprimez d’abord les communautés dont vous êtes propriétaire :{" "}
                        {owned.map((guild) => guild.name).join(", ")}. Cette action se trouve dans leurs paramètres,
                        rubrique Propriété.
                    </p>
                ) : !confirm ? (
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirm(true)}>
                        Demander la suppression
                    </button>
                ) : (
                    <form className="profile-settings" onSubmit={requestDeletion}>
                        <PasswordField
                            label="Votre mot de passe"
                            value={password}
                            onChange={setPassword}
                            autoComplete="current-password"
                        />
                        <div className="settings-actions">
                            <button className="btn btn-danger" disabled={busy || !password}>
                                Confirmer la demande de suppression
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => {
                                    setConfirm(false);
                                    setPassword("");
                                }}
                            >
                                Annuler
                            </button>
                        </div>
                    </form>
                )}
            </section>
            {error && (
                <p className="auth-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
