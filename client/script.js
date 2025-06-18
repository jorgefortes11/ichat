let socket;
let currentUser = 'Anônimo';

// Elementos do DOM
const loginModal = document.getElementById('loginModal');
const chatContainer = document.querySelector('.chat-container');
const usernameInput = document.getElementById('usernameInput');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const chat = document.getElementById('chat');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const fileForm = document.getElementById('fileForm');
const fileInput = document.getElementById('fileInput');
const userStatus = document.getElementById('userStatus');
const appContainer = document.querySelector('.app-container');

// Aplicacao desfoque inicial
appContainer.classList.add('blur-background');

// Login
loginButton.addEventListener('click', handleLogin);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

// Logout
logoutButton.addEventListener('click', handleLogout);

function handleLogin() {
  const username = usernameInput.value.trim();
  if (username) {
    currentUser = username;
    loginModal.style.display = 'none';
    appContainer.classList.remove('blur-background');
    chatContainer.style.display = 'flex';
    logoutButton.style.display = 'block';
    userStatus.textContent = currentUser;
    connectWebSocket();
    messageInput.focus();
  }
}

function handleLogout() {
  if (confirm('Tem certeza que deseja sair do chat?')) {
    if (socket) {
      socket.close();
    }
    
    // Limpar chat
    chat.innerHTML = '';
    
    // Resetar interface
    currentUser = 'Anônimo';
    chatContainer.style.display = 'none';
    logoutButton.style.display = 'none';
    userStatus.textContent = '';
    usernameInput.value = '';
    appContainer.classList.add('blur-background');
    loginModal.style.display = 'flex';
    usernameInput.focus();
  }
}

// Conexão WebSocket
function connectWebSocket() {

const wsUrl = window.location.host.includes('onrender.com') 
  ? `wss://${window.location.host}`  // Para deploy no Render
  : `ws://${window.location.hostname}:3000`; // Para localhost
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('Conectado ao servidor iChat');
    updateStatus('online');
    
    // Notificar servidor sobre o novo usuário
    socket.send(JSON.stringify({
      type: 'user_join',
      username: currentUser
    }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'history') {
      data.data.forEach(msg => addMessageToChat(msg));
    } 
    else if (data.type === 'new_message') {
      addMessageToChat(data.data);
    }
    else if (data.type === 'new_file') {
      addFileToChat(data.data);
    }
    else if (data.type === 'notification') {
      addNotificationToChat(data.data);
    }
  };

  socket.onclose = () => {
    console.log('Desconectado do servidor');
    updateStatus('offline');
    setTimeout(connectWebSocket, 5000);
  };

  socket.onerror = (error) => {
    console.error('Erro na conexão:', error);
    updateStatus('error');
  };
}

function updateStatus(status) {
  const statusMap = {
    online: '🟢 Online',
    offline: '🔴 Offline - Reconectando...',
    error: '⚠️ Erro de conexão'
  };
  userStatus.textContent = `${currentUser} • ${statusMap[status]}`;
}

// Enviar mensagem
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  
  if (message && socket) {
    socket.send(JSON.stringify({
      type: 'message',
      sender: currentUser,
      content: message
    }));
    messageInput.value = '';
  }
});

// Enviar arquivo
fileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sender', currentUser);
    
    fetch('/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      console.log('Arquivo enviado:', data);
      fileInput.value = '';
    })
    .catch(error => {
      console.error('Erro ao enviar arquivo:', error);
    });
  }
});

// Adicionar mensagem ao chat
function addMessageToChat(message) {
  const messageDiv = document.createElement('div');
  const isCurrentUserMessage = message.sender === currentUser;
  
  messageDiv.className = `message ${isCurrentUserMessage ? 'sent' : 'received'}`;
  
  messageDiv.innerHTML = `
    ${!isCurrentUserMessage ? `<div class="message-sender">${message.sender}</div>` : ''}
    <div class="message-content">${message.content}</div>
    <div class="message-time">${formatTime(message.timestamp)}</div>
  `;
  
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;
}

// Adicionar arquivo ao chat
function addFileToChat(file) {
  const fileDiv = document.createElement('div');
  const isCurrentUserFile = file.sender === currentUser;
  
  fileDiv.className = `message ${isCurrentUserFile ? 'sent' : 'received'}`;
  
  fileDiv.innerHTML = `
    ${!isCurrentUserFile ? `<div class="message-sender">${file.sender}</div>` : ''}
    <div class="file-message">
      <svg class="file-icon" viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/>
      </svg>
      <a href="${file.url}" class="file-link" target="_blank">${file.name}</a>
      <span class="file-size">${formatFileSize(file.size)}</span>
    </div>
    <div class="message-time">${formatTime(file.timestamp)}</div>
  `;
  
  chat.appendChild(fileDiv);
  chat.scrollTop = chat.scrollHeight;
}

// Adicionar notificação ao chat
function addNotificationToChat(notification) {
  const notificationDiv = document.createElement('div');
  notificationDiv.className = 'notification';
  notificationDiv.innerHTML = `
    <span>${notification.content}</span>
    <span class="message-time">${formatTime(notification.timestamp)}</span>
  `;
  
  chat.appendChild(notificationDiv);
  chat.scrollTop = chat.scrollHeight;
}

// Funções auxiliares
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}