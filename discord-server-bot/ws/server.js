const WebSocket = require('ws');
const util = require('util');

let wss;

function init(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');
    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });
    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });

  // Override console methods to broadcast logs
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    const message = util.format(...args);
    originalLog.apply(console, args);
    broadcastLog(message, 'log');
  };

  console.error = (...args) => {
    const message = util.format(...args);
    originalError.apply(console, args);
    broadcastLog(message, 'error');
  };

  console.warn = (...args) => {
    const message = util.format(...args);
    originalWarn.apply(console, args);
    broadcastLog(message, 'warn');
  };
}

function broadcastLog(data, type = 'log') {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastGuildUpdate(guildId, guildData) {
  if (!wss) return;
  const message = JSON.stringify({ type: 'guildUpdate', guildId, guildData });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastNewMessage(messageData) {
  if (!wss) return;
  const message = JSON.stringify({ type: 'NEW_MESSAGE', data: messageData });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastCiCdLog(data) {
  if (!wss) return;
  const message = JSON.stringify({ type: 'CI_CD_LOG', data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = {
  init,
  broadcastLog,
  broadcastGuildUpdate,
  broadcastNewMessage,
  broadcastCiCdLog,
};
