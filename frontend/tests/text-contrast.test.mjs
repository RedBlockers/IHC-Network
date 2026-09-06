import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

function resolve(name, scope) {
    const seen = new Set();
    let value = scope[name];
    while (value && value.startsWith("var(")) {
        const next = value.slice(4, -1).split(",")[0].trim().replace("--", "");
        if (seen.has(next)) return null;
        seen.add(next);
        value = scope[next];
    }
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function scopeOf(selector) {
    const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
    if (!block) return null;
    const own = Object.fromEntries(
        [...block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
    );
    const root = Object.fromEntries(
        [...(/:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "").matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
            m[1],
            m[2].trim(),
        ])
    );
    return { ...root, ...own };
}

const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function ratio(a, b) {
    const lum = (hex) => {
        const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

const THEMES = [
    [":root", "sombre (défaut)"],
    [':root\\[data-theme="light"\\]', "clair"],
    [':root\\[data-theme="contrast"\\]', "contraste renforcé"],
];

const TEXTS = ["text-secondary", "text-muted"];
const SURFACES = ["bg-base", "bg-raised", "bg-surface"];

for (const [selector, label] of THEMES) {
    test(`textes secondaires lisibles — thème ${label}`, () => {
        const scope = scopeOf(selector);
        assert.ok(scope, `thème introuvable : ${label}`);

        for (const text of TEXTS) {
            for (const surface of SURFACES) {
                const fg = resolve(text, scope);
                const bg = resolve(surface, scope);
                if (!fg || !bg) continue;

                const value = ratio(fg, bg);
                assert.ok(
                    value >= 4.5,
                    `${text} sur ${surface} en thème ${label} : ${value.toFixed(2)}:1, en dessous de 4,5:1`
                );
            }
        }
    });
}

test("le contraste renforcé dépasse nettement le seuil", () => {
    const scope = scopeOf(':root\\[data-theme="contrast"\\]');
    const value = ratio(resolve("text-muted", scope), resolve("bg-base", scope));

    assert.ok(value >= 7, `contraste renforcé à ${value.toFixed(2)}:1, sous le seuil AAA de 7:1`);
});
