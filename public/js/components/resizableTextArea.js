import { Messages } from "../api/messages.js";

export function handleMessageInput() {
    const textarea = document.getElementById("messageInput");
    const messageBox = document.getElementById("messageBox");
    const sendButton = document.getElementById("sendMessage");

    function resetTextarea() {
        textarea.innerHTML = "";
        textarea.style.height = "24px";
        messageBox.style.height = "calc(85vh - 24px)";
    }

    function getCleanMessage() {
        return textarea.innerHTML
            .replace(/&nbsp;/g, " ")
            .replace(/<br\s*\/?>/gi, "\n")
            .trim();
    }

    function sendMessage() {
        const message = getCleanMessage();
        console.log("Message envoyé:", message);
        if (message.length === 0) return;

        Messages.sendMessage(message); // ← passe le message nettoyé
        resetTextarea();
    }

    sendButton.addEventListener("click", sendMessage);

    textarea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    textarea.addEventListener("keyup", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";

        const maxHeight = window.innerHeight * 0.15;
        const isAtBottom =
            this.scrollTop + this.clientHeight >= this.scrollHeight - 1;

        if (this.scrollHeight > maxHeight) {
            this.style.height = maxHeight + "px";
            this.style.overflowY = "scroll";
            messageBox.scrollTop = messageBox.scrollHeight;
            if (isAtBottom) {
                textarea.scrollTop = textarea.scrollHeight;
            }
        } else {
            this.style.overflowY = "hidden";
            const newHeight =
                window.innerHeight * 0.85 - this.scrollHeight + 12;
            messageBox.style.height = newHeight + "px";
        }
    });
}
