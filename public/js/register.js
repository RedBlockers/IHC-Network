const dropContainer = document.getElementById("dropcontainer");
const fileInput = document.getElementById("profilePicture");
import { CropperModal } from "../js/components/cropperModal.js";

dropContainer.addEventListener(
    "dragover",
    (e) => {
        e.preventDefault();
    },
    false
);

dropContainer.addEventListener("dragenter", () => {
    dropContainer.classList.add("drag-active");
});

dropContainer.addEventListener("dragleave", () => {
    dropContainer.classList.remove("drag-active");
});

dropContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    dropContainer.classList.remove("drag-active");
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event("change"));
});

const cropper = new CropperModal(fileInput);

document
    .getElementById("registerForm")
    .addEventListener("submit", function (e) {
        e.preventDefault();

        let formData = new FormData();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const password2 = document.getElementById("confirmPassword").value;
        const mail = document.getElementById("email").value;

        if (password != password2) {
            alert("Les deux mots de passe doivent être identique !");
            return;
        }

        let croppedImage = cropper.getCroppedImage();

        // Envoyer les données au serveur via axios
        axios
            .post("/users/register", {
                username: username,
                password: password,
                mail: mail,
                profileImage: croppedImage,
            })
            .then((response) => {
                if (response.data.success) {
                    console.log("Inscription réussie !", response.data);
                    localStorage.setItem("token", response.data.token);

                    window.location.href = "../../index.html";
                } else {
                    console.error(
                        "Erreur lors de l'inscription :",
                        response.data
                    );
                    alert(response.data.message);
                }
            })
            .catch((error) => {
                console.error("Erreur lors de l'inscription :", error);
            });
    });
