const assert = require('assert');
const { Game } = require('./game');

// déplacement simple
let g = new Game(10, () => 0);
g.start();
const x0 = g.snake[0].x;
assert.strictEqual(g.tick(), 'move');
assert.strictEqual(g.snake[0].x, x0 + 1);
assert.strictEqual(g.snake.length, 3);

// demi-tour ignoré
g = new Game(10, () => 0);
g.start();
assert.strictEqual(g.setDirection('left'), false);
assert.strictEqual(g.setDirection('up'), true);

// manger fait grandir et augmente le score
g = new Game(10, () => 0);
g.start();
g.apple = { x: g.snake[0].x + 1, y: g.snake[0].y };
assert.strictEqual(g.tick(), 'eat');
assert.strictEqual(g.snake.length, 4);
assert.strictEqual(g.score, 1);
assert.ok(g.interval < 220);

// mur
g = new Game(10, () => 0);
g.start();
let r;
for (let i = 0; i < 20 && r !== 'dead'; i++) r = g.tick();
assert.strictEqual(r, 'dead');
assert.strictEqual(g.status, 'gameover');

// morsure de la queue
g = new Game(10, () => 0);
g.start();
g.snake = [
  { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 },
  { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 },
];
g.dir = g.nextDir = 'left';
g.apple = { x: 0, y: 0 };
g.setDirection('down'); // (5,5)->(5,6) : corps
assert.strictEqual(g.tick(), 'dead');

// pas de pomme sur le serpent
g = new Game(10, () => 0.5);
for (let i = 0; i < 50; i++) {
  const a = g.placeApple();
  assert.ok(!g.snake.some((s) => s.x === a.x && s.y === a.y));
}

// mélange des directions : toujours une permutation, et parfois identique
const { shuffleDirs } = require('./game');
let same = 0;
for (let i = 0; i < 2000; i++) {
  const m = shuffleDirs();
  assert.deepStrictEqual(Object.values(m).sort(), ['down', 'left', 'right', 'up']);
  if (m.up === 'up') same++;
}
assert.ok(same > 350 && same < 650, 'environ 1 chance sur 4 de garder sa direction : ' + same);

console.log('OK : tous les tests passent');
