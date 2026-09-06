import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api, ApiError, onUnauthorized, tokenStore } from "../lib/api.js";
import { useAuth } from "../context/useAuth.js";
import Logo from "../components/ui/Logo.jsx";
import Icon from "../components/ui/Icon.jsx";
import PasswordField from "../components/auth/PasswordField.jsx";

const CONTENT = {
    forgot: {
        title: "Mot de passe oublié ?",
        description: "Recevez un lien pour retrouver l’accès à votre compte.",
        action: "Envoyer le lien",
    },
    reset: {
        title: "Un nouveau mot de passe",
        description: "Choisissez au moins 15 caractères. Une phrase facile à retenir convient très bien.",
        action: "Enregistrer le mot de passe",
    },
    verify: {
        title: "Confirmez votre adresse",
        description: "Une dernière étape pour vérifier l’adresse e-mail de votre compte.",
        action: "Confirmer mon adresse",
    },
};

export default function AccountRecovery({ mode }) {
    const location = useLocation();
    const { user, setUser } = useAuth();
    const [token] = useState(() => new URLSearchParams(location.search).get("token") || "");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);
    const content = CONTENT[mode];
    const missingToken = mode !== "forgot" && !token;

    useEffect(() => {
        if (token) window.history.replaceState(window.history.state, "", location.pathname);
    }, [token, location.pathname]);

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setError(null);
        if (mode === "reset" && password !== confirmation) {
            setError("Les deux mots de passe ne correspondent pas.");
            return;
        }
        setBusy(true);
        try {
            if (mode === "forgot") {
                await api("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
            } else if (mode === "reset") {
                await api("/auth/password/reset", { method: "POST", body: { token, newPassword: password } });
                tokenStore.clear();
                onUnauthorized.dispatchEvent(new Event("unauthorized"));
                setPassword("");
                setConfirmation("");
            } else {
                const result = await api("/auth/verify", { method: "POST", body: { token } });
                if (Number(user?.userId) === Number(result.userId)) setUser({ ...user, isEmailVerified: true });
            }
            setDone(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "La demande n’a pas abouti. Réessayez dans un instant.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="onboarding-page recovery-page">
            <header className="onboarding-topbar">
                <Link to="/" aria-label="qweillo">
                    <Logo size={34} withWordmark />
                </Link>
                <Link to="/login">Retour à la connexion</Link>
            </header>
            <main className="onboarding-shell login-shell">
                <section className="onboarding-content" aria-labelledby="recovery-title">
                    <header className="onboarding-head">
                        <h1 id="recovery-title">
                            {done
                                ? mode === "forgot"
                                    ? "Consultez votre messagerie"
                                    : mode === "reset"
                                      ? "Mot de passe enregistré"
                                      : "Adresse confirmée"
                                : content.title}
                        </h1>
                        <p>
                            {done
                                ? mode === "forgot"
                                    ? "Si un compte correspond à cette adresse, vous recevrez un lien valable une heure. Pensez à vérifier vos indésirables."
                                    : mode === "reset"
                                      ? "Vos anciennes sessions sont fermées. Vous pouvez vous connecter avec votre nouveau mot de passe."
                                      : "Votre adresse e-mail est vérifiée. Vous pouvez retrouver vos communautés."
                                : content.description}
                        </p>
                    </header>
                    {done ? (
                        <div className="recovery-success" role="status">
                            <Icon name="check" size={24} />
                            <Link className="btn btn-accent btn-block" to={mode === "verify" && user ? "/" : "/login"}>
                                {mode === "verify" && user ? "Retrouver mes communautés" : "Se connecter"}
                            </Link>
                        </div>
                    ) : missingToken ? (
                        <div className="auth-form">
                            <p className="auth-error" role="alert">
                                Le lien est incomplet. Ouvrez le lien reçu dans votre e-mail.
                            </p>
                            <Link className="btn btn-ghost" to={mode === "reset" ? "/forgot-password" : "/"}>
                                {mode === "reset" ? "Recevoir un nouveau lien" : "Retrouver mon compte"}
                            </Link>
                        </div>
                    ) : (
                        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
                            {mode === "forgot" && (
                                <label className="field">
                                    <span className="field-label">Adresse e-mail</span>
                                    <input
                                        className="field-input"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        maxLength={254}
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                    />
                                </label>
                            )}
                            {mode === "reset" && (
                                <>
                                    <PasswordField
                                        label="Nouveau mot de passe"
                                        value={password}
                                        onChange={setPassword}
                                        minLength={15}
                                        maxLength={200}
                                        autoComplete="new-password"
                                    />
                                    <PasswordField
                                        label="Confirmer le mot de passe"
                                        value={confirmation}
                                        onChange={setConfirmation}
                                        minLength={15}
                                        maxLength={200}
                                        autoComplete="new-password"
                                    />
                                </>
                            )}
                            {error && (
                                <p className="auth-error" role="alert">
                                    {error}
                                </p>
                            )}
                            <button className="btn btn-accent btn-block" disabled={busy}>
                                {busy ? "Un instant…" : content.action}
                            </button>
                            {error && mode === "reset" && (
                                <Link className="auth-text-link" to="/forgot-password">
                                    Recevoir un nouveau lien
                                </Link>
                            )}
                            {error && mode === "verify" && (
                                <Link className="auth-text-link" to="/">
                                    Renvoyer un lien depuis les réglages de sécurité
                                </Link>
                            )}
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
