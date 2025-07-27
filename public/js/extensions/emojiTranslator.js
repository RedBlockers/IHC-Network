export function createEmojiExtension(getEmojiSrc) {
    return {
        name: "emoji",
        level: "inline",
        start(src) {
            return src.indexOf(":");
        },
        tokenizer(src, tokens) {
            const match = /^:([a-zA-Z0-9\s_-]+):/.exec(src);
            if (match) {
                return {
                    type: "emoji",
                    raw: match[0],
                    emojiName: match[1],
                    tokens: [],
                };
            }
        },
        renderer(token) {
            const src = getEmojiSrc(token.emojiName);
            if (src) {
                return `<img src="${src}" alt=":${token.emojiName}:" class="emoji" aria-label="${token.emojiName}" role="img">`;
            }
            return `:${token.emojiName}:`; // fallback si non trouvé
        },
    };
}
