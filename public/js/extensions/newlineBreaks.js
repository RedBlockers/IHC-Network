export const newlineBreaksExtension = {
    name: "newlineBreaks",
    start(src) {
        return src.indexOf("\n");
    },
    tokenizer(src) {
        const match = src.match(/^\n+/);
        if (match) {
            return {
                type: "newlineBreaks",
                raw: match[0],
                text: match[0],
            };
        }
    },
    renderer(token) {
        return token.text.replace(/\n{2,}/g, (match) => {
            return "<br>".repeat(match.length - 1);
        });
    },
};

export const newlineBreaks = {
    extensions: [
        {
            ...newlineBreaksExtension,
            level: "block",
        },
        {
            ...newlineBreaksExtension,
            level: "inline",
        },
    ],
};
