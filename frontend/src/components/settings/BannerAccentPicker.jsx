import { BANNER_KEYS, bannerGradient } from "../../lib/banners.js";
import { ACCENT_PRESETS } from "../../context/customization-options.js";
import { contrastRatio, correctForContrast } from "../../lib/contrast.js";

const SURFACES = [
    { hex: "#0b0e13", label: "sombre" },
    { hex: "#f3f4f8", label: "clair" },
];
const TARGET = 3;

export default function BannerAccentPicker({ banner, onBanner, accent, onAccent }) {
    const selectedAccent = accent || "#12b5a2";

    const checks = SURFACES.map((surface) => {
        const ratio = contrastRatio(selectedAccent, surface.hex);
        const corrected = ratio >= TARGET ? null : correctForContrast(selectedAccent, surface.hex, { target: TARGET });
        return {
            ...surface,
            ratio: Math.round(ratio * 100) / 100,
            corrected,
            applied: corrected ?? selectedAccent,
        };
    });
    const adjusted = checks.some((check) => check.corrected);
    const isCustomAccent = !ACCENT_PRESETS.some(
        (preset) => preset.value.toLowerCase() === selectedAccent.toLowerCase(),
    );

    return (
        <>
            <div className="field">
                <span className="field-label">Bannière</span>
                <div className="banner-picker">
                    {BANNER_KEYS.map((key) => (
                        <button
                            type="button"
                            key={key}
                            className={`banner-opt${banner === key ? " is-on" : ""}`}
                            style={{ background: bannerGradient(key) }}
                            onClick={() => onBanner(key)}
                            aria-label={`Bannière ${key}`}
                        />
                    ))}
                </div>
            </div>
            <div className="field">
                <span className="field-label">Couleur d'accent</span>
                <div className="accent-row">
                    {ACCENT_PRESETS.map((a) => (
                        <button
                            type="button"
                            key={a.value}
                            className={`accent-dot${(accent || "").toLowerCase() === a.value.toLowerCase() ? " is-on" : ""}`}
                            style={{ background: a.value }}
                            onClick={() => onAccent(a.value)}
                            title={a.name}
                            aria-label={a.name}
                        />
                    ))}
                    <label
                        className={`accent-custom-control${isCustomAccent ? " is-on" : ""}`}
                        title="Choisir une couleur personnalisée"
                    >
                        <span
                            className="accent-custom-swatch"
                            style={{ "--picked-accent": selectedAccent }}
                            aria-hidden="true"
                        >
                            <span />
                        </span>
                        <span className="accent-custom-copy">
                            <strong>Sur mesure</strong>
                            <span className="accent-custom-value">{selectedAccent.toUpperCase()}</span>
                        </span>
                        <input
                            type="color"
                            className="accent-custom-input"
                            value={selectedAccent}
                            onChange={(event) => onAccent(event.target.value)}
                            aria-label="Couleur d'accent personnalisée"
                        />
                    </label>
                </div>

                <div className="accent-contrast" role="status">
                    {adjusted ? (
                        <>
                            <strong>Cette teinte sera ajustée pour rester lisible.</strong>
                            <span className="accent-contrast-pairs">
                                {checks.map((check) => (
                                    <span key={check.label}>
                                        {check.label} : {check.ratio}:1
                                        {check.corrected && (
                                            <i
                                                className="accent-contrast-swatch"
                                                style={{ background: check.applied }}
                                                title={`corrigée en ${check.applied.toUpperCase()}`}
                                            />
                                        )}
                                    </span>
                                ))}
                            </span>
                        </>
                    ) : (
                        <strong>Lisible sur les deux thèmes ({Math.min(...checks.map((c) => c.ratio))}:1).</strong>
                    )}
                </div>
            </div>
        </>
    );
}
