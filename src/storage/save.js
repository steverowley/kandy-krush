const KEY = 'sweet-match.v1';
const SIZES = ['small', 'medium', 'large'];

const defaults = () => ({
  highScore: 0,
  streak: 0,
  lastPlayedDate: null,
  settings: {
    sound: true,
    speech: false,
    contrast: false,
    size: 'medium',
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
    return {
      highScore: Number(parsed.highScore) || 0,
      streak: Number(parsed.streak) || 0,
      lastPlayedDate: parsed.lastPlayedDate || null,
      settings: {
        sound: s.sound !== false,
        speech: !!s.speech,
        contrast: !!s.contrast,
        size: SIZES.includes(s.size) ? s.size : 'medium',
      },
    };
  } catch {
    return defaults();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or private-mode; non-fatal.
  }
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
