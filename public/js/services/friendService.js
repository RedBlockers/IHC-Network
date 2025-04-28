import { Channels } from "../api/channels.js";
import { UserAPI } from "../api/user.js";
import { ContextMenu } from "../utils/contextMenuUtils.js";

export function handleFriendRequest() {
    const modal = new bootstrap.Modal(
        document.getElementById("addFriendModal")
    );
    const friendRequestModal = document.getElementById("openAddFriendModal");
    friendRequestModal.addEventListener("click", () => {
        modal.show();
    });
    const friendRequestButton = document.getElementById("addFriendModalAccept");
    friendRequestButton.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        const username = document.getElementById("friendUsername").value;
        const resp = await UserAPI.addFriend(token, username);
        if (resp.success) {
            modal.hide();
            window.createNotification({
                closeOnClick: true,
                displayCloseButton: true,
                positionClass: "nfc-bottom-right",
                showDuration: 3500,
                theme: "success",
            })({
                title: "Succès",
                message: resp.message,
            });
        } else {
            modal.hide();
            window.createNotification({
                closeOnClick: true,
                displayCloseButton: true,
                positionClass: "nfc-bottom-right",
                showDuration: 3500,
                theme: "error",
            })({
                title: "Erreur",
                message: resp.message,
            });
        }
    });
}

export async function handleFriendList(friendList, showPendings) {
    const mainContainer = document.getElementById("mainContainer");
    if (friendList.length == 0) {
        window.displayMode = "pendingDemands";
        mainContainer.innerHTML = "Aucun ami trouvé.";
        return;
    }
    mainContainer.innerHTML = "";
    if (showPendings) {
        window.displayMode = "pendingDemands";
        friendList = friendList.filter((f) => f.isPending);
        mainContainer.innerHTML = `En attente: ${friendList.length}`;
        friendList.forEach((f) => {
            if (f.isSender) {
                mainContainer.innerHTML += `
            <hr class="my-2">
            <div id="User${f.userId}" class="d-flex flex-row rounded userInformations">
            <img id="userAvatar0" class="avatar" src="/images/${f.userImage}" alt="avatar">
            <div class="d-flex flex-column justify-content-center mx-2">
                <div id="Username${f.userId}">
                    <span id="usernameDisplay${f.userId}">${f.username}</span>
                </div>
                <div id="userInfoStatus0">
                    placeholder
                </div>
            </div>
            <div class="userToolsBox d-flex justify-content-end align-items-center flex-row">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="gray" class="bi bi-person-dash mx-1" viewBox="0 0 16 16" data-bs-toggle="tooltip" data-bs-placement="top" title="Annuler la demande d'ami" onclick="handleFriendActions('cancel',${f.userId})">
                    <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M11 12h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1m0-7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>
                    <path d="M8.256 14a4.5 4.5 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10q.39 0 .74.025c.226-.341.496-.65.804-.918Q8.844 9.002 8 9c-5 0-6 3-6 4s1 1 1 1z"/>
                </svg>
            </div>
        </div>
            `;
            } else {
                mainContainer.innerHTML += `
                <hr class="my-2">
                <div id="User${f.userId}" class="d-flex flex-row rounded userInformations">
                <img id="userAvatar0" class="avatar" src="/images/${f.userImage}" alt="avatar">
                <div class="d-flex flex-column justify-content-center mx-2">
                    <div id="Username${f.userId}">
                        <span id="usernameDisplay${f.userId}">${f.username}</span>
                    </div>
                    <div id="userInfoStatus0">
                        placeholder
                    </div>
                </div>
                <div class="userToolsBox d-flex justify-content-end align-items-center flex-row">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="green" class="bi bi-person-add mx-1" viewBox="0 0 16 16" data-bs-toggle="tooltip" data-bs-placement="top" title="Ajouter un ami" onclick="handleFriendActions('accept',${f.userId})">
                        <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0m-2-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>
                        <path d="M8.256 14a4.5 4.5 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10q.39 0 .74.025c.226-.341.496-.65.804-.918Q8.844 9.002 8 9c-5 0-6 3-6 4s1 1 1 1z"/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="gray" class="bi bi-person-dash mx-1" viewBox="0 0 16 16" data-bs-toggle="tooltip" data-bs-placement="top" title="Refuser la demande d'ami" onclick="handleFriendActions('refuse',${f.userId})">
                        <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M11 12h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1m0-7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>
                        <path d="M8.256 14a4.5 4.5 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10q.39 0 .74.025c.226-.341.496-.65.804-.918Q8.844 9.002 8 9c-5 0-6 3-6 4s1 1 1 1z"/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="rgb(255, 60, 60)" class="bi bi-person-slash mx-1" viewBox="0 0 16 16" data-bs-toggle="tooltip" data-bs-placement="top" title="Bloquer la personne" onclick="handleFriendActions('block',${f.userId})">
                        <path d="M13.879 10.414a2.501 2.501 0 0 0-3.465 3.465zm.707.707-3.465 3.465a2.501 2.501 0 0 0 3.465-3.465m-4.56-1.096a3.5 3.5 0 1 1 4.949 4.95 3.5 3.5 0 0 1-4.95-4.95ZM11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m.256 7a4.5 4.5 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10q.39 0 .74.025c.226-.341.496-.65.804-.918Q8.844 9.002 8 9c-5 0-6 3-6 4s1 1 1 1z"/>
                      </svg>
                </div>
            </div>
                `;
            }
        });
    } else {
        window.displayMode = "friendList";
        const channels = await Channels.getPrivateChannelsByUserId(
            localStorage.getItem("token")
        );
        mainContainer.innerHTML = `Amis: ${channels.length}`;
        channels.forEach((f) => {
            mainContainer.insertAdjacentHTML(
                "beforeend",
                `
            <hr class="my-2">
            <div id="User${f.user.userId}" class="d-flex flex-row rounded userInformations" onclick="window.location.href = '/${f.channelId}'">
            <img id="userAvatar0" class="avatar" src="/images/${f.user.userImage}" alt="avatar">
            <div class="d-flex flex-column justify-content-center mx-2">
                <div id="Username${f.user.userId}">
                    <span id="usernameDisplay${f.user.userId}">${f.user.username}</span>
                </div>
                <div id="userInfoStatus0">
                    placeholder
                </div>
            </div>`
            );
            AddContextMenu(
                document.getElementById(`User${f.user.userId}`),
                f.user,
                f.channelId
            );
        });
    }
}

