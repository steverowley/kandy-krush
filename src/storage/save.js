import { LEVELS } from '../game/levels.js';

const KEY = 'sweet-match.v1';
const SAVE_VERSION = 1;
const SIZES = ['small', 'medium', 'large'];
const MODES = ['levels', 'free', 'roguelike'];

// Last-load status surfaced via `getLoadStatus()` so main.js / telemetry
// can toast "your save was corrupted, we backed it up and reset" instead
// of the previous silent-wipe behavior.
let lastLoadStatus = { ok: true, error: null, backedUpTo: null, versionFrom: null };

const defaults = () => ({
  version: SAVE_VERSION,
  highScore: 0,
  streak: 0,
  lastPlayedDate: null,
  seenWelcome: false,
  seenRoguelikeIntro: false,
  seenVersion: null,
  installPromptDismissedAt: 0,
  settings: {
    sound: true,
    speech: false,
    contrast: false,
    size: 'medium',
    mode: 'levels',
    music: false,
    reduceMotion: false,
    enemies: true,
  },
  levelProgress: {
    currentLevel: 1,
    stars: {},
    bestScores: {},
    powerupBank: { hammer: 3, shuffle: 2, colorBomb: 1, plusMoves: 1 },
  },
  roguelike: {
    currentSlot: 1,
    gems: 0,
    runsCompleted: 0,
    runsStarted: 0,
    bestSlot: 0,
    livesRemaining: 0,
    skills: {},             // permanent meta upgrades { id: true }
    currentClass: null,
  },
  // Whether the player has a roguelike run in progress + their upgrade
  // and relic pickups. Persisted so a reload doesn't reset the build.
  inRoguelikeRun: false,
  runUpgrades: [],
  runRelics: [],
  // 🌅 Daily-seed run tracking: YYYY-MM-DD stamp + the best slot the
  // player reached on that day's daily. Only the first attempt counts.
  dailySeedDate: null,
  dailySeedBestSlot: 0,
  // 📓 Last N completed runs (most recent first). Each entry:
  // { ts, outcome, slot, class, gems, score, daily, dailyStamp }
  runHistory: [],
  // 🔄 Banked free rerolls left in the current run (from Reroll Bank meta).
  runFreeRerolls: 0,
  // 🆙 Ascension state — highest unlocked + currently-selected level.
  ascensionUnlocked: 0,
  ascensionLevel: 0,
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

// Salvage a corrupt save by writing it under a dated backup key so the
// player (or support) has a chance to recover it. Returns the backup
// key on success, null if backup itself failed (e.g. quota exceeded).
function backupCorrupt(raw, reason) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `${KEY}.corrupt.${ts}`;
    localStorage.setItem(backupKey, JSON.stringify({ raw, reason, at: Date.now() }));
    return backupKey;
  } catch {
    return null;
  }
}

export function load() {
  lastLoadStatus = { ok: true, error: null, backedUpTo: null, versionFrom: null };
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch (err) {
    lastLoadStatus = { ok: false, error: `localStorage read failed: ${err && err.message || err}`, backedUpTo: null, versionFrom: null };
    return defaults();
  }
  if (!raw) return defaults();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const backupKey = backupCorrupt(raw, `JSON.parse failed: ${err && err.message || err}`);
    lastLoadStatus = {
      ok: false,
      error: `Save corrupted (JSON.parse): ${err && err.message || err}`,
      backedUpTo: backupKey,
      versionFrom: null,
    };
    return defaults();
  }
  if (!parsed || typeof parsed !== 'object') {
    const backupKey = backupCorrupt(raw, 'parsed value not an object');
    lastLoadStatus = {
      ok: false,
      error: 'Save corrupted (not an object)',
      backedUpTo: backupKey,
      versionFrom: null,
    };
    return defaults();
  }
  // Versioning: today there's only one version, so version mismatch is
  // informational. Once we ship a v2 schema this is where we'd dispatch
  // to a migrator chain (v1 → v2 → v3 …) before sanitizing.
  const fromVersion = typeof parsed.version === 'number' ? parsed.version : null;
  lastLoadStatus.versionFrom = fromVersion;
  try {
    const s = parsed.settings || {};
    const lp = parsed.levelProgress || {};
    const starsRaw = lp.stars && typeof lp.stars === 'object' ? lp.stars : {};
    const stars = {};
    for (const [k, v] of Object.entries(starsRaw)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 1 && n <= 3) stars[k] = Math.floor(n);
    }
    return {
      version: SAVE_VERSION,
      highScore: Number(parsed.highScore) || 0,
      streak: Number(parsed.streak) || 0,
      lastPlayedDate: parsed.lastPlayedDate || null,
      seenWelcome: !!parsed.seenWelcome,
      seenRoguelikeIntro: !!parsed.seenRoguelikeIntro,
      seenVersion: typeof parsed.seenVersion === 'string' ? parsed.seenVersion : null,
      installPromptDismissedAt: Number(parsed.installPromptDismissedAt) || 0,
      settings: {
        sound: s.sound !== false,
        speech: !!s.speech,
        contrast: !!s.contrast,
        size: SIZES.includes(s.size) ? s.size : 'medium',
        mode: MODES.includes(s.mode) ? s.mode : 'levels',
        music: !!s.music,
        reduceMotion: !!s.reduceMotion,
        // Default true — only false if the user explicitly turned them off.
        enemies: s.enemies !== false,
      },
      levelProgress: {
        currentLevel: deriveCurrentLevel(lp.currentLevel, stars),
        stars,
        bestScores: sanitizeBestScores(lp.bestScores),
        powerupBank: sanitizePowerupBank(lp.powerupBank),
      },
      roguelike: sanitizeRoguelike(parsed.roguelike),
      inRoguelikeRun: !!parsed.inRoguelikeRun,
      runUpgrades: sanitizeRunArray(parsed.runUpgrades),
      runRelics: sanitizeRunArray(parsed.runRelics),
      dailySeedDate: typeof parsed.dailySeedDate === 'string' && parsed.dailySeedDate.length <= 16
        ? parsed.dailySeedDate
        : null,
      dailySeedBestSlot: Math.min(100, Math.max(0, Math.floor(Number(parsed.dailySeedBestSlot) || 0))),
      runHistory: sanitizeRunHistory(parsed.runHistory),
      runFreeRerolls: Math.max(0, Math.min(20, Math.floor(Number(parsed.runFreeRerolls) || 0))),
      ascensionUnlocked: Math.max(0, Math.min(3, Math.floor(Number(parsed.ascensionUnlocked) || 0))),
      ascensionLevel: Math.max(0, Math.min(3, Math.floor(Number(parsed.ascensionLevel) || 0))),
    };
  } catch (err) {
    // A sanitizer threw — partial corruption. Back up and return defaults.
    const backupKey = backupCorrupt(raw, `sanitizer threw: ${err && err.message || err}`);
    lastLoadStatus = {
      ok: false,
      error: `Save corrupted (sanitizer): ${err && err.message || err}`,
      backedUpTo: backupKey,
      versionFrom: fromVersion,
    };
    return defaults();
  }
}

