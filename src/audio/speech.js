let enabled = false;

export function setSpeechEnabled(v) {
  enabled = !!v;
  if (!enabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechEnabled() {
  return enabled;
}

export function speak(text) {
  if (!enabled) return;
  if (!('speechSynthesis' in window)) return;
  if (!text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1.05;
    u.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // Speech may be unavailable on some platforms; ignore.
  }
}
