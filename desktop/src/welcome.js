"use strict";

const form = document.getElementById("connect");
const address = document.getElementById("address");
const error = document.getElementById("error");
const openButton = document.getElementById("open");

async function openInstance(value) {
    error.hidden = true;
    openButton.disabled = true;
    try {
        const input = value.trim();
        const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/i.test(input);
        const url = /^https?:\/\//i.test(input) ? input : `${local ? "http" : "https"}://${input}`;
        await window.qweillo.openInstance(url);
    } catch {
        error.textContent =
            "Cette instance n’a pas pu être ouverte. Vérifiez son adresse HTTPS, ou utilisez localhost pour une instance sur cet appareil.";
        error.hidden = false;
        openButton.disabled = false;
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    openInstance(address.value);
});
window.qweillo
    .listInstances()
    .then((entries) => {
        if (!entries.length) return;
        document.getElementById("history").hidden = false;
        for (const entry of entries) {
            const button = document.createElement("button");
            button.className = "entry";
            button.textContent = entry.origin;
            button.addEventListener("click", () => openInstance(entry.origin));
            document.getElementById("entries").append(button);
        }
    })
    .catch(() => {});
