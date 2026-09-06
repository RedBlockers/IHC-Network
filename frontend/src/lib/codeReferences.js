const EXTENSIONS =
    "js|jsx|mjs|cjs|ts|tsx|json|css|scss|html|md|sql|sh|yml|yaml|py|rb|go|rs|java|kt|php|c|h|cpp|toml|ini|env";

export const CODE_REFERENCE = new RegExp(
    String.raw`((?:[\w.-]+\/)*[\w.-]+\.(?:${EXTENSIONS})):(\d{1,6})(?::(\d{1,6}))?`,
    "g"
);

export function splitReferences(text) {
    const parts = [];
    let last = 0;

    for (const match of String(text).matchAll(CODE_REFERENCE)) {
        if (match.index > last) parts.push({ text: text.slice(last, match.index) });
        parts.push({
            reference: { path: match[1], line: Number(match[2]), column: match[3] ? Number(match[3]) : null },
            text: match[0],
        });
        last = match.index + match[0].length;
    }

    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
}

export const EDITORS = {
    vscode: {
        id: "vscode",
        label: "VS Code",
        url: ({ root, path, line, column }) => `vscode://file/${join(root, path)}:${line}${column ? `:${column}` : ""}`,
    },
    vscodium: {
        id: "vscodium",
        label: "VSCodium",
        url: ({ root, path, line, column }) => `vscodium://file/${join(root, path)}:${line}${column ? `:${column}` : ""}`,
    },
    jetbrains: {
        id: "jetbrains",
        label: "JetBrains",
        url: ({ root, path, line }) =>
            `jetbrains://idea/navigate/reference?path=${encodeURIComponent(join(root, path))}:${line}`,
    },
    neovim: {
        id: "neovim",
        label: "Neovim",
        command: ({ root, path, line }) => `nvim +${line} ${join(root, path)}`,
    },
    aucun: { id: "aucun", label: "Aucun — afficher le texte seul" },
};

function join(root, path) {
    const base = String(root ?? "").replace(/\/+$/, "");
    return base ? `${base}/${path}` : path;
}

export function openTarget(reference, { editor = "aucun", root = "" } = {}) {
    const chosen = EDITORS[editor] ?? EDITORS.aucun;
    if (chosen.url) return { kind: "url", value: chosen.url({ ...reference, root }), label: chosen.label };
    if (chosen.command) return { kind: "command", value: chosen.command({ ...reference, root }), label: chosen.label };
    return null;
}
