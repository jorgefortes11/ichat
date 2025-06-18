const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Servidor HTTP e WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Armazenamento em memória
const messages = [];
const clients = new Map();

// Conexões WebSocket
wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'message') {
        const newMessage = {
          id: Date.now(),
          sender: data.sender || 'Anônimo',
          content: data.content,
          timestamp: new Date().toISOString()
        };
        
        messages.push(newMessage);
        
        // Broadcast para todos os clientes
        broadcast({
          type: 'new_message',
          data: newMessage
        });
      }
      else if (data.type === 'user_join') {
        // Armazenar o usuário associado a esta conexão
        clients.set(ws, data.username);
        
        // Notificar entrada do usuário
        broadcast({
          type: 'notification',
          data: {
            content: `${data.username} entrou na conversa`,
            timestamp: new Date().toISOString()
          }
        });
        
        // Enviar histórico apenas para este cliente
        ws.send(JSON.stringify({ 
          type: 'history', 
          data: messages 
        }));
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });

  ws.on('close', () => {
    const username = clients.get(ws);
    if (username) {
      // Notificar saída do usuário
      broadcast({
        type: 'notification',
        data: {
          content: `${username} saiu da conversa`,
          timestamp: new Date().toISOString()
        }
      });
    }
    clients.delete(ws);
    console.log('Cliente desconectado');
  });
});

// Função para broadcast para todos os clientes
function broadcast(message) {
  clients.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Rota para upload de arquivos
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum arquivo enviado');

  const fileInfo = {
    id: Date.now(),
    name: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
    sender: req.body.sender || 'Anônimo',
    timestamp: new Date().toISOString()
  };

  // Notificar todos os clientes
  broadcast({
    type: 'new_file',
    data: fileInfo
  });

  res.json(fileInfo);
});

// Servir arquivos estáticos
app.use('/uploads', express.static('uploads'));
app.use(express.static('client'));

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iChat rodando em http://localhost:${PORT}`);
});