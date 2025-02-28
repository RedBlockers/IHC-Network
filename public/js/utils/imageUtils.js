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

export function getAverageRGB(imgEl) {
    var blockSize = 5, // only visit every 5 pixels
        defaultRGB = { r: 0, g: 0, b: 0 }, // for non-supporting envs
        canvas = document.createElement("canvas"),
        context = canvas.getContext && canvas.getContext("2d"),
        data,
        width,
        height,
        i = -4,
        length,
        rgb = { r: 0, g: 0, b: 0 },
        count = 0;

    if (!context) {
        return defaultRGB;
    }

    height = canvas.height =
        imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
    width = canvas.width =
        imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;

    context.drawImage(imgEl, 0, 0);

    try {
        data = context.getImageData(0, 0, width, height);
    } catch (e) {
        /* security error, img on diff domain */
        return defaultRGB;
    }

    length = data.data.length;

    while ((i += blockSize * 4) < length) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i + 1];
        rgb.b += data.data[i + 2];
    }

    // ~~ used to floor values
    rgb.r = ~~(rgb.r / count);
    rgb.g = ~~(rgb.g / count);
    rgb.b = ~~(rgb.b / count);

    return rgb;
}
