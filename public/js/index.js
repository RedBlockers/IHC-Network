marked.use({
  async: false,
  pedantic: false,
  gfm: true,
  breaks:true,
});
if (!localStorage.getItem('token')) {
  window.location.href = 'pages/login.html'; // Rediriger si non connecté
} else {
  axios.post('/users/authenticateToken', {token: localStorage.getItem('token')})
  .then(response => {
    if(response.data.success){
      localStorage.setItem('username', response.data.username);
      console.log('Authentification réussie !', response.data);
      document.getElementById('usernameDisplay').textContent = 'Nom d\'utilisateur: ' + response.data.username;
    }else{
      console.error('Erreur lors de l\'authentification :', response.data);
      localStorage.removeItem('token');
      window.location.href = 'pages/login.html';
    }
  })
  .catch(error => {
    console.error('Erreur lors de l\'inscription :', error);
    localStorage.removeItem('token');
    window.location.href = 'pages/login.html';
  });
}
const socket = io();
const textarea = document.getElementById('messageInput');


textarea.addEventListener('keyup', function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
      // Réinitialiser le textarea
      this.value = '';
      this.style.height = '24px';
      document.getElementById('messageBox').style.height = 'calc(70vh - 24px)';
      return;
  }
  // Réinitialise la hauteur avant de recalculer
  this.style.height = 'auto';
  // Ajuste la hauteur en fonction du contenu
  this.style.height = (this.scrollHeight) + 'px';
  // Limite la hauteur à 40vh (40% de la hauteur de la fenêtre)
  const maxHeight = window.innerHeight * 0.15;
  const messageBox = document.getElementById('messageBox');
  const isAtBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - 1;
  if (this.scrollHeight > maxHeight) {
      this.style.height = maxHeight + 'px';
      this.style.overflowY = 'scroll'; // Active le défilement si la taille max est atteinte
      // Scroller le messageBox à la fin pour voir les nouveaux messages
      messageBox.scrollTop = messageBox.scrollHeight;
      if(isAtBottom){
        textarea.scrollTop = textarea.scrollHeight;
      }
  } else {
      this.style.overflowY = 'hidden'; // Désactive le défilement sinon
              
      // Ajuster la hauteur de messageBox
      const newHeight = window.innerHeight * 0.7 - this.scrollHeight + 12; // 12 pour le padding et autres marges
      messageBox.style.height = newHeight + 'px';
  }
});


// Charger les messages existants
function loadMessages() {
  axios.get('/messages/messages')
    .then(async response => {
      const messages = await response.data;
      const messageList = document.getElementById('messageList');
      messageList.innerHTML = ''; // Réinitialiser la liste des messages
      messages.forEach(message => {
        displayMessage(message);
      });
      scrollToBottom();
    });
}


function escapeHtml(unsafe) {
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}


function displayMessage(message) {
  const messageList = document.getElementById('messageList');
  const messageElement = document.createElement('li');
  if (message.contenu.includes(`@${localStorage.getItem('username')}`)){
    messageElement.style = 'background-color: #e7b9111f !important';
  }
  messageElement.classList.add('list-group-item', 'text-wrap', 'text-break','bg-dark', 'text-white');
  if(localStorage.getItem('username') == message.userPseudo)
  {
    messageElement.innerHTML = `
      <div class="message-actions position-relative">
        <div class="content">
          <div class="message-info-container d-flex flex-row">
            <img class="avatar mr-3" src="../images/${message.userImage}">
            <span class="message-info d-flex flex-row align-items-top">
              <p class="username mx-3">${message.userPseudo}</p>
              <p class="timestamp ">${new Date(message.dateEnvoi).toLocaleDateString("fr-FR")}</p>
            </span>
          </div>
          <div class="message-content">
            ${marked.parse(escapeHtml(message.contenu).replace(/\n/g, '<br>\n\n'))}
          </div>
        </div>
        <div class="btn-group position-absolute top-0 end-0">
          <button class="btn-edit p-0" onclick="editMessage(${message.id})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
              <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
            </svg>
          </button>
          <button class="btn-delete p-0" onclick="deleteMessage(${message.id})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }else{
    messageElement.innerHTML = `
    <div class="message-actions position-relative">
      <div class="content">
        <div class="message-info-container d-flex flex-row">
          <img class="avatar mr-3" src="../images/${message.userImage}">
          <span class="message-info d-flex flex-row align-items-top">
            <p class="username mx-3">${message.userPseudo}</p>
            <p class="timestamp ">${new Date(message.dateEnvoi).toLocaleDateString("fr-FR")}</p>
          </span>
        </div>
        <div class="message-content">
          ${marked.parse(escapeHtml(message.contenu).replace(/\n/g, '<br>\n\n'))}
        </div>
      </div>
    </div>
  `;
  }
  messageList.appendChild(messageElement);
}


function scrollToBottom() {
  const messageBox = document.getElementById('messageBox');
  messageBox.scrollTop = messageBox.scrollHeight;
}


// Envoi d'un message
document.getElementById('sendMessage').addEventListener('click', () => {
  sendMessage()

  // Réinitialiser le textarea
  textarea.value = '';
  textarea.style.height = '24px';
  document.getElementById('messageBox').style.height = 'calc(70vh - 24px)';
});


// Réception des nouveaux messages via WebSockets
socket.on('newMessage', (message) => {
  console.log(message)
  displayMessage(message);
  scrollToBottom();
});


function sendMessage(){
  const messageContent = document.getElementById('messageInput').value;
  if (messageContent.trim() !== '') {
    axios.post('/messages/messages', {content: {token:localStorage.getItem("token") ,messageContent: messageContent} }).then(() => {
      document.getElementById('messageInput').value = ''; // Vider le champ
      scrollToBottom();
    });
  }
}


// Modifier un message
function editMessage(messageId) {
  const newContent = prompt('Modifier votre message :');
  if (newContent) {
    axios.put(`/messages/${messageId}`, { content: newContent }).then(() => {
      loadMessages();
    });
  }
}


// Supprimer un message
function deleteMessage(messageId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
    axios.delete(`/messages/${messageId}`).then(() => {
      loadMessages();
    });
  }
}


function logOut(){
  localStorage.removeItem('token');
  window.location.href = 'pages/login.html';
}
loadMessages();