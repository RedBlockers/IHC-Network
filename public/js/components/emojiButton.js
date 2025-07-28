import { Picker } from "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js";

const customEmojis = [
    {
        name: "Cute kitty",
        shortcodes: ["cute", "cat", "kitty"],
        url: "https://i.giphy.com/l0MYt5jPR6QX5pnqM.webp",
    },
];

document.addEventListener("DOMContentLoaded", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const button = document.querySelector("#emojiButton");
    const messageInput = document.querySelector("#messageInput");

    if (!button || !messageInput) return;

    const picker = new Picker({
        theme: "auto",
        customEmoji: customEmojis,
    });

    picker.style.position = "absolute";
    picker.style.display = "none";
    document.body.appendChild(picker);

    let isPickerVisible = false;

    function positionPicker() {
        const rect = button.getBoundingClientRect();
        const pickerHeight = picker.offsetHeight;
        const pickerWidth = picker.offsetWidth;

        const top = rect.top + window.scrollY - pickerHeight;
        let left;

        if (window.innerWidth <= 1000) {
            // Affiche à gauche du bouton
            left = rect.left + window.scrollX - pickerWidth + rect.width;
        } else {
            // Affiche à droite du bouton
            left = rect.left + window.scrollX;
        }

        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
    }

    function togglePicker() {
        if (isPickerVisible) {
            picker.style.display = "none";
            isPickerVisible = false;
        } else {
            picker.style.display = "block";
            picker.style.visibility = "hidden";

            requestAnimationFrame(() => {
                positionPicker();
                picker.style.visibility = "visible";
                isPickerVisible = true;
            });
        }
    }

    button.addEventListener("click", (e) => {
        e.stopPropagation(); // Empêche la fermeture immédiate
        togglePicker();
    });

    document.addEventListener("click", (e) => {
        if (
            isPickerVisible &&
            !picker.contains(e.target) &&
            e.target !== button
        ) {
            picker.style.display = "none";
            isPickerVisible = false;
        }
    });

    window.addEventListener("resize", () => {
        if (isPickerVisible) {
            positionPicker();
        }
    });

    picker.addEventListener("emoji-click", (event) => {
        const detail = event.detail;
        let node;

        if (detail.unicode) {
            node = document.createElement("span");
            node.textContent = detail.unicode;
        } else if (detail.emoji?.url) {
            node = document.createElement("img");
            node.src = detail.emoji.url;
            node.alt = detail.emoji.name;
            node.style.width = "1.2em";
            node.style.height = "1.2em";
            node.style.verticalAlign = "middle";
            node.classList.add("emoji");
        }

        if (node) {
            insertAtCursor(node);
        }

        picker.style.display = "none";
        isPickerVisible = false;
        messageInput.focus();
    });

    function insertAtCursor(node) {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            messageInput.appendChild(node); // fallback
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);

        // Repositionne le curseur juste après le nœud inséré
        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
    }
});
