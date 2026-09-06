import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useDebouncedAvailability } from "../components/auth/useDebouncedAvailability.js";
import { useAuth } from "../context/useAuth.js";
import { ApiError } from "../lib/api";
import Logo from "../components/ui/Logo.jsx";
import PasswordField from "../components/auth/PasswordField.jsx";
import AvatarPicker from "../components/auth/AvatarPicker.jsx";

export default function Register() {
    const { register } = useAuth();
    const location = useLocation();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ handle: "", displayName: "", email: "", password: "", bio: "" });
    const [avatar, setAvatar] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const handleState = useDebouncedAvailability(form.handle);
    const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

    async function onSubmit(event) {
        event.preventDefault();
        setError(null);

        if (step === 1) {
            setStep(2);
            return;
        }

        setBusy(true);
        try {
            const body = new FormData();
            body.append("handle", form.handle.trim());
            if (form.displayName.trim()) body.append("displayName", form.displayName.trim());
            body.append("email", form.email.trim());
            body.append("password", form.password);
            if (form.bio.trim()) body.append("bio", form.bio.trim());
            if (avatar) body.append("avatar", avatar);
            await register(body);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Inscription impossible pour le moment.");
            setBusy(false);
        }
    }

    return (
        <div className="onboarding-page">
            <header className="onboarding-topbar">
                <Link to="/" aria-label="qweillo">
                    <Logo size={34} withWordmark />
                </Link>
                <span>Un compte, toutes vos communautés</span>
            </header>

            <main className="onboarding-shell">
                <div className="onboarding-progress" aria-hidden="true">
                    <span className="onboarding-progress-value" style={{ width: `${step * 50}%` }} />
                </div>

                <section className="onboarding-content" aria-labelledby="register-title">
                    <p className="onboarding-step">Étape {step} sur 2</p>
                    <header className="onboarding-head">
                        <h1 id="register-title">{step === 1 ? "Créer un compte" : "Votre profil"}</h1>
                        <p>
                            {step === 1
                                ? "Gratuit, sans carte. Un seul compte pour toutes vos communautés."
                                : "Choisissez comment les autres membres vous reconnaîtront."}
                        </p>
                    </header>

                    <form className="auth-form onboarding-form" onSubmit={onSubmit}>
                        {step === 1 ? (
                            <>
                                <label className="field">
                                    <span className="field-label">Adresse e-mail</span>
                                    <input
                                        className="field-input"
                                        type="email"
                                        autoComplete="email"
                                        autoFocus
                                        placeholder="vous@exemple.fr"
                                        value={form.email}
                                        onChange={set("email")}
                                        required
                                    />
                                </label>

                                <PasswordField
                                    label="Mot de passe"
                                    autoComplete="new-password"
                                    value={form.password}
                                    onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                                    minLength={15}
                                    hint="15 caractères minimum. Utilisez un mot de passe unique."
                                />

                                <button className="btn btn-accent btn-block" type="submit">
                                    Continuer
                                </button>

                                <p className="onboarding-note">Votre profil sera configuré à l’étape suivante.</p>
                            </>
                        ) : (
                            <>
                                <div className="onboarding-avatar-row">
                                    <AvatarPicker onChange={setAvatar} displayName={form.displayName || form.handle} />
                                    <div>
                                        <strong>Photo de profil</strong>
                                        <span>PNG, JPG, WebP ou GIF · 5 Mo maximum</span>
                                    </div>
                                </div>

                                <label className="field">
                                    <span className="field-label">
                                        Pseudo
                                        {handleState.status === "taken" && <em className="field-flag field-flag-bad">déjà pris</em>}
                                        {handleState.status === "free" && <em className="field-flag field-flag-ok">disponible</em>}
                                    </span>
                                    <input
                                        className="field-input"
                                        type="text"
                                        autoComplete="username"
                                        placeholder="ada"
                                        value={form.handle}
                                        onChange={set("handle")}
                                        required
                                        minLength={3}
                                        maxLength={20}
                                        pattern="[A-Za-z0-9_]+"
                                    />
                                    <span className="field-hint">3 à 20 caractères, lettres, chiffres et tiret bas.</span>
                                </label>

                                <label className="field">
                                    <span className="field-label">
                                        Nom affiché <em className="field-flag">optionnel</em>
                                    </span>
                                    <input
                                        className="field-input"
                                        type="text"
                                        placeholder="Ada Lovelace"
                                        value={form.displayName}
                                        onChange={set("displayName")}
                                        maxLength={32}
                                    />
                                </label>

                                {error && <p className="auth-error" role="alert">{error}</p>}

                                <div className="onboarding-actions">
                                    <button className="btn btn-ghost" type="button" onClick={() => setStep(1)} disabled={busy}>
                                        Précédent
                                    </button>
                                    <button
                                        className="btn btn-accent"
                                        type="submit"
                                        disabled={busy || handleState.status === "taken" || handleState.status === "checking"}
                                    >
                                        {busy ? "Création…" : "Créer mon compte"}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>

                    <p className="auth-switch">
                        Déjà un compte ? <Link to={`/login${location.search}`}>Se connecter</Link>
                    </p>
                </section>
            </main>
        </div>
    );
}
