import { MessageRenderer } from "../components/messageRenderer.js";
import { scrollToBottom } from "../utils/scrollUtils.js";

export class Messages {
    static hasMoreMessages = true;
    static isLoading = false;
    static limit = 100; // Limite de messages à afficher par channel
    static currentOffset = 0; // Offset pour la pagination des messages

    static setupInfiniteScroll(channelId, guildId) {
        const messageBox = document.getElementById("messageBox");
        const messageList = document.getElementById("messageList");
        let isLoading = false;
        let lastScrollHeight = 0;

        messageBox.addEventListener("scroll", async () => {
            // Vérifier si on est en haut et qu'on peut charger plus de messages
            if (
                messageBox.scrollTop < 50 &&
                !isLoading &&
                this.hasMoreMessages
            ) {
                isLoading = true;

                // Stocker le dernier message affiché pour restaurer la position de scroll
                const lastElement = messageList.firstElementChild;

                try {
                    // Charger les messages
                    await this.loadMessageByChannelId(
                        channelId,
                        guildId,
                        this.limit,
                        this.currentOffset + this.limit
                    );

                    // Mettre à jour l'offset
                    this.currentOffset += this.limit;

                    // Restaurer la position de scroll
                    console.log(
                        "lastElement",
                        lastElement,
                        messageList.firstElementChild
                    );
                    setTimeout(() => {
                        lastElement.scrollIntoView({
                            behavior: "instant",
                            block: "start",
                        });
                    }, 5);
                } catch (error) {
                    console.error("Erreur lors du chargement:", error);
                } finally {
                    isLoading = false;
                }
            }
        });
    }

    static async loadMessageByChannelId(channelId, guildId, limit, offset) {
        try {
            const response = await axios.get(
                `/messages/messages/${guildId}/${channelId}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem(
                            "token"
                        )}`,
                    },
                    params: {
                        limit: limit || 100,
                        offset: offset || 0,
                    },
                    timeout: 5000,
                }
            );

            if (response.data.redirect) {
                window.location.href = `${window.location.origin}${response.data.url}`;
                return;
            }

            const messages = response.data.messages;
            this.hasMoreMessages = response.data.hasMoreMessages;

            // Afficher les messages dans l'ordre inverse pour qu'ils s'affichent correctement
            if (offset === 0) {
                messages.reverse().forEach((message) => {
                    MessageRenderer.displayMessage(message);
                });
            } else {
                messages.forEach((message) => {
                    MessageRenderer.displayMessage(message, true); // true pour prepend
                });
            }

            return messages;
        } catch (error) {
            console.error("Erreur lors du chargement des messages:", error);
            throw error;
        }
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
                })
                .catch((error) => {
                    console.error("Erreur lors de l'envoi du message :", error);
                    const messageBox = document.getElementById("messageBox");
                    messageBox.innerHTML =
                        "<p>Erreur lors de l'envoi du message.</p>";
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
            })
            .catch((error) => {
                console.error(
                    "Erreur lors du chargement des messages privés :",
                    error
                );
                const messageBox = document.getElementById("messageBox");
                messageBox.innerHTML =
                    "<p>Erreur lors du chargement des messages privés.</p>";
            });
    }
}
