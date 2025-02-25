import { Validation } from "../utils/validation.js";
import { formatTimestamp } from "../utils/formatTimestamp.js";
import { addLoader } from "../utils/imageUtils.js";
import { newlineBreaks } from "../extensions/newlineBreaks.js";
import { handleAnchor } from "./anchorHandler.js";

marked.use(newlineBreaks);
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
            }" loading="lazy">
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
    static displayMessage(message) {
        const messageList = document.getElementById("messageList");
        const messageElement = document.createElement("li");
        if (message.content.includes(`@${localStorage.getItem("username")}`)) {
            messageElement.style = "background-color: #e7b9111f !important";
        }
        if (Validation.containsSingleEmoji(message.content)) {
            message.content = "# " + message.content;
        }
        messageElement.classList.add(
            "list-group-item",
            "text-wrap",
            "text-break",
            "bg-dark",
            "text-white"
        );
        if (localStorage.getItem("username") == message.userNickname) {
            messageElement.innerHTML = `
                <div class="message-actions position-relative" id="${
                    message.messageId
                }">
                    ${genMsgContent(message)}
                    <div class="btn-group position-absolute top-0 end-0">
                        <button class="btn-edit p-0" onclick="editMessage(${
                            message.messageId
                        })">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                                <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                                <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z" />
                            </svg>
                        </button>
                        <button class="btn-delete p-0" onclick="deleteMessage(${
                            message.messageId
                        })">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
                                <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-actions position-relative">
                    ${genMsgContent(message)}
                </div>
            `;
        }

        // Ajout du spinner sur les images
        messageElement.querySelectorAll("img").forEach((img) => {
            addLoader(img);
        });

        messageList.appendChild(messageElement);
        messageElement.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
        });
        handleAnchor();
    }
}
