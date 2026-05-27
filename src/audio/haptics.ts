/**
 * Tiny wrapper around the Vibration API. iOS Safari ignores vibrate()
 * but Android Chrome + Firefox honor it. All calls are no-ops when the
 * API is missing or haptics are disabled in settings.
 */

let _enabled = true;

export function setEnabled(on: boolean) {
  _enabled = on;
}

function canVibrate(): boolean {
  return _enabled && typeof navigator !== "undefined" && !!navigator.vibrate;
}

export function tap() {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(8);
  } catch {
    /* ignore */
  }
}

export function bump() {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(18);
  } catch {
    /* ignore */
  }
}

export function reject() {
  if (!canVibrate()) return;
  try {
    navigator.vibrate([14, 30, 14]);
  } catch {
    /* ignore */
  }
}

export function win() {
  if (!canVibrate()) return;
  try {
    navigator.vibrate([20, 40, 20, 40, 40]);
  } catch {
    /* ignore */
  }
}

export function loss() {
  if (!canVibrate()) return;
  try {
    navigator.vibrate([40, 60, 80]);
  } catch {
    /* ignore */
  }
}
