import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import Icon from "../ui/Icon.jsx";

const EXPIRY = [
    { value: "", label: "Sans expiration" },
    { value: "30", label: "30 jours" },
    { value: "90", label: "90 jours" },
    { value: "365", label: "1 an" },
];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : null);

export default function AccessTokens() {
    const [tokens, setTokens] = useState(null);
    const [label, setLabel] = useState("");
    const [expiry, setExpiry] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [fresh, setFresh] = useState(null);
    const [copied, setCopied] = useState(false);

    async function refresh() {
        const { tokens: list } = await api("/account/tokens");
        setTokens(list);
    }

    useEffect(() => {
        let cancelled = false;
        api("/account/tokens")
            .then(({ tokens: list }) => !cancelled && setTokens(list))
            .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Jetons indisponibles."));
        return () => {
            cancelled = true;
        };
    }, []);

    async function create(event) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setCopied(false);
        try {
            const result = await api("/account/tokens", {
                method: "POST",
                body: { label: label.trim(), ...(expiry ? { expiresInDays: Number(expiry) } : {}) },
            });
            setFresh(result);
            setLabel("");
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Jeton non créé.");
        } finally {
            setBusy(false);
        }
    }

    async function revoke(token) {
        if (!window.confirm(`Révoquer le jeton « ${token.label} » ? Les outils qui l’utilisent seront déconnectés.`)) return;
        setError(null);
        try {
            await api(`/account/tokens/${token.tokenId}`, { method: "DELETE" });
            if (fresh?.item.tokenId === token.tokenId) setFresh(null);
            await refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Jeton non révoqué.");
        }
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(fresh.token);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }

    return (
        <section className="settings-section">
            <h3 className="settings-h">Jetons d’accès</h3>
            <p className="settings-p">
                Un jeton donne à la CLI ou à un script les mêmes droits que vous, sans mot de passe ni
                session de navigateur. Il n’est affiché qu’une fois.
            </p>

            <form className="token-form" onSubmit={create}>
                <label className="field">
                    <span className="field-label">Nom du jeton</span>
                    <input
                        className="field-input"
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder="Portable du bureau"
                        maxLength={80}
                        required
                    />
                </label>
                <label className="field">
                    <span className="field-label">Expiration</span>
                    <select className="field-input" value={expiry} onChange={(event) => setExpiry(event.target.value)}>
                        {EXPIRY.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <button className="btn btn-accent" type="submit" disabled={busy || !label.trim()}>
                    {busy ? "Création…" : "Créer un jeton"}
                </button>
            </form>

            {fresh && (
                <div className="token-reveal" role="status">
                    <p>
                        <strong>{fresh.item.label}</strong> — copiez ce jeton maintenant, il ne sera plus affiché.
                    </p>
                    <div className="token-reveal-row">
                        <code>{fresh.token}</code>
                        <button type="button" className="btn btn-ghost" onClick={copy}>
                            <Icon name="check" size={14} /> {copied ? "Copié" : "Copier"}
                        </button>
                    </div>
                    <pre className="token-reveal-cmd">qweillo login --url {window.location.origin} --token {fresh.token}</pre>
                </div>
            )}

            {tokens === null && !error && <p className="popout-role-empty">Chargement…</p>}
            {tokens?.length === 0 && <p className="popout-role-empty">Aucun jeton actif.</p>}
            <ul className="device-list">
                {tokens?.map((token) => (
                    <li key={token.tokenId}>
                        <span>
                            <strong>
                                {token.label} <code className="token-prefix">{token.prefix}…</code>
                            </strong>
                            <small>
                                Créé le {formatDate(token.createdAt)}
                                {token.lastUsedAt ? ` · utilisé le ${formatDate(token.lastUsedAt)}` : " · jamais utilisé"}
                                {token.expiresAt ? ` · expire le ${formatDate(token.expiresAt)}` : ""}
                            </small>
                        </span>
                        <button type="button" className="btn btn-danger" onClick={() => revoke(token)}>
                            Révoquer
                        </button>
                    </li>
                ))}
            </ul>

            {error && <p className="auth-error" role="alert">{error}</p>}
        </section>
    );
}
