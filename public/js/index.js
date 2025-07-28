import { Auth } from "./services/auth.js";
import { Listeners } from "./services/listeners.js";
import { Messages } from "./api/messages.js";
import { handleMessageInput } from "./components/resizableTextArea.js";
import { handleGuildCreation } from "./services/guildService.js";
import {
    displayIcons,
    displayGuildMembers,
} from "./components/guildRenderer.js";
import { Channels } from "./api/channels.js";
import { displayChannel } from "./components/channelRenderer.js";
import { UserUtils } from "./utils/UserUtils.js";
import { handleChannelCreation } from "./services/channelService.js";

const listeners = new Listeners();
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "/pages/login.html";
}

await Auth.authenticateToken(token);

// Rediriger l'utilisateur vers son ancienne page si il ne vas pas sur une nouvelle
const match = window.location.href.match("\\/(\\d+)\\/(\\d+)$");
if (!match) {
    window.location.href = "/pages/lobby.html";
}

const lastVisitedChannels = JSON.parse(
    localStorage.getItem("lastVisitedChannels") || "{}"
);

// Mettre à jour le dernier canal visité pour le serveur actuel
lastVisitedChannels[match[1]] = match[2];
localStorage.setItem(
    "lastVisitedChannels",
    JSON.stringify(lastVisitedChannels)
);

const channels = await Channels.getChannelsByGuildId(match[1]);
channels.forEach((channel) => displayChannel(channel, match[2]));
document.getElementById("userAvatar").src = `/images/${localStorage.getItem(
    "avatar"
)}`;
document.getElementById("usernameDisplay").textContent =
    localStorage.getItem("username");

listeners.listenForAll();
Messages.loadMessageByChannelId(match[2], match[1], 100, 0);
Messages.setupInfiniteScroll(match[2], match[1]);
handleMessageInput();
handleGuildCreation();
handleChannelCreation();
displayIcons();
displayGuildMembers(match[1]);
window.displayProfileInfo = UserUtils.positionProfileContainer;

const messageInput = document.getElementById("messageInput");
const placeholder = document.querySelector(".custom-placeholder");

function togglePlaceholder() {
    const text = messageInput.textContent.trim();
    placeholder.style.display = text ? "none" : "block";
}

messageInput.addEventListener("input", togglePlaceholder);
messageInput.addEventListener("focus", togglePlaceholder);
messageInput.addEventListener("blur", togglePlaceholder);

// Initial check
togglePlaceholder();
