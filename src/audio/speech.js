let enabled = false;
// Queue of pending utterance texts so rapid speak() calls don't truncate
// each other. Browser's native speechSynthesis queue works, but we add our
// own cap so a runaway cascade can't pile up dozens of stale callouts.
const queue = [];
const MAX_QUEUE = 4;
let active = false;

function hasSynth() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pump() {
  if (!enabled || !hasSynth()) { queue.length = 0; active = false; return; }
  if (active) return;
  const text = queue.shift();
  if (!text) { active = false; return; }
  active = true;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1.05;
    u.volume = 0.9;
    u.onend = () => { active = false; pump(); };
    u.onerror = () => { active = false; pump(); };
    window.speechSynthesis.speak(u);
  } catch {
    active = false;
  }
}

export function setSpeechEnabled(v) {
  enabled = !!v;
  if (!enabled && hasSynth()) {
    window.speechSynthesis.cancel();
    queue.length = 0;
    active = false;
  }
}

export function isSpeechEnabled() {
  return enabled;
}

export function speak(text) {
  if (!enabled) return;
  if (!hasSynth()) return;
  if (!text) return;
  // Cap the queue so we don't pile up stale callouts during long cascades.
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(String(text));
  pump();
}

// Flush pending speech (e.g., on game-over or mode-switch transitions).
export function flushSpeech() {
  queue.length = 0;
  active = false;
  if (hasSynth()) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
}
