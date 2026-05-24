import { LEVELS } from '../game/levels.js';

const KEY = 'sweet-match.v1';
const SIZES = ['small', 'medium', 'large'];
const MODES = ['levels', 'free'];

const defaults = () => ({
  highScore: 0,
  streak: 0,
  lastPlayedDate: null,
  seenWelcome: false,
  settings: {
    sound: true,
    speech: false,
    contrast: false,
    size: 'medium',
    mode: 'levels',
    music: false,
    reduceMotion: false,
  },
  levelProgress: {
    currentLevel: 1,
    stars: {},
    bestScores: {},
    powerupBank: { hammer: 3, shuffle: 2, colorBomb: 1, plusMoves: 1 },
  },
});

function todayStamp(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function yesterdayStamp(d = new Date()) {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayStamp(y);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const s = parsed.settings || {};
    const lp = parsed.levelProgress || {};
    const starsRaw = lp.stars && typeof lp.stars === 'object' ? lp.stars : {};
    const stars = {};
    for (const [k, v] of Object.entries(starsRaw)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 1 && n <= 3) stars[k] = Math.floor(n);
    }
    return {
      highScore: Number(parsed.highScore) || 0,
      streak: Number(parsed.streak) || 0,
      lastPlayedDate: parsed.lastPlayedDate || null,
      seenWelcome: !!parsed.seenWelcome,
      settings: {
        sound: s.sound !== false,
        speech: !!s.speech,
        contrast: !!s.contrast,
        size: SIZES.includes(s.size) ? s.size : 'medium',
        mode: MODES.includes(s.mode) ? s.mode : 'levels',
        music: !!s.music,
        reduceMotion: !!s.reduceMotion,
      },
      levelProgress: {
        currentLevel: deriveCurrentLevel(lp.currentLevel, stars),
        stars,
        bestScores: sanitizeBestScores(lp.bestScores),
        powerupBank: sanitizePowerupBank(lp.powerupBank),
      },
    };
  } catch {
    return defaults();
  }
}

function sanitizeBestScores(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

const POWERUP_CAP = 9;
const POWERUP_DEFAULT_BANK = { hammer: 3, shuffle: 2, colorBomb: 1, plusMoves: 1 };
function sanitizePowerupBank(raw) {
  const out = { ...POWERUP_DEFAULT_BANK };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(out)) {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.min(POWERUP_CAP, Math.floor(n));
  }
  return out;
}

function deriveCurrentLevel(saved, stars) {
  const savedNum = Number(saved) || 1;
  const starredIds = Object.keys(stars)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1);
  const maxStarred = starredIds.length ? Math.max(...starredIds) : 0;
  const earned = Math.max(savedNum, maxStarred + 1, 1);
  return Math.min(LEVELS.length, earned);
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or private-mode; non-fatal.
  }
}

export function resetProgress(currentState) {
  const fresh = defaults();
  const kept = currentState && currentState.settings ? currentState.settings : fresh.settings;
  const merged = { ...fresh, settings: { ...fresh.settings, ...kept } };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
  return merged;
}

export function bumpStreakForToday(persisted) {
  const today = todayStamp();
  if (persisted.lastPlayedDate === today) return persisted;
  const next = { ...persisted };
  if (persisted.lastPlayedDate === yesterdayStamp()) {
    next.streak = (persisted.streak || 0) + 1;
  } else {
    next.streak = 1;
  }
  next.lastPlayedDate = today;
  return next;
}
