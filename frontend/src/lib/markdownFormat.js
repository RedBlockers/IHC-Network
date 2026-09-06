export const FORMATS = {
    bold: { id: "bold", kind: "wrap", marker: "**", label: "Gras", glyph: "B", shortcut: "b" },
    italic: { id: "italic", kind: "wrap", marker: "*", label: "Italique", glyph: "I", shortcut: "i" },
    strike: { id: "strike", kind: "wrap", marker: "~~", label: "Barré", glyph: "S" },
    code: { id: "code", kind: "wrap", marker: "`", label: "Code", glyph: "<>", shortcut: "e" },
    spoiler: { id: "spoiler", kind: "wrap", marker: "||", label: "Spoiler", glyph: "▮" },
    codeblock: { id: "codeblock", kind: "fence", marker: "```", label: "Bloc de code", glyph: "{ }" },
    quote: { id: "quote", kind: "line", prefix: "> ", label: "Citation", glyph: "❝" },
    list: { id: "list", kind: "line", prefix: "- ", label: "Liste", glyph: "•" },
    ordered: { id: "ordered", kind: "line", prefix: "1. ", label: "Liste numérotée", glyph: "1." },
    link: { id: "link", kind: "link", label: "Lien", glyph: "🔗", shortcut: "k" },
};

export const TOOLBAR_ORDER = [
    "bold", "italic", "strike", "code", "spoiler", "codeblock", "quote", "list", "ordered", "link",
];

const LINK_PATTERN = /^\[([^\]]*)\]\(([^)]*)\)$/;

function isWrapped(text, start, end, marker) {
    const before = text.slice(Math.max(0, start - marker.length), start);
    const after = text.slice(end, end + marker.length);
    if (before !== marker || after !== marker) return false;
    if (marker === "*" && text.slice(Math.max(0, start - 2), start) === "**" && text.slice(end, end + 2) === "**") {
        return false;
    }
    return true;
}

function lineRange(text, start, end) {
    const from = text.lastIndexOf("\n", start - 1) + 1;
    const breakAt = text.indexOf("\n", end);
    const to = breakAt === -1 ? text.length : breakAt;
    return { from, to };
}

const orderedPrefix = /^\d+\.\s/;

function hasLinePrefix(line, format) {
    return format.id === "ordered" ? orderedPrefix.test(line) : line.startsWith(format.prefix);
}

export function activeFormats(text, start, end) {
    const active = new Set();
    for (const format of Object.values(FORMATS)) {
        if (format.kind === "wrap" && isWrapped(text, start, end, format.marker)) active.add(format.id);
        if (
            format.kind === "fence" &&
            text.slice(Math.max(0, start - 4), start) === "```\n" &&
            text.slice(end, end + 4) === "\n```"
        ) {
            active.add(format.id);
        }
        if (format.kind === "line") {
            const { from, to } = lineRange(text, start, end);
            const lines = text.slice(from, to).split("\n");
            if (lines.length > 0 && lines.every((line) => hasLinePrefix(line, format))) active.add(format.id);
        }
        if (format.kind === "link" && LINK_PATTERN.test(text.slice(start, end))) active.add(format.id);
    }
    return active;
}

function applyWrap(text, start, end, marker) {
    const length = marker.length;
    if (isWrapped(text, start, end, marker)) {
        const value = text.slice(0, start - length) + text.slice(start, end) + text.slice(end + length);
        return { value, selectionStart: start - length, selectionEnd: end - length };
    }
    const value = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
    return { value, selectionStart: start + length, selectionEnd: end + length };
}

function applyFence(text, start, end) {
    const open = "```\n";
    const close = "\n```";
    if (text.slice(Math.max(0, start - open.length), start) === open && text.slice(end, end + close.length) === close) {
        const value = text.slice(0, start - open.length) + text.slice(start, end) + text.slice(end + close.length);
        return { value, selectionStart: start - open.length, selectionEnd: end - open.length };
    }
    const value = text.slice(0, start) + open + text.slice(start, end) + close + text.slice(end);
    return { value, selectionStart: start + open.length, selectionEnd: end + open.length };
}

function applyLine(text, start, end, format) {
    const { from, to } = lineRange(text, start, end);
    const lines = text.slice(from, to).split("\n");
    const remove = lines.every((line) => hasLinePrefix(line, format));

    const next = lines.map((line, index) => {
        if (remove) {
            return format.id === "ordered" ? line.replace(orderedPrefix, "") : line.slice(format.prefix.length);
        }
        const prefix = format.id === "ordered" ? `${index + 1}. ` : format.prefix;
        return prefix + line;
    });

    const block = next.join("\n");
    const value = text.slice(0, from) + block + text.slice(to);
    return { value, selectionStart: from, selectionEnd: from + block.length };
}

function applyLink(text, start, end) {
    const selected = text.slice(start, end);
    const match = LINK_PATTERN.exec(selected);
    if (match) {
        const value = text.slice(0, start) + match[1] + text.slice(end);
        return { value, selectionStart: start, selectionEnd: start + match[1].length };
    }
    const label = selected || "texte";
    const snippet = `[${label}](url)`;
    const value = text.slice(0, start) + snippet + text.slice(end);
    const urlStart = start + label.length + 3;
    return { value, selectionStart: urlStart, selectionEnd: urlStart + 3 };
}

export function applyFormat(text, start, end, formatId) {
    const format = FORMATS[formatId];
    if (!format) return { value: text, selectionStart: start, selectionEnd: end };

    switch (format.kind) {
        case "wrap":
            return applyWrap(text, start, end, format.marker);
        case "fence":
            return applyFence(text, start, end);
        case "line":
            return applyLine(text, start, end, format);
        case "link":
            return applyLink(text, start, end);
        default:
            return { value: text, selectionStart: start, selectionEnd: end };
    }
}

export function shortcutFor(event) {
    if (!event.ctrlKey && !event.metaKey) return null;
    const key = event.key.toLowerCase();
    const match = Object.values(FORMATS).find((format) => format.shortcut === key);
    return match ? match.id : null;
}
