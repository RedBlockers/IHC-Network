import { Auth } from "./services/auth.js";
import { handleGuildCreation } from "./services/guildService.js";
import { displayIcons } from "./components/guildRenderer.js";
import {
    displayPrivateChannels,
    handleFriendRequest,
} from "./services/friendService.js";
import { handleFriendList } from "./services/friendService.js";
import { UserAPI } from "./api/user.js";
import { handleFriendActions } from "./services/friendService.js";
import { handleMessageInput } from "./components/resizableTextArea.js";
import { Messages } from "./api/messages.js";
import { Listeners } from "./services/listeners.js";
import { ContextMenu } from "./utils/contextMenuUtils.js";
import { getAverageRGB } from "./utils/imageUtils.js";
import { addLoader } from "./utils/imageUtils.js";

//const listeners = new Listeners();
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "/pages/login.html";
}

await Auth.authenticateToken(token);

const friendList = await UserAPI.getFriends(token);
handleFriendRequest();
handleGuildCreation();
displayPrivateChannels();
displayIcons();

const match = window.location.href.match("\\/(\\d+)$");
if (match) {
    const channel = match[0];
    const mainContent = document.getElementsByClassName("main-content")[0];
    mainContent.innerHTML = `
        <div class="d-flex flex-row align-items-center button-bar" style="">
        <svg x="0" y="0" class="icon_fc4f04 mx-1" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" class=""></path>
            <path fill="currentColor" d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z" class=""></path>
        </svg>
        <h6 class="my-0">Amis</h6>
        <div style="width: 3px;background-color: rgba(255,255,255,0.3);height: 100%;" class="mx-3"></div>
        <button class="mx-1" onclick="window.location.href = '/pages/lobby.html'">
            Tous
        </button>
        <button class="mx-1" onclick="localStorage.setItem('afterRedirect', 1);window.location.href = '/pages/lobby.html'">
            En attente
        </button>
        <button class="mx-1">
            Bloqués
        </button>
        <button class="mx-1" id="openAddFriendModal">
            Ajouter
        </button>
    </div>
    <div class="container mt-2 container-sidebar-right" id="mainContainer">
        
    </div>
      <div class="container mt-5">
    <div id="messageContainer">
      <div id="messageBox" class="rounded mb-3 bg-dark text-white">
        <ul id="messageList" class="list-group bg-dark text-white">
        </ul>
      </div>

      <div class="input-group" style="width: calc(100% - 320px); margin-top: -25px;">
        <textarea id="messageInput" class="form-control bg-dark text-white" style="resize: none;" placeholder="Envoyez un message" rows="1" maxlength="4096"></textarea>
        <button id="emojiButton" class="btn" style="border:1px solid #ced4da;">😀</button>
        <button id="sendMessage" class="btn btn-primary">Envoyer</button>
      </div>
    </div>
  </div>
    `;
    handleMessageInput();
    Messages.loadPrivateMessages();
    const listener = new Listeners();
    listener.listenForMessages();
} else {
    const afterRedirect = localStorage.getItem("afterRedirect");
    if (afterRedirect) {
        console.log("After redirect:", afterRedirect);
        localStorage.removeItem("afterRedirect");
    }
    handleFriendList(friendList.friends, afterRedirect || false);
}
const listener = new Listeners();
listener.listenForUserEvent();
window.friendList = friendList;
window.handleFriendList = handleFriendList;
window.handleFriendActions = handleFriendActions;
window.displayPrivateChannels = displayPrivateChannels;
document.getElementById("userAvatar").src = `/images/${localStorage.getItem(
    "avatar"
)}`;
document.getElementById("usernameDisplay").textContent =
    localStorage.getItem("username");

const rgb = getAverageRGB(document.getElementById("userProfilePicture"));

document.getElementById(
    "userProfileHeader"
).style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
