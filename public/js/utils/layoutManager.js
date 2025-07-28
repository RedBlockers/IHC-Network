// js/utils/layoutManager.js

(function () {
    const messageContainer = document.querySelector(".message-container");
    const textArea = document.querySelector(".message-input");
    const sendButton = document.querySelector(".send-button");

    function scrollToBottom() {
        if (messageContainer) {
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    }

    function resizeTextArea() {
        if (textArea) {
            textArea.style.height = "auto";
            textArea.style.height = textArea.scrollHeight + "px";
        }
    }

    if (textArea) {
        textArea.addEventListener("input", resizeTextArea);
        textArea.addEventListener("focus", scrollToBottom);
    }

    if (sendButton) {
        sendButton.addEventListener("click", () => {
            scrollToBottom();
            if (textArea) textArea.value = "";
            resizeTextArea();
        });
    }

    window.addEventListener("resize", scrollToBottom);
})();
