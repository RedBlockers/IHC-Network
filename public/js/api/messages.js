import { MessageRenderer } from "../components/messageRenderer.js";
import { scrollToBottom } from "../utils/scrollUtils.js";

export class Messages {
    static loadMessageByChannelId(channelId, guildId) {
        axios
            .get(`/messages/messages/${guildId}/${channelId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            })
            .then(async (response) => {
                if (await response.data.redirect) {
                    const baseUrl = window.location.origin;
                    window.location.href = `${baseUrl}${response.data.url}`;
                    return;
                }
                const messages = await response.data;
                const messageList = document.getElementById("messageList");
                messageList.innerHTML = "";
                messages.forEach((message) => {
                    MessageRenderer.displayMessage(message);
                });
                const messageBox = document.getElementById("messageBox");
            });
    }
    static sendMessage() {
        const messageContent = document.getElementById("messageInput").value;
        let match = window.location.href.match("\\/(\\d+)\\/(\\d+)$");
        let channel = null;
        if (match) {
            channel = match[2];
        } else {
            match = window.location.href.match("\\/(\\d+)$");
            channel = match[1];
        }
        if (messageContent.trim() !== "") {
            axios
                .post(
                    "/messages/messages",
                    {
                        messageContent: messageContent,
                        channel: channel,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem(
                                "token"
                            )}`,
                        },
                    }
                )
                .then(() => {
                    document.getElementById("messageInput").value = ""; // Vider le champ
                    const messageBox = document.getElementById("messageBox");
                    scrollToBottom(messageBox);
                });
        }
    }

    static loadPrivateMessages() {
        const match = window.location.href.match("\\/(\\d+)$");
        const channel = match[1];
        axios
            .get(`/messages/messages/${channel}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            })
            .then(async (response) => {
                const messages = await response.data;
                const messageList = document.getElementById("messageList");
                messageList.innerHTML = "";
                messages.forEach((message) => {
                    MessageRenderer.displayMessage(message);
                });
                const messageBox = document.getElementById("messageBox");
            });
    }
}
