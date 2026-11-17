const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const { Game, shuffleDirs } = require('./game');
const { ScoreBoard } = require('./scores');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const SLOTS = ['up', 'down', 'left', 'right']; // bleu, rouge, jaune, vert
const RESTART_COOLDOWN = 1500; // ms avant qu'un joueur puisse relancer après un game over

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// Adresse IP locale (Wi-Fi / Ethernet) pour le QR code.
function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}
const BASE_URL = process.env.PUBLIC_URL || `http://${lanIp()}:${PORT}`;

const routes = { '/': '/display.html', '/play': '/controller.html' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/info') {
    const playUrl = `${BASE_URL}/play`;
    const qr = await QRCode.toString(playUrl, { type: 'svg', margin: 1 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ playUrl, qr }));
  }
  const rel = routes[url.pathname] || url.pathname;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- Jeu ----
const game = new Game(24);
const wss = new WebSocketServer({ server });
let players = {}; // direction -> ws
let mode = 'easy'; // 'easy' | 'hard' (hard : directions remélangées à chaque clic)
let loop = null;
let gameoverAt = 0;
const board = new ScoreBoard(process.env.SCORES_FILE || path.join(__dirname, 'scores.json'));
let current = null; // { id, mode } of the score just recorded, renamable until the next game

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
}
function snapshot() {
  const taken = {};
  for (const s of SLOTS) taken[s] = !!players[s];
  return { type: 'state', ...game.state(), players: taken, mode, board: boardView() };
}

// Scoreboard shown after a game over (null the rest of the time).
function boardView() {
  if (game.status !== 'gameover') return null;
  const boardMode = current ? current.mode : mode;
  return {
    mode: boardMode,
    top: board.top(boardMode, 10),
    current: current ? board.get(current.mode, current.id) : null,
  };
}

// Records the finished game; scores of 0 are not recorded.
function recordScore() {
  current = null;
  if (game.score <= 0) return;
  try {
    const entry = board.add(mode, game.score);
    current = { id: entry.id, mode };
  } catch (err) {
    console.error(`Could not save the score: ${err.message}`);
  }
}

// Mode difficile : redistribue aléatoirement les 4 directions entre les joueurs.
function reshuffle() {
  const map = shuffleDirs();
  const next = {};
  for (const s of SLOTS) {
    const ws = players[s];
    if (!ws) continue;
    ws.slot = map[s];
    next[map[s]] = ws;
    send(ws, { type: 'assigned', dir: ws.slot });
  }
  players = next;
}
function pushState() {
  broadcast(snapshot());
}
function event(name) {
  broadcast({ type: 'event', name });
}

function scheduleTick() {
  clearTimeout(loop);
  loop = setTimeout(() => {
    const r = game.tick();
    if (r === 'eat') event('eat');
    if (game.status === 'gameover') {
      gameoverAt = Date.now();
      recordScore();
      if (r === 'dead') event('dead');
    }
    pushState();
    if (game.status === 'playing') scheduleTick();
  }, game.interval);
}

function startGame() {
  if (game.status === 'playing') return;
  if (game.status === 'gameover' && Date.now() - gameoverAt < RESTART_COOLDOWN) return;
  current = null; // the previous game's name can no longer be changed
  game.start();
  event('start');
  pushState();
  scheduleTick();
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.slot = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'hello') {
      if (ws.role) return;
      if (msg.role === 'display') {
        ws.role = 'display';
        send(ws, snapshot());
      } else if (msg.role === 'controller') {
        ws.role = 'controller';
        const slot = SLOTS.find((s) => !players[s]);
        if (slot) {
          players[slot] = ws;
          ws.slot = slot;
          send(ws, { type: 'assigned', dir: slot });
        } else {
          send(ws, { type: 'spectator' });
        }
        pushState();
      }
      return;
    }

    if (msg.type === 'start' && ws.role === 'display') return startGame();

    if (msg.type === 'mode' && ws.role === 'display') {
      if ((msg.mode === 'easy' || msg.mode === 'hard') && game.status !== 'playing') {
        mode = msg.mode;
        pushState();
      }
      return;
    }

    if (msg.type === 'rename') {
      // Any connected display or phone may rename the score of the game that just ended.
      if (ws.role && game.status === 'gameover' && current) {
        if (board.rename(current.mode, current.id, msg.name)) pushState();
      }
      return;
    }

    if (msg.type === 'press' && ws.slot) {
      if (game.status === 'playing') {
        game.setDirection(ws.slot); // la direction du clic est celle de la couleur affichée
        if (mode === 'hard') {
          reshuffle(); // puis tout le monde reçoit une nouvelle direction
          pushState();
        }
      } else startGame(); // un clic lance / relance la partie
    }
  });

  ws.on('close', () => {
    if (ws.slot && players[ws.slot] === ws) {
      delete players[ws.slot];
      pushState();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Snake multijoueur démarré');
  console.log(`  Écran principal : http://localhost:${PORT}/`);
  console.log(`  Joueurs (QR)    : ${BASE_URL}/play`);
});
