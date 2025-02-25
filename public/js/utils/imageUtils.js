import { scrollToBottom } from "./scrollUtils.js";

export function addLoader(img) {
    const spinnerContainer = document.createElement("div");
    const spinner = document.createElement("div");
    spinner.classList.add("spinner-border", "text-primary", "spinner");
    spinnerContainer.classList.add(
        "d-flex",
        "align-self-center",
        "align-items-md-center",
        "justify-content-md-center"
    );
    // On place le spinner avant de lancer l'intervalle

    img.style.position = "relative"; // pour positionner le spinner correctement
    img.parentNode.appendChild(spinnerContainer);
    spinnerContainer.appendChild(spinner);
    img.parentNode.insertBefore(spinnerContainer, img.nextSibling);

    // On vérifie régulièrement si l'image est chargée
    var poll = setInterval(function () {
        if (img.naturalWidth) {
            clearInterval(poll);
            spinnerContainer.style.height = img.clientHeight + "px";
            spinnerContainer.style.width = img.clientWidth + "px";
            img.style.display = "none";
            const messageBox = document.getElementById("messageBox");
            scrollToBottom(messageBox);
        }
    }, 0); // Vérifie toutes les 100ms

    // Supprimer le spinner lorsque l'image est chargée
    img.onload = () => {
        setInterval(function () {
            spinner.remove();
            spinnerContainer.remove();
            img.style.display = "block";
        }, 100);
    };

    img.onerror = () => {
        setInterval(function () {
            spinner.remove();
            spinnerContainer.remove();
            img.style.display = "block";
        }, 100);
    };
}
