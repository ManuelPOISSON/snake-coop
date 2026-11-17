// Logique pure du jeu (aucune dépendance réseau) : facile à tester.
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const START_INTERVAL = 220; // ms entre deux déplacements
const MIN_INTERVAL = 70;
const SPEEDUP = 8; // ms gagnées par pomme

class Game {
  constructor(size = 24, rng = Math.random) {
    this.size = size;
    this.rng = rng;
    this.reset();
  }

  reset() {
    const mid = Math.floor(this.size / 2);
    this.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    this.dir = 'right'; // direction appliquée au dernier tick
    this.nextDir = 'right'; // direction demandée par les joueurs
    this.score = 0;
    this.status = 'waiting'; // waiting | playing | gameover
    this.apple = this.placeApple();
  }

  start() {
    if (this.status !== 'playing') {
      this.reset();
      this.status = 'playing';
    }
  }

  get interval() {
    return Math.max(MIN_INTERVAL, START_INTERVAL - this.score * SPEEDUP);
  }

  // Demande de direction ; le demi-tour est ignoré.
  setDirection(dir) {
    if (!DIRS[dir]) return false;
    if (dir === OPPOSITE[this.dir]) return false;
    this.nextDir = dir;
    return true;
  }

  placeApple() {
    const taken = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    const free = [];
    for (let x = 0; x < this.size; x++)
      for (let y = 0; y < this.size; y++)
        if (!taken.has(`${x},${y}`)) free.push({ x, y });
    if (free.length === 0) return null;
    return free[Math.floor(this.rng() * free.length)];
  }

  // Avance d'une case. Retourne 'move' | 'eat' | 'dead' | null (si pas en jeu).
  tick() {
    if (this.status !== 'playing') return null;
    this.dir = this.nextDir;
    const d = DIRS[this.dir];
    const head = this.snake[0];
    const nh = { x: head.x + d.x, y: head.y + d.y };

    if (nh.x < 0 || nh.y < 0 || nh.x >= this.size || nh.y >= this.size) {
      this.status = 'gameover';
      return 'dead';
    }
    const eating = this.apple && nh.x === this.apple.x && nh.y === this.apple.y;
    // La queue va se déplacer, sauf si on mange : on l'exclut de la collision.
    const body = eating ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === nh.x && s.y === nh.y)) {
      this.status = 'gameover';
      return 'dead';
    }

    this.snake.unshift(nh);
    if (eating) {
      this.score++;
      this.apple = this.placeApple();
      if (!this.apple) {
        this.status = 'gameover'; // grille pleine : victoire
        return 'eat';
      }
      return 'eat';
    }
    this.snake.pop();
    return 'move';
  }

  state() {
    return {
      size: this.size,
      snake: this.snake,
      apple: this.apple,
      score: this.score,
      status: this.status,
      dir: this.dir,
      interval: this.interval,
    };
  }
}

// Permutation aléatoire des directions : { up: 'left', down: 'up', ... }.
// Chaque direction a 1 chance sur 4 de rester la même.
function shuffleDirs(rng = Math.random) {
  const keys = Object.keys(DIRS);
  const vals = keys.slice();
  for (let i = vals.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }
  return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
}

module.exports = { Game, DIRS, OPPOSITE, shuffleDirs };
