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

// dealing directions between 2, 3 or 4 players
{
  const { dealDirections } = require('./game');
  const ALL = ['down', 'left', 'right', 'up'];
  const sizes = (deal) => deal.map((d) => d.length).sort();

  assert.deepStrictEqual(dealDirections(4, { shuffle: false }), [['up'], ['down'], ['left'], ['right']]);
  assert.throws(() => dealDirections(1));
  assert.throws(() => dealDirections(5));

  const doubleSeats = new Set();
  const firstDirOfSeat0 = new Set();
  for (let i = 0; i < 2000; i++) {
    for (const n of [2, 3, 4]) {
      const deal = dealDirections(n);
      assert.strictEqual(deal.length, n);
      // every direction is given to exactly one seat
      assert.deepStrictEqual(deal.flat().sort(), ALL);
      if (n === 2) assert.deepStrictEqual(sizes(deal), [2, 2]);
      if (n === 3) {
        assert.deepStrictEqual(sizes(deal), [1, 1, 2]);
        doubleSeats.add(deal.findIndex((d) => d.length === 2));
      }
      if (n === 4) assert.deepStrictEqual(sizes(deal), [1, 1, 1, 1]);
      if (n === 4) firstDirOfSeat0.add(deal[0][0]);
    }
  }
  assert.strictEqual(doubleSeats.size, 3, 'any of the 3 players can be the one with 2 directions');
  assert.strictEqual(firstDirOfSeat0.size, 4, 'shuffling changes who gets which direction');
}

// scoreboard: persistence, ranking, renaming
{
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { ScoreBoard, sanitizeName, ANIMALS, MAX_NAME } = require('./scores');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snake-scores-'));
  const file = path.join(dir, 'scores.json');
  let t = 1000;
  const opts = { now: () => t++ };

  let b = new ScoreBoard(file, opts); // missing file -> empty board
  assert.deepStrictEqual(b.top('easy'), []);

  const a = b.add('easy', 5);
  const c = b.add('easy', 9);
  const d = b.add('easy', 5); // tie with `a`, later -> ranks below
  b.add('hard', 3);
  assert.ok(ANIMALS.includes(a.name));
  assert.deepStrictEqual(b.top('easy').map((e) => e.score), [9, 5, 5]);
  assert.strictEqual(b.rank('easy', c.id), 1);
  assert.strictEqual(b.rank('easy', a.id), 2);
  assert.strictEqual(b.rank('easy', d.id), 3);
  assert.strictEqual(b.top('hard').length, 1); // separate boards

  // renaming: sanitized, persisted, rejects bad input
  assert.ok(b.rename('easy', a.id, '  Bob   the\tgreat  '));
  assert.strictEqual(b.get('easy', a.id).name, 'Bob the great');
  assert.strictEqual(b.rename('easy', a.id, '   '), null);
  assert.strictEqual(b.rename('easy', a.id, 42), null);
  assert.strictEqual(b.rename('easy', 'nope', 'X'), null);
  assert.strictEqual(sanitizeName('x'.repeat(100)).length, MAX_NAME);
  assert.strictEqual(sanitizeName('a\u0000b\nc'), 'ab c');
  assert.strictEqual(sanitizeName('<b>hi</b>'), '<b>hi</b>'); // stored as-is, UI uses textContent

  // restart: a new instance reads the same file
  b = new ScoreBoard(file, opts);
  assert.deepStrictEqual(b.top('easy').map((e) => e.score), [9, 5, 5]);
  assert.strictEqual(b.get('easy', a.id).name, 'Bob the great');
  assert.strictEqual(b.top('hard').length, 1);

  // only the best 100 are kept per mode
  for (let i = 0; i < 120; i++) b.add('hard', i);
  assert.strictEqual(b.scores.hard.length, 100);

  // corrupt file: not overwritten, moved aside
  fs.writeFileSync(file, '{not json');
  b = new ScoreBoard(file, opts);
  assert.deepStrictEqual(b.top('easy'), []);
  assert.ok(fs.readdirSync(dir).some((f) => f.includes('.corrupt-')));
  fs.rmSync(dir, { recursive: true });
}

console.log('OK : tous les tests passent');
