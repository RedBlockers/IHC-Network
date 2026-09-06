"use strict";

const AA_TEXT = 4.5;
const AA_LARGE = 3;
const AAA_TEXT = 7;

function parseHex(value) {
    if (typeof value !== "string") return null;
    const raw = value.trim().replace(/^#/, "");
    const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (channel) => {
    const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
    return c * 255;
};

function relativeLuminance(rgb) {
    return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function contrastRatio(foreground, background) {
    const a = typeof foreground === "string" ? parseHex(foreground) : foreground;
    const b = typeof background === "string" ? parseHex(background) : background;
    if (!a || !b) return 0;
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return (light + 0.05) / (dark + 0.05);
}

function meetsAA(foreground, background, { large = false } = {}) {
    return contrastRatio(foreground, background) >= (large ? AA_LARGE : AA_TEXT);
}

function meetsAAA(foreground, background) {
    return contrastRatio(foreground, background) >= AAA_TEXT;
}

function rgbToOklab(rgb) {
    const r = toLinear(rgb.r);
    const g = toLinear(rgb.g);
    const b = toLinear(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
}

function oklabToRgb(lab) {
    const l = (lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3;
    const m = (lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3;
    const s = (lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b) ** 3;
    return {
        r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    };
}

function toOklch(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const lab = rgbToOklab(rgb);
    return {
        l: lab.L,
        c: Math.hypot(lab.a, lab.b),
        h: (Math.atan2(lab.b, lab.a) * 180) / Math.PI,
    };
}

const inGamut = (rgb) => [rgb.r, rgb.g, rgb.b].every((v) => v >= -0.5 && v <= 255.5);

function fromOklch({ l, c, h }) {
    const rad = (h * Math.PI) / 180;
    let chroma = c;
    for (let i = 0; i < 24; i += 1) {
        const rgb = oklabToRgb({ L: l, a: chroma * Math.cos(rad), b: chroma * Math.sin(rad) });
        if (inGamut(rgb)) return toHex(rgb);
        chroma *= 0.92;
    }
    return toHex(oklabToRgb({ L: l, a: 0, b: 0 }));
}

function correctForContrast(hex, background, { target = AA_TEXT } = {}) {
    const source = toOklch(hex);
    if (!source) return null;
    if (contrastRatio(hex, background) >= target) return hex;

    const bg = typeof background === "string" ? parseHex(background) : background;
    if (!bg) return hex;
    const lighten = relativeLuminance(bg) < 0.18;

    let low = lighten ? source.l : 0;
    let high = lighten ? 1 : source.l;
    let best = null;

    for (let i = 0; i < 32; i += 1) {
        const mid = (low + high) / 2;
        const candidate = fromOklch({ l: mid, c: source.c, h: source.h });
        if (contrastRatio(candidate, background) >= target) {
            best = candidate;
            if (lighten) high = mid;
            else low = mid;
        } else if (lighten) {
            low = mid;
        } else {
            high = mid;
        }
    }

    if (best) return best;
    const pole = fromOklch({ l: lighten ? 1 : 0, c: 0, h: source.h });
    return contrastRatio(pole, background) >= contrastRatio(hex, background) ? pole : hex;
}

function auditPair(foreground, background, { target = AA_TEXT, label = "" } = {}) {
    const ratio = contrastRatio(foreground, background);
    return {
        label,
        foreground,
        background,
        ratio: Math.round(ratio * 100) / 100,
        target,
        passes: ratio >= target,
        suggestion: ratio >= target ? null : correctForContrast(foreground, background, { target }),
    };
}

const CONTRAST_TARGETS = { AA_TEXT, AA_LARGE, AAA_TEXT };

const SURFACE_DARK = "#0e1116";
const SURFACE_LIGHT = "#f3f5f8";

function auditAccent(color, { target = AA_LARGE } = {}) {
    const resolve = (background, label) => {
        const direct = contrastRatio(color, background);
        const applied = direct >= target ? color : correctForContrast(color, background, { target });
        return {
            label,
            background,
            ratio: Math.round(contrastRatio(applied, background) * 100) / 100,
            applied,
            corrected: applied !== color,
            passes: contrastRatio(applied, background) >= target,
        };
    };

    const checks = [resolve(SURFACE_DARK, "sombre"), resolve(SURFACE_LIGHT, "clair")];
    return { passes: checks.every((check) => check.passes), checks, target };
}

module.exports = {
    parseHex,
    toHex,
    relativeLuminance,
    contrastRatio,
    meetsAA,
    meetsAAA,
    toOklch,
    fromOklch,
    correctForContrast,
    auditPair,
    auditAccent,
    CONTRAST_TARGETS,
    SURFACE_DARK,
    SURFACE_LIGHT,
};
