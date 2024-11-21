import {Auth} from './services/auth.js';
import {Listeners} from "./services/listeners.js";
import {Messages} from "./api/messages.js";
import {handleMessageInput} from "./components/resizableTextArea.js";

const listeners = new Listeners();
const token = localStorage.getItem('token');

if(!token){
    window.location.href = './pages/login.html';
}

await Auth.authenticateToken(token)
;
document.getElementById('userAvatar').src = `../images/${localStorage.getItem('avatar')}`;
document.getElementById('usernameDisplay').textContent = localStorage.getItem('username');

listeners.listenForAll();
Messages.loadAllMessages();
handleMessageInput();





//// Modifier un message
//function editMessage(messageId) {
//  const newContent = prompt('Modifier votre message :');
//  if (newContent) {
//    axios.put(`/messages/${messageId}`, { content: newContent }).then(() => {
//      loadMessages();
//    });
//  }
//}
//
//
//// Supprimer un message
//function deleteMessage(messageId) {
//  if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
//    axios.delete(`/messages/${messageId}`).then(() => {
//      loadMessages();
//    });
//  }
//}
