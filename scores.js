// Persistent scoreboard stored in a local JSON file.
const fs = require('fs');
const crypto = require('crypto');

const MODES = ['easy', 'hard'];
const MAX_NAME = 20;
const MAX_STORED = 100; // entries kept per mode

// Mythological and real animals, used as default team names.
const ANIMALS = [
  // mythological
  'Griffin', 'Phoenix', 'Dragon', 'Unicorn', 'Hydra', 'Pegasus', 'Minotaur', 'Kraken',
  'Cerberus', 'Chimera', 'Basilisk', 'Sphinx', 'Centaur', 'Kitsune', 'Yeti', 'Wyvern',
  'Manticore', 'Leviathan', 'Thunderbird', 'Jackalope', 'Fenrir', 'Cockatrice', 'Selkie',
  'Hippogriff', 'Sleipnir', 'Roc', 'Behemoth', 'Qilin', 'Chupacabra', 'Garuda',
  // real
  'Otter', 'Badger', 'Penguin', 'Narwhal', 'Platypus', 'Axolotl', 'Capybara', 'Lynx',
  'Falcon', 'Octopus', 'Pangolin', 'Wombat', 'Lemur', 'Mantis', 'Cobra', 'Panther',
  'Walrus', 'Koala', 'Raccoon', 'Hedgehog', 'Ibex', 'Heron', 'Gecko', 'Mongoose',
  'Moose', 'Flamingo', 'Chameleon', 'Armadillo', 'Albatross', 'Wolverine',
];

function randomAnimal(rng = Math.random) {
  return ANIMALS[Math.floor(rng() * ANIMALS.length)];
}

// Returns a clean name, or null if nothing usable is left.
function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/\s+/g, ' ') // tabs and newlines become spaces
    .replace(/[\u0000-\u001f\u007f]/g, '') // drop any other control character
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return name || null;
}

function isValidEntry(e) {
  return (
    e && typeof e.id === 'string' && typeof e.name === 'string' &&
    Number.isFinite(e.score) && Number.isFinite(e.date)
  );
}

class ScoreBoard {
  constructor(file, { rng = Math.random, now = Date.now } = {}) {
    this.file = file;
    this.rng = rng;
    this.now = now;
    this.scores = Object.fromEntries(MODES.map((m) => [m, []]));
    this.load();
  }

  load() {
    let text;
    try {
      text = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`Could not read ${this.file}: ${err.message}`);
      return;
    }
    try {
      const data = JSON.parse(text);
      for (const mode of MODES) {
        const list = Array.isArray(data.scores && data.scores[mode]) ? data.scores[mode] : [];
        this.scores[mode] = list.filter(isValidEntry);
        this.sort(mode);
      }
    } catch {
      // Keep the unreadable file instead of overwriting it on the next save.
      const backup = `${this.file}.corrupt-${this.now()}`;
      try {
        fs.renameSync(this.file, backup);
        console.warn(`Scores file was invalid JSON, moved to ${backup}`);
      } catch {}
    }
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, scores: this.scores }, null, 2));
    fs.renameSync(tmp, this.file); // atomic: never leaves a half-written file
  }

  sort(mode) {
    // Highest score first; on a tie, the earliest one ranks higher.
    this.scores[mode].sort((a, b) => b.score - a.score || a.date - b.date);
  }

  add(mode, score) {
    if (!MODES.includes(mode)) throw new Error(`Unknown mode: ${mode}`);
    const entry = {
      id: crypto.randomUUID(),
      name: randomAnimal(this.rng),
      score,
      date: this.now(),
    };
    this.scores[mode].push(entry);
    this.sort(mode);
    this.scores[mode].length = Math.min(this.scores[mode].length, MAX_STORED);
    this.save();
    return entry;
  }

  // Returns the updated entry, or null if the id or the name is not valid.
  rename(mode, id, raw) {
    const name = sanitizeName(raw);
    const entry = this.scores[mode] && this.scores[mode].find((e) => e.id === id);
    if (!name || !entry) return null;
    entry.name = name;
    this.save();
    return entry;
  }

  // 1-based rank of an entry, or 0 if it is not on the board.
  rank(mode, id) {
    return this.scores[mode].findIndex((e) => e.id === id) + 1;
  }

  top(mode, n = 10) {
    return this.scores[mode].slice(0, n).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  get(mode, id) {
    const rank = this.rank(mode, id);
    return rank ? { ...this.scores[mode][rank - 1], rank } : null;
  }
}

module.exports = { ScoreBoard, randomAnimal, sanitizeName, ANIMALS, MAX_NAME };
