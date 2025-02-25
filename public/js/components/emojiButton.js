import { EmojiButton } from "https://cdn.jsdelivr.net/npm/@joeattardi/emoji-button@4/dist/index.min.js";

document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("#emojiButton");
    const picker = new EmojiButton({});
    document.querySelector(".emoji-picker").style.backgroundColor =
        "rgba(var(--bs-dark-rgb), var(--bs-bg-opacity))";
    document.querySelector(".emoji-picker__search").style.backgroundColor =
        "rgba(var(--bs-dark-rgb), var(--bs-bg-opacity))";
    picker.on("emoji", (emoji) => {
        const messageInput = document.querySelector("#messageInput");
        messageInput.value += emoji.emoji;
        setTimeout(() => {
            messageInput.focus();
        }, 100);
    });

    button.addEventListener("click", () => {
        picker.togglePicker(button);
    });
});
