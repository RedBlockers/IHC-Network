import { Validation } from "../utils/validation.js";
import { formatTimestamp } from "../utils/formatTimestamp.js";
import { addLoader } from "../utils/imageUtils.js";
import { newlineBreaks } from "../extensions/newlineBreaks.js";
import { handleAnchor } from "./anchorHandler.js";
import { createEmojiExtension } from "../extensions/emojiTranslator.js";

const emojiMap = {
    "Cute kitty": "https://i.giphy.com/l0MYt5jPR6QX5pnqM.webp",
};

marked.use(newlineBreaks);
marked.use({
    extensions: [createEmojiExtension((name) => emojiMap[name])],
});
marked.use({
    async: false,
    pedantic: false,
    gfm: true,
    breaks: false,
});

function genMsgContent(message) {
    return `
    <div class="content">
        <div class="message-info-container d-flex flex-row">
            <img class="avatar mr-3" src="../images/${
                message.userImage
            }" loading="lazy" onclick="window.displayProfileInfo(this, ${
        message.userId
    })" alt="Avatar de ${message.userNickname}">
            <span class="message-info d-flex flex-row align-items-top">
                <p class="username mx-3">${message.userNickname}</p>
                <p class="timestamp ">${formatTimestamp(message.sentDate)}</p>
            </span>
        </div>
        <div class="message-content mt-3">
            ${Validation.sanitizebr(
                marked.parse(Validation.escapeHtml(message.content))
            )}
        </div>
    </div>
`;
}

export class MessageRenderer {
    static displayMessage(message, prepend = false) {
        const messageList = document.getElementById("messageList");
        const messageElement = document.createElement("li");

        // Configuration de base
        if (message.content.includes(`@${localStorage.getItem("username")}`)) {
            messageElement.style.backgroundColor = "#e7b9111f";
        }

        if (Validation.containsOnlyEmojis(message.content)) {
            message.content = "# " + message.content;
        }

        messageElement.classList.add(
            "list-group-item",
            "text-wrap",
            "text-break",
            "bg-dark",
            "text-white"
        );

        // Contenu du message
        const isOwnMessage =
            localStorage.getItem("username") === message.userNickname;
        messageElement.innerHTML = `
        <div class="message-actions position-relative" ${
            isOwnMessage ? `id="${message.messageId}"` : ""
        }>
            ${genMsgContent(message)}
            ${
                isOwnMessage
                    ? `
                <div class="btn-group position-absolute top-0 end-0">
                    <button class="btn-edit p-0" onclick="editMessage('${message.messageId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                            <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                            <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
                        </svg>
                    </button>
                    <button class="btn-delete p-0" onclick="deleteMessage('${message.messageId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
                            <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
                        </svg>
                    </button>
                </div>
            `
                    : ""
            }
        </div>
    `;

        // Ajout au DOM
        if (prepend) {
            messageList.insertBefore(messageElement, messageList.firstChild);
        } else {
            messageList.appendChild(messageElement);
        }

        // Post-traitement
        messageElement.querySelectorAll("img").forEach((img) => addLoader(img));
        messageElement
            .querySelectorAll("pre code")
            .forEach((block) => hljs.highlightElement(block));
        handleAnchor();
    }

    static async processMessageElement(messageElement) {
        // Ajout des loaders sur les images
        const images = messageElement.querySelectorAll("img");
        images.forEach((img) => addLoader(img));

        // Highlighting du code
        const codeBlocks = messageElement.querySelectorAll("pre code");
        codeBlocks.forEach((block) => {
            hljs.highlightElement(block);
        });

        // Gestion des ancres
        handleAnchor();

        // Attendre que tout soit rendu
        await new Promise(requestAnimationFrame);
    }

    static async displayMessages(messages, prepend = false) {
        const messageList = document.getElementById("messageList");
        const fragment = document.createDocumentFragment();

        // Créer tous les éléments de message
        const messageElements = await Promise.all(
            messages.map((message) => this.displayMessage(message, prepend))
        );

        // Ajouter au fragment
        messageElements.forEach((element) => {
            if (prepend) {
                fragment.prepend(element);
            } else {
                fragment.appendChild(element);
            }
        });

        // Ajouter au DOM
        if (prepend) {
            messageList.prepend(fragment);
        } else {
            messageList.appendChild(fragment);
        }

        return messageElements;
    }
}
