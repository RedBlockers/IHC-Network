import {MessageRenderer} from "../components/messageRenderer.js";
import {scrollToBottom} from "../utils/scrollUtils.js";


export class Messages {
    static loadAllMessages() {
        axios.get('/messages/messages')
            .then(async response => {
                const messages = await response.data;
                const messageList = document.getElementById('messageList');
                messageList.innerHTML = '';
                messages.forEach(message => {
                    MessageRenderer.displayMessage(message);
                });
                const messageBox = document.getElementById('messageBox');
                scrollToBottom(messageBox);
            });
    }
    static loadMessageByChannelId(channelId, guildId){
        axios.get(`/messages/messages/${guildId}/${channelId}`,{headers: {token: localStorage.getItem("token")}})
            .then(async response => {

                if (await response.data.redirect){
                    const baseUrl = window.location.origin;
                    window.location.href = `${baseUrl}${response.data.url}`;
                    return;
}
                const messages = await response.data;
                const messageList = document.getElementById('messageList');
                messageList.innerHTML = '';
                messages.forEach(message => {
                    MessageRenderer.displayMessage(message);
                });
                const messageBox = document.getElementById('messageBox');
            })
    }
    static sendMessage(){
        const messageContent = document.getElementById('messageInput').value;
        const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
        const channel = match[2];
        if (messageContent.trim() !== '') {
            axios.post('/messages/messages', {content: {token:localStorage.getItem("token") ,messageContent: messageContent,channel: channel} }).then(() => {
                document.getElementById('messageInput').value = ''; // Vider le champ
                const messageBox = document.getElementById('messageBox');
                scrollToBottom(messageBox);
            });
        }
    }
}