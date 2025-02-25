import { MessageRenderer } from "../components/messageRenderer.js";
import { scrollToBottom } from "../utils/scrollUtils.js";
import { displayChannel } from "../components/channelRenderer.js";

export class Listeners {
    constructor() {
        this.socket = io();
    }
    listenForMessages() {
        let match = window.location.href.match("\\/(\\d+)\\/(\\d+)$");
        let channel = null;
        if (match) {
            channel = match[2];
        } else {
            match = window.location.href.match("\\/(\\d+)$");
            channel = match[1];
        }
        this.socket.on(`newMessage/${channel}`, (message) => {
            MessageRenderer.displayMessage(message);
            scrollToBottom();
        });
    }
    listenForChannels() {
        const match = window.location.href.match("\\/(\\d+)\\/(\\d+)$");
        if (match) {
            const guild = match[1];
            this.socket.on(`newChannel/${guild}`, (channel) => {
                displayChannel(channel);
            });
        }
    }
    listenForUserEvent() {
        const username = window.localStorage.getItem("username");
        console.log(username);
        this.socket.on(`user${username}/updateFriendList`, async (data) => {
            console.log(window.displayMode);
            window.friendList.friends = data;
            if (window.displayMode === "pendingDemands") {
                await window.handleFriendList(data, true);
                await window.displayPrivateChannels();
            } else if (window.displayMode === "friendList") {
                await window.handleFriendList(data, false);
                await window.displayPrivateChannels();
            }
        });
    }
    listenForAll() {
        const methods = Object.getOwnPropertyNames(
            Object.getPrototypeOf(this)
        ).filter((prop) => typeof this[prop] === "function");
        methods.forEach((method) => {
            if (!["listenForAll", "constructor"].includes(method)) {
                this[method]();
            }
        });
    }
}
