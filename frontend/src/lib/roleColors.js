import { contrastRatio, correctForContrast } from "./contrast.js";

const SAMPLE_DARK = "#0b0e13";
const SAMPLE_LIGHT = "#fbfbfd";

export const ROLE_COLORS = [
    { id: "teal", label: "Lagune", dark: "#2dd4bf", light: "#108275" },
    { id: "emeraude", label: "Émeraude", dark: "#3dc97c", light: "#1a854e" },
    { id: "citron", label: "Citron", dark: "#a3d13a", light: "#617e18" },
    { id: "ambre", label: "Ambre", dark: "#e8b93e", light: "#916f08" },
    { id: "orange", label: "Orange", dark: "#e8a87f", light: "#a1663f" },
    { id: "corail", label: "Corail", dark: "#f07167", light: "#c64b44" },
    { id: "rubis", label: "Rubis", dark: "#e5544b", light: "#d1403a" },
    { id: "magenta", label: "Magenta", dark: "#e0479e", light: "#ce348e" },
    { id: "violet", label: "Violet", dark: "#8b5cf6", light: "#8554ee" },
    { id: "indigo", label: "Indigo", dark: "#4c7df0", light: "#3f6edf" },
    { id: "azur", label: "Azur", dark: "#22b8cf", light: "#0e8091" },
    { id: "ardoise", label: "Ardoise", dark: "#a8b3c1", light: "#6b7582" },
];

const LIGHT_THEMES = new Set(["light"]);

export const backgroundForTheme = (theme) => (LIGHT_THEMES.has(theme) ? SAMPLE_LIGHT : SAMPLE_DARK);

export function resolveRoleColor(value, theme = "dark") {
    const background = backgroundForTheme(theme);
    if (!value) return { color: "var(--text-secondary)", corrected: false, ratio: null };

    const preset = ROLE_COLORS.find(
        (c) => c.id === value || c.dark.toLowerCase() === String(value).toLowerCase()
    );
    if (preset) {
        const color = LIGHT_THEMES.has(theme) ? preset.light : preset.dark;
        return { color, corrected: false, ratio: contrastRatio(color, background) };
    }

    const ratio = contrastRatio(value, background);
    if (ratio >= 4.5) return { color: value, corrected: false, ratio };
    const color = correctForContrast(value, background) || value;
    return { color, corrected: true, ratio: contrastRatio(color, background) };
}

export const ROLE_COLOR_SAMPLES = { dark: SAMPLE_DARK, light: SAMPLE_LIGHT };
