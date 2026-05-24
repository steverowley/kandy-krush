const KEY = 'sweet-match.v1';
const SIZES = ['small', 'medium', 'large'];

const defaults = () => ({
  highScore: 0,
  settings: {
    sound: true,
    contrast: false,
    size: 'medium',
  },
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const s = parsed.settings || {};
    return {
      highScore: Number(parsed.highScore) || 0,
      settings: {
        sound: s.sound !== false,
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
