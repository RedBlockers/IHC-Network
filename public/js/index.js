const newlineBreaksExtension = {
    name: 'newlineBreaks',
    start(src) { return src.indexOf('\n'); },
    tokenizer(src) {
        const match = src.match(/^\n+/);
        if (match) {
            return {
                type: 'newlineBreaks',
                raw: match[0],
                text: match[0],
            };
        }
    },
    renderer(token) {
        return token.text.replace(/\n{2,}/g, (match) => {
            return '<br>'.repeat(match.length-1);
        });
    },
};

const newlineBreaks = {
    extensions: [
        {
            ...newlineBreaksExtension,
            level: 'block',
        },
        {
            ...newlineBreaksExtension,
            level: 'inline',
        },
    ],
};

marked.use(newlineBreaks);
marked.use({
  async: false,
  pedantic: false,
  gfm: true,
  breaks:false,
});
if (!localStorage.getItem('token')) {
  window.location.href = 'pages/login.html'; // Rediriger si non connecté
} else {
  axios.post('/users/authenticateToken', {token: localStorage.getItem('token')})
  .then(response => {
    if(response.data.success){
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('avatar', response.data.avatar);
      console.log('Authentification réussie !', response.data);
      document.getElementById('userAvatar').src = `../images/${response.data.avatar}`;
      document.getElementById('usernameDisplay').textContent = response.data.username;
    }else{
      console.error('Erreur lors de l\'authentification :', response.data);
      localStorage.removeItem('token');
      window.location.href = 'pages/login.html';
    }
  })
  .catch(error => {
    console.error('Erreur lors de l\'authentification :', error);
    localStorage.removeItem('token');
    window.location.href = 'pages/login.html';
  });
}

axios.post('/guilds/getGuilds', {token: localStorage.getItem('token')})
    .then(response => {
        if(response.status == 401) {
            console.error('Erreur lors de l\'authentification :', error);
            localStorage.removeItem('token');
            window.location.href = 'pages/login.html';
        }else if(response.status == 200) {
            console.log(response.data);
        }
    })

const socket = io();
const textarea = document.getElementById('messageInput');

textarea.addEventListener('keydown', function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
      // Réinitialiser le textarea
      this.value = '';
      this.style.height = '24px';
      document.getElementById('messageBox').style.height = 'calc(85vh - 24px)';
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
      const newHeight = window.innerHeight * 0.85 - this.scrollHeight + 12; // 12 pour le padding et autres marges
      messageBox.style.height = newHeight + 'px';
  }
});

function HandleAnchor() {
    document.querySelectorAll('a').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("test");
            if (confirm("Voulez-vous vraiment ouvrir ce lien dans un nouvel onglet ?")) {
                window.open(anchor.href, '_blank');
            }
        },{ once: true });
    });
}

// Charger les messages existants
function loadMessages() {
  axios.get('/messages/messages')
    .then(async response => {
      const messages = await response.data;
      const messageList = document.getElementById('messageList');
      messageList.innerHTML = '';
      messages.forEach(message => {
        displayMessage(message);
      });
      scrollToBottom();
    });
}


function escapeHtml(unsafe) {
    // Utiliser un tableau pour stocker les segments
    const codeBlocks = [];

    // Remplace temporairement les blocs de code par des marqueurs
    let processedText = unsafe.replace(/```([^`]+)```/g, (match, codeContent) => {
        codeBlocks.push(codeContent);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;  // Remplace par un marqueur unique
    });

    // Échapper les caractères spéciaux hors des blocs de code
    processedText = processedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Réinjecter les blocs de code non échappés
    codeBlocks.forEach((codeContent, index) => {
        processedText = processedText.replace(`__CODE_BLOCK_${index}__`, `\`\`\`${codeContent}\`\`\``);
    });
    return processedText;
}
function formatTimestamp(sentDate) {
    const messageDate = new Date(sentDate);
    const currentDate = new Date();

    if (messageDate.toLocaleDateString('fr-FR') === currentDate.toLocaleDateString('fr-FR')) {
        return messageDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        return messageDate.toLocaleDateString('fr-FR');
    }
}