export function getLoadStatus() {
  return { ...lastLoadStatus };
}

// Sanitize an array of identifier strings (upgrade ids or relic ids).
// Trim length to a reasonable cap so storage can't be poisoned with
// huge arrays. Each entry must be a short ASCII-ish slug.
function sanitizeRunArray(raw, max = 200) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    if (v.length > 64) continue;
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeRunHistory(raw, max = 20) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const entry = {
      ts: Number(v.ts) || 0,
      outcome: v.outcome === 'complete' ? 'complete' : 'fail',
      slot: Math.max(0, Math.min(100, Math.floor(Number(v.slot) || 0))),
      class: typeof v.class === 'string' && v.class.length <= 32 ? v.class : null,
      gems: Math.max(0, Math.floor(Number(v.gems) || 0)),
      score: Math.max(0, Math.floor(Number(v.score) || 0)),
      daily: !!v.daily,
      dailyStamp: typeof v.dailyStamp === 'string' && v.dailyStamp.length <= 16 ? v.dailyStamp : null,
    };
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
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

const ROGUELIKE_DEFAULTS = {
  currentSlot: 1,
  gems: 0,
  runsCompleted: 0,
  runsStarted: 0,
  bestSlot: 0,
  livesRemaining: 0, // refreshed by startRoguelikeRun
  bossesDefeated: 0,
};

function sanitizeRoguelike(raw) {
  const out = { ...ROGUELIKE_DEFAULTS, skills: {}, currentClass: null, classStats: {} };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(ROGUELIKE_DEFAULTS)) {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.floor(n);
  }
  if (out.currentSlot < 1) out.currentSlot = 1;
  if (out.currentSlot > 100) out.currentSlot = 100;
  // classStats: { classId: { runs, completes, bestSlot } }
  if (raw.classStats && typeof raw.classStats === 'object') {
    for (const [k, v] of Object.entries(raw.classStats)) {
      if (typeof k !== 'string' || k.length > 32 || !v || typeof v !== 'object') continue;
      out.classStats[k] = {
        runs: Math.max(0, Math.floor(Number(v.runs) || 0)),
        completes: Math.max(0, Math.floor(Number(v.completes) || 0)),
        bestSlot: Math.max(0, Math.min(100, Math.floor(Number(v.bestSlot) || 0))),
      };
    }
  }
  if (raw.skills && typeof raw.skills === 'object') {
    out.skills = {};
    for (const [k, v] of Object.entries(raw.skills)) {
      if (v) out.skills[k] = true;
    }
  }
  if (typeof raw.currentClass === 'string' && raw.currentClass.length < 32) {
    out.currentClass = raw.currentClass;
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

let lastSaveStatus = { ok: true, error: null };

export function save(state) {
  try {
    const payload = { version: SAVE_VERSION, ...state };
    localStorage.setItem(KEY, JSON.stringify(payload));
    lastSaveStatus = { ok: true, error: null };
  } catch (err) {
    // QuotaExceededError, SecurityError (Safari private mode), etc.
    lastSaveStatus = { ok: false, error: err && err.message || String(err) };
  }
}

export function getSaveStatus() {
  return { ...lastSaveStatus };
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
