import { Picker } from "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js";

const customEmojis = [
    {
        name: "Cute kitty",
        shortcodes: ["cute", "cat", "kitty"],
        url: "https://i.giphy.com/l0MYt5jPR6QX5pnqM.webp", // ✅ GIF animé
    },
];

document.addEventListener("DOMContentLoaded", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const button = document.querySelector("#emojiButton");
    const messageInput = document.querySelector("#messageInput"); // contenteditable div

    if (!button || !messageInput) return;

    // Crée le picker
    const picker = new Picker({
        theme: "auto",
        customEmoji: customEmojis,
    });

    // Ajoute le picker au DOM mais le cache initialement
    picker.style.position = "absolute";
    picker.style.display = "none";
    document.body.appendChild(picker);

    // Positionne le picker au clic
    button.addEventListener("click", () => {
        const rect = button.getBoundingClientRect();

        // Affiche temporairement le picker pour mesurer sa hauteur
        picker.style.display = "block";
        picker.style.visibility = "hidden";

        // Attendre que le DOM calcule la hauteur
        requestAnimationFrame(() => {
            const pickerHeight = picker.offsetHeight;

            picker.style.top = `${rect.top + window.scrollY - pickerHeight}px`;
            picker.style.left = `${rect.left + window.scrollX}px`;
            picker.style.visibility = "visible";
        });
    });

    // Insère l'emoji dans le champ contenteditable
    picker.addEventListener("emoji-click", (event) => {
        const detail = event.detail;

        if (detail.unicode) {
            // Emoji natif
            const span = document.createElement("span");
            span.textContent = detail.unicode;
            messageInput.appendChild(span);
        } else if (detail.emoji?.url) {
            // Emoji custom
            const img = document.createElement("img");
            img.src = detail.emoji.url;
            img.alt = detail.emoji.name;
            img.style.width = "1.2em";
            img.style.height = "1.2em";
            img.style.verticalAlign = "middle";
            img.classList.add("emoji");
            messageInput.appendChild(img);
        }

        picker.style.display = "none";
        messageInput.focus();
    });
});