function containsSingleEmoji(message) {
    // Expression régulière pour détecter un unique emoji
    const singleEmojiRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;
    return singleEmojiRegex.test(message.trim());
}

function sanitizebr(texte) {
    // Supprimer les <br> au début (y compris ceux avec des espaces ou des lignes blanches)
    texte = texte.replace(/^(?:\s*<br>\s*)+/, '');

    // Supprimer les <br> à la fin (y compris ceux avec des espaces ou des lignes blanches)
    texte = texte.replace(/(?:\s*<br>\s*)+$/, '');
    return texte;
}



function replaceImageUrlsWithMarkdown(content) {
    // Expression régulière pour détecter les URLs d'images (jpg, png, gif, etc.)
    const imageUrlRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|bmp|svg))/gi;

    // Remplace les URLs d'images par le format Markdown
    return content.replace(imageUrlRegex, '![]($1)');
}

function displayMessage(message) {
    const messageList = document.getElementById('messageList');
    const messageElement = document.createElement('li');
    if (message.content.includes(`@${localStorage.getItem('username')}`)){
        messageElement.style = 'background-color: #e7b9111f !important';
    }
    if( containsSingleEmoji(message.content)) {
        message.content = "# " + message.content;
    }
    messageElement.classList.add('list-group-item', 'text-wrap', 'text-break','bg-dark', 'text-white');
    if(localStorage.getItem('username') == message.userNickname)
    {
        messageElement.innerHTML = `
      <div class="message-actions position-relative" id="${message.messageId}">
        <div class="content">
          <div class="message-info-container d-flex flex-row">
            <img class="avatar mr-3" src="../images/${message.userImage}" loading="lazy">
            <span class="message-info d-flex flex-row align-items-top">
              <p class="username mx-3">${message.userNickname}</p>
              <p class="timestamp ">${formatTimestamp(message.sentDate)}</p>
            </span>
          </div>
          <div class="message-content mt-2">
            ${sanitizebr(marked.parse(replaceImageUrlsWithMarkdown(escapeHtml(message.content))))}
          </div>
        </div>
        <div class="btn-group position-absolute top-0 end-0">
          <button class="btn-edit p-0" onclick="editMessage(${message.messageId})">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
              <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
            </svg>
          </button>
          <button class="btn-delete p-0" onclick="deleteMessage(${message.messageId})">
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
          <img class="avatar mr-3" src="../images/${message.userImage}" loading="lazy">
          <span class="message-info d-flex flex-row align-items-top">
            <p class="username mx-3">${message.userNickname}</p>
            <p class="timestamp ">${formatTimestamp(message.sentDate)}</p>
          </span>
        </div>
        <div class="message-content mt-3">
            ${sanitizebr(marked.parse(replaceImageUrlsWithMarkdown(escapeHtml(message.content))))}
        </div>
      </div>
    </div>
  `;
    }

    // Ajout du spinner sur les images
    messageElement.querySelectorAll(".message-actions .content .message-content img").forEach((img) => {
        // Créer un spinner et l'ajouter avant l'image
        const spinner = document.createElement('div');
        spinner.classList.add('spinner-border', 'text-primary','spinner');
        spinner.style.height = img.style.height;
        spinner.style.width = img.style.width;
        img.style.position = 'relative';  // pour positionner le spinner correctement
        img.parentNode.appendChild(spinner);
        img.style.display = 'none';

        // Supprimer le spinner lorsque l'image est chargée
        img.onload = () => {
            spinner.remove();
            img.style.display = 'block';
        };
        img.onerror = () => {
            spinner.remove();
            img.style.display = 'block';
        }
    });

    messageList.appendChild(messageElement);
    messageElement.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    HandleAnchor();
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