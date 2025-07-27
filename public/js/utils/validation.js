export class Validation {
    static escapeHtml(unsafe) {
        // Utiliser un tableau pour stocker les segments
        const codeBlocks = [];

        // Remplace temporairement les blocs de code par des marqueurs
        let processedText = unsafe.replace(
            /```([^`]+)```/g,
            (match, codeContent) => {
                codeBlocks.push(codeContent);
                return `__CODE_BLOCK_${codeBlocks.length - 1}__`; // Remplace par un marqueur unique
            }
        );

        // Échapper les caractères spéciaux hors des blocs de code
        processedText = processedText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Réinjecter les blocs de code non échappés
        codeBlocks.forEach((codeContent, index) => {
            processedText = processedText.replace(
                `__CODE_BLOCK_${index}__`,
                `\`\`\`${codeContent}\`\`\``
            );
        });
        return processedText;
    }

    static containsOnlyEmojis(message) {
        const unicodeEmojiRegex =
            /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
        const customEmojiRegex = /:([a-zA-Z0-9_\s-]+):/g;
        const variationSelectorRegex = /\uFE0F/g;
        const zwjRegex = /\u200D/g;

        const cleaned = message.trim().replace(/\s+/g, "");
        const withoutUnicode = cleaned.replace(unicodeEmojiRegex, "");
        const withoutCustom = withoutUnicode.replace(customEmojiRegex, "");
        const final = withoutCustom
            .replace(variationSelectorRegex, "")
            .replace(zwjRegex, "");

        return final.length === 0;
    }
    static sanitizebr(texte) {
        texte = texte.replace(/^(?:\s*<br>\s*)+/, ""); // supprime les balises br au début
        texte = texte.replace(/(?:\s*<br>\s*)+$/, ""); // supprime les balises br à la fin
        return texte;
    }
}
