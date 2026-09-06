import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import SecurityKeys from "./SecurityKeys.jsx";
import AccessTokens from "./AccessTokens.jsx";
import TwoFactorSettings from "./TwoFactorSettings.jsx";
import { useAuth } from "../../context/useAuth.js";

export default function SecuritySettings() {
    const { user } = useAuth();
    const [devices, setDevices] = useState(null);
    const [history, setHistory] = useState(null);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    async function refresh() {
        const [{ devices: list }, { entries }] = await Promise.all([
            api("/auth/devices"),
            api("/auth/history?limit=20"),
        ]);
        setDevices(list);
        setHistory(entries);
    }

    useEffect(() => {
        let cancelled = false;
        Promise.all([api("/auth/devices"), api("/auth/history?limit=20")])
            .then(([{ devices: list }, { entries }]) => {
                if (cancelled) return;
                setDevices(list);
                setHistory(entries);
            })
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Sécurité indisponible."));
        return () => {
            cancelled = true;
        };
    }, []);

    async function changePassword(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const { revokedSessions } = await api("/auth/password", {
                method: "POST",
                body: { currentPassword: current, newPassword: next },
            });
            setCurrent("");
            setNext("");
            setNotice(
                revokedSessions > 0
                    ? `Mot de passe modifié. ${revokedSessions} autre${revokedSessions > 1 ? "s" : ""} session${revokedSessions > 1 ? "s" : ""} fermée${revokedSessions > 1 ? "s" : ""}.`
                    : "Mot de passe modifié."
            );
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Mot de passe non modifié.");
        } finally {
            setBusy(false);
        }
    }

    async function revoke(sessionId) {
        setError(null);
        try {
            await api(`/auth/devices/${sessionId}`, { method: "DELETE" });
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Appareil non déconnecté.");
        }
    }

    async function revokeOthers() {
        setError(null);
        try {
            const { revokedSessions } = await api("/auth/devices", { method: "DELETE" });
            setNotice(
                `${revokedSessions} appareil${revokedSessions > 1 ? "s" : ""} déconnecté${revokedSessions > 1 ? "s" : ""}.`
            );
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Déconnexion impossible.");
        }
    }

    return (
        <div className="appearance-settings">
            <section className="settings-section">
                <div className="settings-section-title">
                    <h3 className="settings-h">Adresse e-mail</h3>
                    <span className={`settings-status${user.isEmailVerified ? " is-enabled" : ""}`}>
                        {user.isEmailVerified ? "Vérifiée" : "À vérifier"}
                    </span>
                </div>
                <p className="settings-p">{user.email}</p>
                {!user.isEmailVerified && (
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            setError(null);
                            setNotice(null);
                            try {
                                const result = await api("/auth/verify/send", { method: "POST" });
                                if (result.alreadyVerified) setNotice("Votre adresse est déjà vérifiée.");
                                else if (result.delivered)
                                    setNotice("Le lien de vérification a été envoyé. Consultez votre messagerie.");
                                else
                                    setError(
                                        "L’envoi d’e-mails est indisponible. Contactez l’administrateur de cette instance."
                                    );
                            } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Le lien n’a pas pu être envoyé.");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Renvoyer le lien de vérification
                    </button>
                )}
            </section>
            <TwoFactorSettings />
            <section className="settings-section">
                <h3 className="settings-h">Mot de passe</h3>
                <p className="settings-p">Le changer ferme toutes vos autres sessions.</p>
                <form className="profile-settings" onSubmit={changePassword}>
                    <label className="field">
                        <span className="field-label">Mot de passe actuel</span>
                        <input
                            className="field-input"
                            type="password"
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    <label className="field">
                        <span className="field-label">Nouveau mot de passe — 15 caractères minimum</span>
                        <input
                            className="field-input"
                            type="password"
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                            minLength={15}
                            autoComplete="new-password"
                            required
                        />
                    </label>
                    <div className="settings-actions">
                        <button className="btn btn-accent" disabled={busy || next.length < 15}>
                            {busy ? "Enregistrement…" : "Changer le mot de passe"}
                        </button>
                    </div>
                </form>
            </section>

            <section className="settings-section">
                <div className="popout-card-head">
                    <h3 className="settings-h">Appareils connectés</h3>
                    {devices?.length > 1 && (
                        <button type="button" className="popout-manage" onClick={revokeOthers}>
                            Déconnecter les autres
                        </button>
                    )}
                </div>
                {devices === null && !error && <p className="popout-role-empty">Chargement…</p>}
                <ul className="device-list">
                    {devices?.map((device) => (
                        <li key={device.sessionId}>
                            <span>
                                <strong>
                                    {device.label}
                                    {device.current && <em> · cet appareil</em>}
                                </strong>
                                <small>
                                    Ouvert le {new Date(device.createdAt).toLocaleDateString("fr-FR")}
                                    {device.lastUsedAt
                                        ? ` · vu le ${new Date(device.lastUsedAt).toLocaleDateString("fr-FR")}`
                                        : ""}
                                </small>
                            </span>
                            {!device.current && (
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => revoke(device.sessionId)}
                                >
                                    Déconnecter
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <SecurityKeys />

            <AccessTokens />

            <section className="settings-section">
                <h3 className="settings-h">Connexions récentes</h3>
                <p className="settings-p">Une connexion que vous ne reconnaissez pas ? Changez votre mot de passe.</p>
                <ul className="device-list">
                    {history?.map((entry) => (
                        <li key={entry.entryId}>
                            <span>
                                <strong>
                                    {entry.outcome === "success" ? "Connexion réussie" : "Tentative refusée"}
                                </strong>
                                <small>
                                    {entry.label} · {new Date(entry.createdAt).toLocaleString("fr-FR")}
                                </small>
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            {notice && (
                <p className="settings-notice" role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className="auth-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
