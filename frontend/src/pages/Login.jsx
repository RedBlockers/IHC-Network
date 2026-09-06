import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth.js";
import { ApiError } from "../lib/api";
import Logo from "../components/ui/Logo.jsx";
import PasswordField from "../components/auth/PasswordField.jsx";
import Icon from "../components/ui/Icon.jsx";
import InstanceButton from "../components/workspace/InstanceButton.jsx";
import { isSupported } from "../lib/securityKeys.js";

export default function Login() {
    const { login, loginWithSecurityKey, authNotice } = useAuth();
    const location = useLocation();
    const [handle, setHandle] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [secondFactor, setSecondFactor] = useState(false);
    const [recovery, setRecovery] = useState(false);
    const [code, setCode] = useState("");
    const keysAvailable = useMemo(() => isSupported(), []);

    async function onSubmit(event) {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await login(
                handle.trim(),
                password,
                secondFactor ? { [recovery ? "recoveryCode" : "code"]: code.trim() } : {}
            );
        } catch (err) {
            if (err?.details?.twoFactorRequired) {
                setSecondFactor(true);
                setError(
                    secondFactor ? "Ce code n’est pas valide. Utilisez un nouveau code ou un code de secours." : null
                );
            } else setError(err instanceof ApiError ? err.message : "Connexion impossible pour le moment.");
            setBusy(false);
        }
    }

    async function withKey() {
        setError(null);
        setBusy(true);
        try {
            await loginWithSecurityKey();
        } catch (err) {
            if (err?.name === "NotAllowedError") setError("Aucune clé n’a été présentée.");
            else setError(err instanceof ApiError ? err.message : "Connexion impossible pour le moment.");
            setBusy(false);
        }
    }

    return (
        <div className="onboarding-page login-page">
            <header className="onboarding-topbar">
                <Link to="/" aria-label="qweillo">
                    <Logo size={34} withWordmark />
                </Link>
                <InstanceButton />
            </header>
            <main className="onboarding-shell login-shell">
                <section className="onboarding-content" aria-labelledby="login-title">
                    <p className="onboarding-step">Connexion</p>
                    <header className="onboarding-head">
                        <h1 id="login-title">Ravi de vous revoir</h1>
                        <p>Reprenez vos conversations là où vous les avez laissées.</p>
                    </header>

                    <form className="auth-form" onSubmit={onSubmit} noValidate>
                        {authNotice && (
                            <p className="settings-notice" role="status">
                                {authNotice}
                            </p>
                        )}
                        <label className="field">
                            <span className="field-label">Pseudo</span>
                            <input
                                className="field-input"
                                type="text"
                                autoComplete="username"
                                autoFocus
                                placeholder="ada"
                                value={handle}
                                onChange={(e) => setHandle(e.target.value)}
                                required
                            />
                        </label>

                        <PasswordField
                            label="Mot de passe"
                            autoComplete="current-password"
                            value={password}
                            onChange={setPassword}
                        />
                        <Link className="auth-text-link" to="/forgot-password">
                            Mot de passe oublié ?
                        </Link>

                        {secondFactor && (
                            <div className="auth-form">
                                <label className="field">
                                    <span className="field-label" id="second-factor-label">
                                        {recovery ? "Code de secours" : "Code de votre application"}
                                    </span>
                                    <input
                                        className="field-input"
                                        aria-labelledby="second-factor-label"
                                        aria-describedby="second-factor-hint"
                                        value={code}
                                        onChange={(event) => setCode(event.target.value)}
                                        autoComplete="one-time-code"
                                        inputMode={recovery ? "text" : "numeric"}
                                        maxLength={recovery ? 32 : 6}
                                        autoFocus
                                        required
                                    />
                                    <span className="field-hint" id="second-factor-hint">
                                        {recovery
                                            ? "Chaque code de secours ne fonctionne qu’une fois."
                                            : "Saisissez le code à 6 chiffres de votre application d’authentification."}
                                    </span>
                                </label>
                                <button
                                    type="button"
                                    className="auth-text-link"
                                    onClick={() => {
                                        setRecovery(!recovery);
                                        setCode("");
                                        setError(null);
                                    }}
                                >
                                    {recovery
                                        ? "Utiliser l’application d’authentification"
                                        : "Utiliser un code de secours"}
                                </button>
                            </div>
                        )}

                        {error && (
                            <p className="auth-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button className="btn btn-accent btn-block" type="submit" disabled={busy}>
                            {busy ? "Connexion…" : "Se connecter"}
                        </button>
                    </form>

                    {keysAvailable && (
                        <>
                            <p className="auth-separator">
                                <span>ou</span>
                            </p>
                            <button type="button" className="btn btn-ghost btn-block" onClick={withKey} disabled={busy}>
                                <Icon name="check" size={16} /> Utiliser une clé de sécurité
                            </button>
                        </>
                    )}

                    <p className="auth-switch">
                        Nouveau sur qweillo ? <Link to={`/register${location.search}`}>Créer un compte</Link>
                    </p>
                </section>
            </main>
        </div>
    );
}
