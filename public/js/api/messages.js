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
    static sendMessage(){
        const messageContent = document.getElementById('messageInput').value;
        if (messageContent.trim() !== '') {
            axios.post('/messages/messages', {content: {token:localStorage.getItem("token") ,messageContent: messageContent} }).then(() => {
                document.getElementById('messageInput').value = ''; // Vider le champ
                const messageBox = document.getElementById('messageBox');
                scrollToBottom(messageBox);
            });
        }
    }
}