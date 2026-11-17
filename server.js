const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const { Game, PLAYER_COUNTS, dealDirections } = require('./game');
const { ScoreBoard } = require('./scores');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DIRECTIONS = ['up', 'down', 'left', 'right']; // blue, red, yellow, green
const RESTART_COOLDOWN = 1500; // ms before a game can be restarted after a game over

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// Local network address (Wi-Fi / Ethernet), used for the QR code.
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

// ---- Game ----
const game = new Game(24);
const wss = new WebSocketServer({ server });
let mode = 'easy'; // 'easy' | 'hard' (hard: directions are reshuffled on every tap)
let playerCount = 4; // 2 | 3 | 4: how many phones share the 4 directions
let seats = new Array(playerCount).fill(null); // seat index -> controller socket
let layout = deal(); // seat index -> directions that seat controls
let joinCounter = 0;
let loop = null;
let gameoverAt = 0;
const board = new ScoreBoard(process.env.SCORES_FILE || path.join(__dirname, 'scores.json'));
let current = null; // { id, mode } of the score just recorded, renamable until the next game

// With 4 players in easy mode directions stay in a fixed order; otherwise they are dealt at random.
function deal() {
  return dealDirections(playerCount, { shuffle: playerCount < 4 || mode === 'hard' });
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
}

function controllers() {
  return [...wss.clients]
    .filter((c) => c.role === 'controller' && c.readyState === 1)
    .sort((a, b) => a.joinId - b.joinId);
}

// Tells each phone which directions it controls (or that it is a spectator).
// Only sends when something changed, unless `force` is set (hard mode reshuffle).
function notifyControllers(force = false) {
  for (const c of controllers()) {
    c.dirs = c.seat === null ? [] : layout[c.seat];
    const key = c.seat === null ? 'spectator' : c.dirs.join();
    if (!force && c.sentKey === key) continue;
    c.sentKey = key;
    send(c, c.seat === null ? { type: 'spectator' } : { type: 'assigned', dirs: c.dirs });
  }
}

// Gives each phone a seat: keeps current seats when possible, then fills free seats in join order.
// Extra phones become spectators and are promoted when a seat frees up.
function fillSeats() {
  const list = controllers();
  seats = new Array(playerCount).fill(null);
  for (const c of list) {
    if (c.seat !== null && c.seat < playerCount && !seats[c.seat]) seats[c.seat] = c;
    else c.seat = null;
  }
  for (const c of list) {
    if (c.seat !== null) continue;
    const free = seats.indexOf(null);
    if (free === -1) break;
    seats[free] = c;
    c.seat = free;
  }
  notifyControllers();
}

function snapshot() {
  const taken = Object.fromEntries(DIRECTIONS.map((d) => [d, false]));
  seats.forEach((ws, i) => {
    if (ws) for (const d of layout[i]) taken[d] = true;
  });
  return { type: 'state', ...game.state(), players: taken, playerCount, mode, board: boardView() };
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
  layout = deal(); // new random split of the directions for every game
  notifyControllers(true);
  game.start();
  event('start');
  pushState();
  scheduleTick();
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.seat = null;
  ws.dirs = [];
  ws.sentKey = null;

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
        ws.joinId = ++joinCounter;
        fillSeats();
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

    if (msg.type === 'players' && ws.role === 'display') {
      if (PLAYER_COUNTS.includes(msg.count) && game.status !== 'playing') {
        playerCount = msg.count;
        layout = deal();
        fillSeats();
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

    if (msg.type === 'press' && ws.role === 'controller' && ws.seat !== null) {
      if (game.status === 'playing') {
        if (!ws.dirs.includes(msg.dir)) return; // a phone can only use its own directions
        game.setDirection(msg.dir);
        if (mode === 'hard') {
          layout = deal(); // then every direction (and who has 2 of them) is reshuffled
          notifyControllers(true);
          pushState();
        }
      } else startGame(); // a tap starts / restarts the game
    }
  });

  ws.on('close', () => {
    if (ws.role === 'controller') {
      fillSeats(); // frees the seat, promotes a spectator if any
      pushState();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Cooperative Snake server started');
  console.log(`  Main display : http://localhost:${PORT}/`);
  console.log(`  Players (QR) : ${BASE_URL}/play`);
});
