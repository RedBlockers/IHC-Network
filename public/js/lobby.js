import {Auth} from './services/auth.js';
import { handleGuildCreation } from './services/guildService.js';
import {displayIcons} from './components/guildRenderer.js';
import { displayPrivateChannels, handleFriendRequest } from './services/friendService.js';
import { handleFriendList } from './services/friendService.js';
import { UserAPI } from './api/user.js';
import { handleFriendActions } from './services/friendService.js';

//const listeners = new Listeners();
const token = localStorage.getItem('token');

if(!token){
    window.location.href = '/pages/login.html';
}

await Auth.authenticateToken(token);

const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
if(match){
    const guild = match[1];
    const channel = match[2];
    localStorage.setItem('currentSession', JSON.stringify({guild: guild, channel: channel}));
}else if(localStorage.getItem('currentSession') && !window.location.href.match('\\/(.+)$')){
    const currentSession = JSON.parse(localStorage.getItem('currentSession'));
    window.location.href = `/${currentSession.guild}/${currentSession.channel}`;
}

document.getElementById('userAvatar').src = `/images/${localStorage.getItem('avatar')}`;
document.getElementById('usernameDisplay').textContent = localStorage.getItem('username');

const friendList = await UserAPI.getFriends(token);
handleFriendList(friendList.friends, true);
handleFriendRequest();
handleGuildCreation();
displayPrivateChannels();
displayIcons();
window.handleFriendActions = handleFriendActions;