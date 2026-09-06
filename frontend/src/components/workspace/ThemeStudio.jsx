import { useEffect, useState } from "react";

import { api, ApiError } from "../../lib/api.js";
import { fullTimestamp } from "../../lib/format.js";
import { auditAccent } from "../../lib/contrast.js";
import Icon from "../ui/Icon.jsx";
import Tooltip from "../ui/Tooltip.jsx";

const PREVIEWS = [
    { id: "desktop", label: "Ordinateur", width: 320 },
    { id: "tablet", label: "Tablette", width: 220 },
    { id: "mobile", label: "Téléphone", width: 150 },
];

const DEFAULTS = { accent: "#12b5a2", accent2: "#2dd4bf", surfaceTint: 4, radiusDelta: 0 };

export default function ThemeStudio({ guild }) {
    const [tokens, setTokens] = useState(DEFAULTS);
    const [label, setLabel] = useState("");
    const [scheduledFor, setScheduled] = useState("");
    const [history, setHistory] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api(`/guilds/${guild.guildId}/themes`)
            .then((result) => {
                if (cancelled) return;
                setHistory(result.themes);
                const current = result.themes.find((theme) => theme.active);
                if (current) setTokens({ ...DEFAULTS, ...current.tokens });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, refresh]);

    const set = (key, value) => setTokens((current) => ({ ...current, [key]: value }));
    const audit = auditAccent(tokens.accent);

    async function publish() {
        setBusy(true);
        setError(null);
        try {
            await api(`/guilds/${guild.guildId}/themes`, {
                method: "POST",
                body: {
                    tokens,
                    label: label.trim(),
                    scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
                },
            });
            setLabel("");
            setScheduled("");
            setRefresh((count) => count + 1);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Le thème n’a pas pu être publié.");
        } finally {
            setBusy(false);
        }
    }

    async function act(path, method = "POST") {
        setError(null);
        try {
            await api(path, { method });
            setRefresh((count) => count + 1);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "L’opération n’a pas abouti.");
        }
    }

    const preview = {
        "--com-accent": tokens.accent,
        "--com-accent-2": tokens.accent2,
        "--com-surface-tint": `color-mix(in oklab, ${tokens.accent}, transparent ${100 - tokens.surfaceTint}%)`,
        "--com-radius-delta": `${tokens.radiusDelta}px`,
    };

    return (
        <div className="server-admin-content">
            <p className="settings-p">
                Quatre réglages, appliqués à tous les membres. Les fonds et les textes n’en font pas
                partie : c’est ce qui garantit qu’un message reste lisible partout.
            </p>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="theme-studio">
                <div className="theme-levers">
                    <label className="field">
                        <span className="field-label">Accent</span>
                        <span className="theme-color">
                            <input type="color" value={tokens.accent} onChange={(e) => set("accent", e.target.value)} />
                            <code>{tokens.accent}</code>
                        </span>
                        {audit.checks.map((check) => (
                            <span key={check.label} className="field-hint">
                                sur fond {check.label} : {check.ratio}:1
                                {check.corrected && ` · corrigé en ${check.applied}`}
                            </span>
                        ))}
                    </label>

                    <label className="field">
                        <span className="field-label">Accent secondaire</span>
                        <span className="theme-color">
                            <input type="color" value={tokens.accent2} onChange={(e) => set("accent2", e.target.value)} />
                            <code>{tokens.accent2}</code>
                        </span>
                    </label>

                    <label className="field">
                        <span className="field-label">Teinte d’ambiance — {tokens.surfaceTint} %</span>
                        <input
                            type="range"
                            min={0}
                            max={8}
                            value={tokens.surfaceTint}
                            onChange={(e) => set("surfaceTint", Number(e.target.value))}
                        />
                        <span className="field-hint">
                            Au-delà de 8 %, ce n’est plus une ambiance mais un fond, et le contraste des
                            textes cesse d’être garanti.
                        </span>
                    </label>

                    <label className="field">
                        <span className="field-label">Arrondi — {tokens.radiusDelta > 0 ? "+" : ""}{tokens.radiusDelta} px</span>
                        <input
                            type="range"
                            min={-6}
                            max={6}
                            value={tokens.radiusDelta}
                            onChange={(e) => set("radiusDelta", Number(e.target.value))}
                        />
                        <span className="field-hint">
                            Un écart, pas une valeur : les rayons gardent leurs proportions entre eux.
                        </span>
                    </label>
                </div>

                <div className="theme-previews">
                    {PREVIEWS.map((device) => (
                        <figure key={device.id} style={{ ...preview, width: device.width }}>
                            <figcaption>{device.label}</figcaption>
                            <div className="theme-preview-card">
                                <div className="theme-preview-banner" />
                                <div className="theme-preview-body">
                                    <strong>{guild.name}</strong>
                                    <p>La taverne ouvre à 21 h ce soir.</p>
                                    <span className="theme-preview-actions">
                                        <button type="button" className="theme-preview-primary">Rejoindre</button>
                                        <button type="button" className="theme-preview-quiet">Plus tard</button>
                                    </span>
                                </div>
                            </div>
                        </figure>
                    ))}
                </div>
            </div>

            <div className="theme-publish">
                <label className="field field-grow">
                    <span className="field-label">Nom de cette version</span>
                    <input
                        className="field-input"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Couleurs d’automne"
                        maxLength={60}
                    />
                </label>
                <label className="field">
                    <span className="field-label">Publier plus tard</span>
                    <input
                        className="field-input"
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduled(e.target.value)}
                    />
                </label>
                <button type="button" className="btn btn-accent" disabled={busy} onClick={publish}>
                    {busy ? "Publication…" : scheduledFor ? "Programmer" : "Publier maintenant"}
                </button>
            </div>

            {history.length > 0 && (
                <>
                    <h3 className="settings-h">Historique</h3>
                    <ul className="key-list">
                        {history.map((theme) => (
                            <li key={theme.themeId}>
                                <span className="theme-publish-swatch" style={{ background: theme.tokens.accent }} />
                                <div>
                                    <strong>{theme.label || "Sans nom"}</strong>
                                    <small>
                                        {theme.active
                                            ? `en vigueur depuis le ${fullTimestamp(theme.effectiveAt)}`
                                            : `programmé pour le ${fullTimestamp(theme.effectiveAt)}`}
                                    </small>
                                </div>
                                {theme.active ? (
                                    <Tooltip label="Republie ces couleurs sans effacer l’historique">
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => act(`/guilds/${guild.guildId}/themes/${theme.themeId}/rollback`)}
                                        >
                                            Reprendre
                                        </button>
                                    </Tooltip>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() => act(`/guilds/${guild.guildId}/themes/${theme.themeId}`, "DELETE")}
                                    >
                                        Annuler
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <p className="settings-p">
                <Icon name="check" size={14} /> Chaque publication ajoute une version : rien n’est
                jamais écrasé, et toute version passée se reprend en un clic.
            </p>
        </div>
    );
}
