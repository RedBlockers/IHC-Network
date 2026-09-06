export const THEMES = [
    { id: "dark", label: "Sombre", note: "Défaut — slate bleuté, repos prolongé.", swatch: ["#0b0e13", "#12161d", "#12b5a2"] },
    { id: "light", label: "Clair", note: "Journée, environnement lumineux.", swatch: ["#e6e8ef", "#fbfbfd", "#0e9384"] },
    { id: "oled", label: "OLED", note: "Noir vrai, économie d'énergie.", swatch: ["#000000", "#101014", "#12b5a2"] },
    { id: "contrast", label: "Contraste élevé", note: "Bordures et textes renforcés.", swatch: ["#000000", "#121216", "#5eead4"] },
    { id: "midnight", label: "Minuit", note: "Variante bleutée hors contrat.", swatch: ["#05070f", "#0d1220", "#12b5a2"] },
];

export const DENSITIES = [
    { id: "comfortable", label: "Confortable", note: "Avatar 40 · texte 15/1.5" },
    { id: "compact", label: "Compacte", note: "Avatar 28 · texte 14/1.4" },
];

export const BANNER_BEHAVIOURS = [
    { id: "auto", label: "Compacte au défilement", note: "Se réduit au-delà de 36 px." },
    { id: "fixed", label: "Toujours développée", note: "Hauteur pleine conservée." },
    { id: "compact", label: "Toujours compacte", note: "Hauteur réduite en permanence." },
];

export const ACCENT_PRESETS = [
    { name: "Lagune", value: "#12b5a2" },
    { name: "Indigo", value: "#6d5cff" },
    { name: "Azur", value: "#3b82f6" },
    { name: "Cyan", value: "#12b5c9" },
    { name: "Émeraude", value: "#10b981" },
    { name: "Ambre", value: "#f59e0b" },
    { name: "Corail", value: "#ff6a3d" },
    { name: "Rose", value: "#f43f6e" },
    { name: "Magenta", value: "#c026d3" },
];

export const DEFAULT_PREFERENCES = {
    theme: "dark",
    density: "comfortable",
    accent: "#12b5a2",
    reduceMotion: false,
    highContrast: false,
    hideBanners: false,
    neutralizeCommunityThemes: false,
    bannerBehaviour: "auto",
};

export const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES);

const THEME_IDS = new Set(THEMES.map((t) => t.id));
const DENSITY_IDS = new Set(DENSITIES.map((d) => d.id));
const BANNER_IDS = new Set(BANNER_BEHAVIOURS.map((b) => b.id));
const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizePreferences(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
        theme: THEME_IDS.has(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme,
        density: DENSITY_IDS.has(source.density) ? source.density : DEFAULT_PREFERENCES.density,
        accent: HEX.test(source.accent || "") ? source.accent.toLowerCase() : DEFAULT_PREFERENCES.accent,
        reduceMotion: Boolean(source.reduceMotion),
        highContrast: Boolean(source.highContrast),
        hideBanners: Boolean(source.hideBanners),
        neutralizeCommunityThemes: Boolean(source.neutralizeCommunityThemes),
        bannerBehaviour: BANNER_IDS.has(source.bannerBehaviour) ? source.bannerBehaviour : DEFAULT_PREFERENCES.bannerBehaviour,
    };
}
