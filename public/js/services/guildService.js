import { createGuild } from "../api/guilds.js";
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
        createGuild(guildName, guildDescription, guildImage);
    });
}
