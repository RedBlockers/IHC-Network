import { CropperModal } from "../components/cropperModal.js";

export function handleGuildCreation() {
    const modal = new bootstrap.Modal(document.getElementById("addGuildModal"));
    const guildCreationModal = document.getElementById("openAddGuildModal");
    guildCreationModal.addEventListener("click", () => {
        modal.show();
    });
    let fileInput = document.getElementById("guildIcon");
    const cropper = new CropperModal(fileInput);
    const guildCreationButton = document.getElementById("addGuildModalAccept");
    guildCreationButton.addEventListener("click", () => {
        const token = localStorage.getItem("token");
        const guildName = document.getElementById("guildName").value;
        const guildDescription =
            document.getElementById("guildDescription").value;
        const guildImage = cropper.getCroppedImage();
        axios
            .post("/guilds/createGuild", {
                token,
                guildName,
                guildDescription,
                guildImage,
            })
            .then((response) => {
                if (response.status === 200) {
                    window.location.reload();
                } else if (response.status === 401) {
                    alert("Une erreur d'authentification est survenue");
                    window.location.reload();
                } else {
                    alert("Une erreur survenue");
                }
            });
    });
}
