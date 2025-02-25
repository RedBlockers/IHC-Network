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

    static containsSingleEmoji(message) {
        const singleEmojiRegex =
            /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;
        return singleEmojiRegex.test(message.trim());
    }

    static sanitizebr(texte) {
        texte = texte.replace(/^(?:\s*<br>\s*)+/, ""); // supprime les balises br au début
        texte = texte.replace(/(?:\s*<br>\s*)+$/, ""); // supprime les balises br à la fin
        return texte;
    }
}
