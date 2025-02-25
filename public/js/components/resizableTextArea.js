import { Messages } from "../api/messages.js";

export function handleMessageInput() {
    document.getElementById("sendMessage").addEventListener("click", () => {
        Messages.sendMessage();
        // Réinitialiser le textarea
        textarea.value = "";
        textarea.style.height = "24px";
        document.getElementById("messageBox").style.height =
            "calc(85vh - 24px)";
    });
    const textarea = document.getElementById("messageInput");

    textarea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            Messages.sendMessage();
            // Réinitialiser le textarea
            textarea.value = "";
            textarea.style.height = "24px";
            document.getElementById("messageBox").style.height =
                "calc(85vh - 24px)";
            return;
        }
    });

    textarea.addEventListener("keyup", function (event) {
        // Réinitialise la hauteur avant de recalculer
        this.style.height = "auto";
        // Ajuste la hauteur en fonction du contenu
        this.style.height = this.scrollHeight + "px";
        // Limite la hauteur à 40vh (40% de la hauteur de la fenêtre)
        const maxHeight = window.innerHeight * 0.15;
        const messageBox = document.getElementById("messageBox");
        const isAtBottom =
            this.scrollTop + this.clientHeight >= this.scrollHeight - 1;
        if (this.scrollHeight > maxHeight) {
            this.style.height = maxHeight + "px";
            this.style.overflowY = "scroll"; // Active le défilement si la taille max est atteinte
            // Scroller le messageBox à la fin pour voir les nouveaux messages
            messageBox.scrollTop = messageBox.scrollHeight;
            if (isAtBottom) {
                textarea.scrollTop = textarea.scrollHeight;
            }
        } else {
            this.style.overflowY = "hidden"; // Désactive le défilement sinon

            // Ajuster la hauteur de messageBox
            const newHeight =
                window.innerHeight * 0.85 - this.scrollHeight + 12; // 12 pour le padding et autres marges
            messageBox.style.height = newHeight + "px";
        }
    });
}
