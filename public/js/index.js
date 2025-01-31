import {Auth} from './services/auth.js';
import {Listeners} from "./services/listeners.js";
import {Messages} from "./api/messages.js";
import {handleMessageInput} from "./components/resizableTextArea.js";
import { handleGuildCreation } from './services/guildService.js';
import {displayIcons} from './components/guildRenderer.js';
import {Channels} from "./api/channels.js";
import {displayChannel} from "./components/channelRenderer.js";

const listeners = new Listeners();
const token = localStorage.getItem('token');

if(!token){
    window.location.href = '/pages/login.html';
}

await Auth.authenticateToken(token);

// Rediriger l'utilisateur vers son ancienne page si il ne vas pas sur une nouvelle
const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
if(match){
    const guild = match[1];
    const channels = match[2];
    localStorage.setItem('currentSession', JSON.stringify({guild: guild, channel: channels}));
}else if(localStorage.getItem('currentSession') && !window.location.href.match('\\/(.+)$')){
    const currentSession = JSON.parse(localStorage.getItem('currentSession'));
    window.location.href = `/${currentSession.guild}/${currentSession.channel}`;
}else{
    window.location.href = '/pages/lobby.html';
}

const channels = await Channels.getChannelsByGuildId(match[1])
channels.forEach(channel => displayChannel(channel));
document.getElementById('userAvatar').src = `/images/${localStorage.getItem('avatar')}`;
document.getElementById('usernameDisplay').textContent = localStorage.getItem('username');

listeners.listenForAll();
Messages.loadMessageByChannelId(match[2],match[1]);
handleMessageInput();
handleGuildCreation();
displayIcons();



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
