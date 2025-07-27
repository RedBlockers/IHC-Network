import { ContextMenu } from "../utils/contextMenuUtils.js";
import { CreateInvite, getGuildsByUser, getGuildById } from "../api/guilds.js";

export const displayIcons = async () => {
    try {
        // Récupération des données nécessaires
        const token = localStorage.getItem("token");
        const match = window.location.href.match("\\/(\\d+)\\/(\\d+)$");
        const guildId = match ? match[1] : 0;

        // Récupération des éléments du DOM
        const guildContainer = document.getElementById("guildContainer");
        const guildBarContainer = document.getElementById(
            "guildSelectionBarContainer"
        );

        if (!guildContainer || !guildBarContainer) {
            console.error("Conteneurs de guildes non trouvés");
            return;
        }

        // Récupération des guildes
        const guilds = await getGuildsByUser();

        // Rendu des guildes
        guilds.forEach((guild) => {
            guildContainer.insertAdjacentHTML(
                "afterbegin",
                `<div class="mb-2" data-bs-toggle="tooltip" data-bs-placement="right" title="${
                    guild.guildName
                }" id="guild_${
                    guild.guildId
                }" onclick="window.location.href = '/${guild.guildId}/${
                    JSON.parse(localStorage.getItem("lastVisitedChannels"))
                        ? JSON.parse(
                              localStorage.getItem("lastVisitedChannels")
                          )[guild.guildId]
                        : 0
                }'">
                     <img class="avatar guild" src="../images/${
                         guild.guildImage
                     }" >
                </div>`
            );

            guildBarContainer.insertAdjacentHTML(
                "afterbegin",
                `<div class="mb-2 selection-bar d-flex align-items-center" style="height: 45px;" id="guild_${guild.guildId}_selectionBar">
                    <div style="width: 100%;border-radius: 5px;"></div>
                </div>`
            );

            // Création du menu contextuel
            const guildElement = document.getElementById(
                `guild_${guild.guildId}`
            );
            if (guildElement) {
                const contextMenu = new ContextMenu(
                    guildElement,
                    document.getElementById("contextMenu")
                );
                contextMenu.addContextAction(
                    "Inviter des gens",
                    () => {
                        CreateInvite(token, guild.guildId);
                    },
                    { color: "#545af1" }
                );
            }
        });

        // Ajout de l'icône d'accueil
        guildContainer.insertAdjacentHTML(
            "afterbegin",
            `<div data-bs-toggle="tooltip" data-bs-placement="right" title="Accueil" id="homePage" onclick="window.location.href = '/pages/lobby.html' ">
                     <img class="avatar guild" src="../images/NoScord.jpg" >
                    </div>
                    <hr style="width: 40%" class="my-2">`
        );

        guildBarContainer.insertAdjacentHTML(
            "afterbegin",
            `<div class="mb-2 selection-bar d-flex align-items-center" style="height: 45px;" id="homePage_selectionBar">
                <div style="width: 100%;border-radius: 5px;"></div>
             </div>
             <hr style="width: 0%" class="my-2">`
        );

        // Ajout des événements de survol
        let elements = Array.from(document.querySelectorAll(".guild"));
        const homeElement = document.getElementById("homePage");
        if (homeElement) {
            elements.push(homeElement);
        }

        elements.forEach((element) => {
            element = element.parentElement;
            if (!element) return;

            if (element.id !== `guild_${guildId}`) {
                element.addEventListener("mouseover", () => {
                    try {
                        const selectionBarParentId = `${element.id}_selectionBar`;
                        const selectionBarParent =
                            document.getElementById(selectionBarParentId);
                        if (
                            selectionBarParent &&
                            selectionBarParent.children[0]
                        ) {
                            selectionBarParent.children[0].classList.add(
                                "hovered"
                            );
                        }
                    } catch (e) {
                        console.error("Erreur lors du survol:", e);
                    }
                });

                element.addEventListener("mouseout", () => {
                    try {
                        const selectionBarParentId = `${element.id}_selectionBar`;
                        const selectionBarParent =
                            document.getElementById(selectionBarParentId);
                        if (
                            selectionBarParent &&
                            selectionBarParent.children[0]
                        ) {
                            const selectionBar = selectionBarParent.children[0];
                            selectionBar.classList.remove("hovered");
                            selectionBar.animate(
                                [
                                    {
                                        backgroundColor: "white",
                                        height: "30%",
                                    },
                                    {
                                        backgroundColor: "transparent",
                                        height: "0%",
                                    },
                                ],
                                { duration: 300 }
                            );
                        }
                    } catch (e) {
                        console.error("Erreur lors de la fin du survol:", e);
                    }
                });
            }
        });

        // Initialisation des tooltips
        const tooltipTriggerList = document.querySelectorAll(
            '[data-bs-toggle="tooltip"]'
        );
        [...tooltipTriggerList].map(
            (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
        );

        // Mise en évidence de la guilde sélectionnée
        const selectedGuildSelectionBar = document.getElementById(
            `guild_${guildId}_selectionBar`
        );

        if (
            selectedGuildSelectionBar &&
            selectedGuildSelectionBar.children[0]
        ) {
            selectedGuildSelectionBar.children[0].classList.add("selected");
        }
    } catch (error) {
        console.error(
            "Erreur lors de l'affichage des icônes de guilde:",
            error
        );
    }
};

export const displayGuildMembers = async (guildId) => {
    const guildMembersContainer = document.getElementById("guildMembers");
    const guild = await getGuildById(localStorage.getItem("token"), guildId);
    guildMembersContainer.innerHTML = `            
        <div
            class="d-flex flex-row rounded userInformations"
            onclick="window.displayProfileInfo(this, ${guild.owner.userId})"
        >
            <img
                class="avatar"
                src="/images/${guild.owner.image}"
                alt="User Avatar"
            />
            <div class="d-flex flex-column justify-content-center mx-2">
                <div id="userInfoUsername">
                    <span id="usernameDisplay">${guild.owner.nickname}</span>
                </div>
                <div id="userInfoStatus">To implement</div>
            </div>
        </div>`;
    guild.members.forEach((member) => {
        guildMembersContainer.insertAdjacentHTML(
            "beforeend",
            `<div
                class="d-flex flex-row rounded userInformations"
                onclick="window.displayProfileInfo(this, ${member.userId})"
            >
                <img
                    class="avatar"
                    src="/images/${member.image}"
                    alt="User Avatar"
                />
                <div class="d-flex flex-column justify-content-center mx-2">
                    <div id="userInfoUsername">
                        <span id="usernameDisplay">${member.nickname}</span>
                    </div>
                    <div id="userInfoStatus">To implement</div>
                </div>
            </div>`
        );
    });
};
