"use strict";

const KINDS = {
    image: { mimes: [/^image\/(png|jpeg|gif|webp|avif|bmp)$/], extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"] },
    video: { mimes: [/^video\/(mp4|webm|ogg|quicktime)$/], extensions: ["mp4", "webm", "ogv", "mov"] },
    audio: { mimes: [/^audio\/(mpeg|ogg|wav|webm|flac|aac)$/], extensions: ["mp3", "ogg", "wav", "weba", "flac", "aac"] },
    text: { mimes: [/^text\//, /^application\/(json|xml|x-yaml|yaml)$/], extensions: ["txt", "md", "json", "xml", "yml", "yaml", "csv", "log"] },
    pdf: { mimes: [/^application\/pdf$/], extensions: ["pdf"] },
};

const extensionOf = (name) => {
    const match = /\.([A-Za-z0-9]{1,8})$/.exec(String(name ?? ""));
    return match ? match[1].toLowerCase() : "";
};

function previewKind(mime, name) {
    const type = String(mime ?? "").toLowerCase();
    const extension = extensionOf(name);

    for (const [kind, rule] of Object.entries(KINDS)) {
        const mimeMatches = rule.mimes.some((pattern) => pattern.test(type));
        if (!mimeMatches) continue;
        if (extension && !rule.extensions.includes(extension)) return "file";
        return kind;
    }
    return "file";
}

const isInlineSafe = (mime, name) => ["image", "video", "audio", "pdf"].includes(previewKind(mime, name));

function humanSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1000) return `${value} o`;
    const units = ["ko", "Mo", "Go", "To"];
    let index = -1;
    let size = value;
    do {
        size /= 1000;
        index += 1;
    } while (size >= 1000 && index < units.length - 1);
    return `${size.toFixed(size < 10 ? 1 : 0).replace(".", ",")} ${units[index]}`;
}

module.exports = { previewKind, isInlineSafe, humanSize, extensionOf };
