import { render } from "preact";
import { App } from "./App";
import { registerAudioSubscribers } from "./subscribers/audio";
import { registerTelemetrySubscribers } from "./subscribers/telemetry";
import { useSettings } from "./state/settings";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing from index.html");

// Mirror Settings.reducedMotion into a body class so global CSS can
// honor it alongside the OS preference.
function applyMotionPref(reduced: boolean) {
  document.documentElement.classList.toggle("reduced-motion", reduced);
}
applyMotionPref(useSettings.getState().reducedMotion);
useSettings.subscribe((s) => applyMotionPref(s.reducedMotion));

render(<App />, root);
registerAudioSubscribers();
registerTelemetrySubscribers();
