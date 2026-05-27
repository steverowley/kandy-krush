import { render } from "preact";
import { App } from "./App";
import { registerAudioSubscribers } from "./subscribers/audio";
import { registerTelemetrySubscribers } from "./subscribers/telemetry";
import { useSettings } from "./state/settings";
import { resumeOnGesture } from "./audio/synth";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing from index.html");

function applyMotionPref(reduced: boolean) {
  document.documentElement.classList.toggle("reduced-motion", reduced);
}
applyMotionPref(useSettings.getState().reducedMotion);
useSettings.subscribe((s) => applyMotionPref(s.reducedMotion));

// First user gesture unlocks Web Audio (iOS Safari + locked Chrome
// require this). Listener self-removes after the first interaction.
function unlockAudio() {
  resumeOnGesture();
  window.removeEventListener("pointerdown", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
  window.removeEventListener("touchstart", unlockAudio);
}
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);
window.addEventListener("touchstart", unlockAudio, { passive: true });

render(<App />, root);
registerAudioSubscribers();
registerTelemetrySubscribers();
