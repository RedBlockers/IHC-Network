import { UserAPI } from "../api/user.js";
import { getAverageRGB } from "../utils/imageUtils.js";

async function editProfileContainerInfo(userId) {
    const container = document.querySelector(".userProfileContainer");
    const userInfo = await UserAPI.getUser(localStorage.getItem('token'),userId);
    console.log(userInfo);

    const userProfilePictureElement = document.getElementById("userProfilePicture");
    const userNameProfileElement = container.querySelector("h4");
    const userNoteElement = container.querySelector(".noteContainer p");
    const userStatusElement = document.getElementById("statusText");
    console.log(userNameProfileElement);
    userProfilePictureElement.src = "/images/" + userInfo.userImage;
    userProfilePictureElement.alt = userInfo.username;

    userNameProfileElement.innerText = userInfo.username;
    userNoteElement.innerText = userInfo.notes || "Pas de note";
    userStatusElement.innerText = userInfo.aboutMe || "Pas de statut";
    if (userInfo.isOwn) {
        document.getElementById("auxProfileButtonContainer").style.display = "block";
        document.getElementById("editPresence").style.display = "block";
        document.getElementById("mainProfileHorisontalBar").style.display = "block";
    }else {
        document.getElementById("auxProfileButtonContainer").style.setProperty("display", "none", "important");        document.getElementById("editPresence").style.display = "none";
        document.getElementById("mainProfileHorisontalBar").style.display = "none";
    }
}


export class UserUtils {
    static async positionProfileContainer(triggerElement, userId) {
        const container = document.querySelector(".userProfileContainer");
        await editProfileContainerInfo(userId);
        // S'assurer que le conteneur est visible pour obtenir ses dimensions réelles
        container.style.display = "block";
        container.style.visibility = "hidden"; // Visible pour les calculs mais pas pour l'utilisateur

        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        // Récupérer la position et dimensions de l'élément déclencheur
        const triggerRect = triggerElement.getBoundingClientRect();

        // Calculer la position initiale (à droite de l'élément cliqué)
        let left = triggerRect.right + 10; // 10px de marge
        let top = triggerRect.top;

        // Vérifier si le conteneur déborde de la fenêtre à droite
        if (left + containerWidth > window.innerWidth) {
            // Placer à gauche de l'élément déclencheur si débordement
            left = triggerRect.left - containerWidth - 10;
        }

        // Si toujours pas d'espace suffisant, centrer horizontalement
        if (left < 0) {
            left = Math.max(10, (window.innerWidth - containerWidth) / 2);
        }

        // Vérifier si le conteneur déborde en bas
        if (top + containerHeight > window.innerHeight) {
            // Deux stratégies possibles:

            // 1. Aligner le bas du conteneur avec le bas de l'écran, avec une marge
            top = window.innerHeight - containerHeight - 10;

            // 2. Alternative: Placer au-dessus de l'élément déclencheur si possible
            if (triggerRect.top > containerHeight) {
                top = triggerRect.top - containerHeight - 10;
            }
        }

        // S'assurer que le haut n'est pas négatif
        top = Math.max(10, top);

        // Appliquer les nouvelles positions
        container.style.left = left + "px";
        container.style.top = top + "px";

        // Rendre visible pour l'utilisateur
        container.style.visibility = "visible";

        const img = document.getElementById("userProfilePicture");
        // Fonction qui calcule la moyenne des couleurs
        const rgb = getAverageRGB(img);
    
        // Application de la couleur en fond
        document.getElementById("userProfileHeader").style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        const targetElement = document.querySelector(".userProfileContainer");
        const handleClickOutside = (event) => {
            if (!targetElement.contains(event.target)) {
                targetElement.style.display = "none"; // Masquer l'élément
                document.removeEventListener("click", handleClickOutside); // Supprimer l'écouteur
            }
        };
        document.addEventListener("click", handleClickOutside);

    }
}
