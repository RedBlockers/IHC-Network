import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import PasswordField from "../auth/PasswordField.jsx";
import QrCode from "../ui/QrCode.jsx";
import { useAuth } from "../../context/useAuth.js";

export default function TwoFactorSettings() {
    const { user } = useAuth();
    const [status, setStatus] = useState(null);
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [codes, setCodes] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [disabling, setDisabling] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        api("/auth/2fa", { signal: controller.signal })
            .then(setStatus)
            .catch((err) => {
                if (!controller.signal.aborted)
                    setError(
                        err instanceof ApiError ? err.message : "État de la double authentification indisponible."
                    );
            });
        return () => controller.abort();
    }, []);

    async function run(action) {
        if (busy) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "La demande n’a pas abouti. Réessayez.");
        } finally {
            setBusy(false);
        }
    }

    async function confirm(event) {
        event.preventDefault();
        await run(async () => {
            const result = await api("/auth/2fa/confirm", { method: "POST", body: { code } });
            setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length });
            setCodes(result.recoveryCodes);
            setSetup(null);
            setCode("");
            setNotice("La double authentification est activée. Conservez vos codes de secours.");
        });
    }

    function downloadCodes() {
        const url = URL.createObjectURL(
            new Blob(
                [
                    `Codes de secours Qweillo\nCompte : ${user.handle}\nInstance : ${window.location.origin}\n\n${codes.join("\n")}`,
                ],
                { type: "text/plain" }
            )
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `qweillo-${user.handle}-${window.location.host.replace(/[^a-z0-9.-]/gi, "_")}-codes.txt`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return (
        <section className="settings-section" aria-busy={busy}>
            <div className="settings-section-title">
                <h3 className="settings-h">Double authentification</h3>
                {status && (
                    <span className={`settings-status${status.enabled ? " is-enabled" : ""}`}>
                        {status.enabled ? "Activée" : "Désactivée"}
                    </span>
                )}
            </div>
            <p className="settings-p">
                Ajoutez un code à usage unique à votre mot de passe pour protéger vos connexions.
            </p>
            {!status && !error && <p role="status">Chargement…</p>}
            {!status && error && (
                <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => run(async () => setStatus(await api("/auth/2fa")))}
                >
                    Réessayer
                </button>
            )}
            {status && !status.enabled && !setup && (
                <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => run(async () => setSetup(await api("/auth/2fa/setup", { method: "POST" })))}
                >
                    Configurer la double authentification
                </button>
            )}
            {setup && (
                <form className="profile-settings two-factor-setup" onSubmit={confirm}>
                    <p>Scannez ce code avec votre application d’authentification, ou ajoutez la clé manuellement.</p>
                    <QrCode value={setup.uri} label="Code QR de configuration de la double authentification" />
                    <label className="field">
                        <span className="field-label">Clé de configuration</span>
                        <input
                            className="field-input recovery-secret"
                            readOnly
                            value={setup.secret}
                            onFocus={(event) => event.target.select()}
                        />
                    </label>
                    <div className="settings-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                                run(async () => {
                                    await navigator.clipboard.writeText(setup.secret);
                                    setNotice("Clé copiée.");
                                })
                            }
                        >
                            Copier la clé
                        </button>
                        <a className="btn btn-ghost" href={setup.uri}>
                            Ouvrir mon application
                        </a>
                    </div>
                    <label className="field">
                        <span className="field-label">Code à 6 chiffres</span>
                        <input
                            className="field-input"
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            required
                        />
                    </label>
                    <div className="settings-actions">
                        <button className="btn btn-accent" disabled={busy || code.length !== 6}>
                            Activer la double authentification
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => {
                                setSetup(null);
                                setCode("");
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            )}
            {status?.enabled && (
                <div className="two-factor-enabled">
                    <p className="settings-p">{status.recoveryCodesRemaining} codes de secours disponibles.</p>
                    <div className="settings-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            onClick={() =>
                                run(async () => {
                                    const result = await api("/auth/2fa/recovery", { method: "POST" });
                                    setCodes(result.recoveryCodes);
                                    setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length });
                                    setNotice("Les anciens codes de secours sont remplacés.");
                                })
                            }
                        >
                            Renouveler les codes de secours
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => setDisabling(!disabling)}
                        >
                            {disabling ? "Annuler" : "Désactiver"}
                        </button>
                    </div>
                    {disabling && (
                        <form
                            className="profile-settings two-factor-setup"
                            onSubmit={(event) => {
                                event.preventDefault();
                                run(async () => {
                                    await api("/auth/2fa", { method: "DELETE", body: { password } });
                                    setPassword("");
                                    setCodes([]);
                                    setDisabling(false);
                                    setStatus({ enabled: false });
                                    setNotice("La double authentification est désactivée.");
                                });
                            }}
                        >
                            <PasswordField
                                label="Confirmez votre mot de passe"
                                value={password}
                                onChange={setPassword}
                                autoComplete="current-password"
                            />
                            <button className="btn btn-danger" disabled={busy || !password}>
                                Confirmer la désactivation
                            </button>
                        </form>
                    )}
                </div>
            )}
            {codes.length > 0 && (
                <div className="recovery-codes">
                    <h4>Vos codes de secours</h4>
                    <p>
                        Ils ne seront plus affichés à la fermeture de cette fenêtre. Chaque code ne fonctionne qu’une
                        fois.
                    </p>
                    <ul>
                        {codes.map((value) => (
                            <li key={value}>
                                <code>{value}</code>
                            </li>
                        ))}
                    </ul>
                    <button type="button" className="btn btn-secondary" onClick={downloadCodes}>
                        Télécharger les codes
                    </button>
                </div>
            )}
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
        </section>
    );
}