export function handleFriendActions(type, FriendId) {
    switch (type) {
        case "accept":
            UserAPI.acceptFriend(localStorage.getItem("token"), FriendId);
            break;
        case "refuse":
            UserAPI.refuseFriend(localStorage.getItem("token"), FriendId);
            break;
        case "block":
            UserAPI.blockFriend(localStorage.getItem("token"), FriendId);
            break;
        case "cancel":
            UserAPI.cancelFriend(localStorage.getItem("token"), FriendId);
            break;
        case "remove":
            UserAPI.removeFriend(localStorage.getItem("token"), FriendId);
            break;
    }
}

export async function displayPrivateChannels() {
    const channels = await Channels.getPrivateChannelsByUserId(
        localStorage.getItem("token")
    );
    if (channels.length == 0) {
        const secondaryContainer =
            document.getElementById("secondaryContainer");
        secondaryContainer.innerHTML = "";
        return;
    }
    const secondaryContainer = document.getElementById("secondaryContainer");
    secondaryContainer.innerHTML = "";
    channels.forEach((c) => {
        secondaryContainer.insertAdjacentHTML(
            "beforeend",
            `
                        <div id="UserChannel${c.user.userId}" class="d-flex flex-row rounded userInformations my-1" onclick="window.location.href = '/${c.channelId}'">
                <img id="userChannelAvatar0" class="avatar" src="/images/${c.user.userImage}" alt="avatar">
                <div class="d-flex flex-column justify-content-center mx-2">
                    <div id="UsernameChannel${c.user.userId}">
                        <span id="usernameChannelDisplay${c.user.userId}">${c.user.username}</span>
                    </div>
                    <div id="userInfoStatus0">
                        placeholder
                    </div>
                </div>
                `
        );
        AddContextMenu(
            document.getElementById(`UserChannel${c.user.userId}`),
            c.user,
            c.channelId
        );
    });
}

function AddContextMenu(target, friend, channelId) {
    let contextMenu = new ContextMenu(
        target,
        document.getElementById("contextMenu")
    );
    contextMenu.addContextAction("Profil", () => {
        window.displayProfileInfo(target, friend.userId);
    });
    contextMenu.addContextAction("Ouvrir les MP", () => {
        window.location.href = `/${channelId}`;
    });
    contextMenu.addContextAction(
        "Retirer l'ami",
        () => {
            handleFriendActions("remove", friend.userId);
        },
        { color: "rgb(255,60,60)" }
    );
}
