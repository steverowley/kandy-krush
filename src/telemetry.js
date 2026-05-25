// Telemetry + crash tracking shim.
//
// Provider-agnostic event sink. Today it has two providers:
//   - 'console' (dev): logs every event to console.debug.
//   - 'beacon'  (prod): POSTs via navigator.sendBeacon to a configured
//                       endpoint. Non-blocking, fire-and-forget.
//
// Why this shape:
//   - The product is going to a paid acquisition channel eventually
//     and we cannot tune retention / funnel without event data.
//   - Picking the actual analytics vendor (PostHog, Plausible, Mixpanel,
//     self-hosted) is a product decision the owner hasn't made yet.
//   - Sprinkling `track()` calls into the codebase NOW means the day a
//     provider is picked we just swap the provider string — no second
//     pass through every event-emitting site.
//
// Privacy: no PII. The session id is a random opaque string, persisted
// in sessionStorage only (resets per tab). The persistent device id is
// an opaque uuid in localStorage, regenerable by the player via reset.
// All events go to a single endpoint over HTTPS — no third-party SDK
// at the moment, so no fingerprinting beyond what the player sees.

const STORAGE_DEVICE_KEY = 'sweet-match.telemetry.device';
const SESSION_BUFFER_KEY = 'sweet-match.telemetry.buffer';
const MAX_BUFFER_EVENTS = 50;

let config = {
  provider: 'console',  // 'console' | 'beacon' | 'noop'
  endpoint: null,       // required when provider === 'beacon'
  appVersion: 'unknown',
  sessionId: null,
  deviceId: null,
};

let userProps = {};
// Ring buffer of last N events — flushed alongside crash reports so
// we can see what the player did right before the error.
let buffer = [];

function uuid() {
  // crypto.randomUUID is on every modern browser the game targets; the
  // fallback is just so we never throw if somehow it's missing.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.random() * 16 | 0;
    const v = ch === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function loadDeviceId() {
  try {
    let id = localStorage.getItem(STORAGE_DEVICE_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(STORAGE_DEVICE_KEY, id);
    }
    return id;
  } catch {
    // private mode / storage disabled — telemetry still works, just
    // without a stable device id across reloads.
    return uuid();
  }
}

function loadSessionId() {
  try {
    let id = sessionStorage.getItem('sweet-match.telemetry.session');
    if (!id) {
      id = uuid();
      sessionStorage.setItem('sweet-match.telemetry.session', id);
    }
    return id;
  } catch {
    return uuid();
  }
}

function restoreBuffer() {
  try {
    const raw = sessionStorage.getItem(SESSION_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_BUFFER_EVENTS) : [];
  } catch {
    return [];
  }
}

function flushBuffer() {
  try {
    sessionStorage.setItem(SESSION_BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    // sessionStorage quota — drop the buffer write, events are best-effort.
  }
}

function shipEvent(event) {
  if (config.provider === 'noop') return;
  if (config.provider === 'console') {
    // eslint-disable-next-line no-console
    console.debug('[tlm]', event.name, event);
    return;
  }
  if (config.provider === 'beacon') {
    if (!config.endpoint) return;
    try {
      const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
      navigator.sendBeacon(config.endpoint, blob);
    } catch {
      // sendBeacon can throw if endpoint is bad — telemetry must
      // never break the game, swallow.
    }
  }
}

export function init(opts = {}) {
  config = {
    ...config,
    ...opts,
    deviceId: loadDeviceId(),
    sessionId: loadSessionId(),
  };
  buffer = restoreBuffer();
  // window-level crash listeners. Recoverable, telemetry-only — the
  // gameplay error backstop is in main.js.
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      captureError(e.error || new Error(e.message || 'window error'), {
        source: 'window.error',
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
      captureError(reason, { source: 'unhandledrejection' });
    });
    // Flush any pending buffer on pagehide so a fast close doesn't drop
    // the last few events.
    window.addEventListener('pagehide', () => {
      track('session_end', { buffer_size: buffer.length });
    });
  }
}

export function setUserProps(props) {
  userProps = { ...userProps, ...props };
}

export function track(name, props = {}) {
  const event = {
    name,
    ts: Date.now(),
    sessionId: config.sessionId,
    deviceId: config.deviceId,
    appVersion: config.appVersion,
    user: userProps,
    props,
  };
  buffer.push(event);
  if (buffer.length > MAX_BUFFER_EVENTS) buffer.shift();
  flushBuffer();
  shipEvent(event);
}

export function captureError(err, context = {}) {
  const event = {
    name: 'error',
    ts: Date.now(),
    sessionId: config.sessionId,
    deviceId: config.deviceId,
    appVersion: config.appVersion,
    user: userProps,
    props: {
      message: err && err.message || String(err),
      stack: err && err.stack || null,
      ...context,
      // Include the recent event buffer so the report shows what the
      // player did right before the crash.
      recent_events: buffer.slice(-10).map((e) => ({ name: e.name, ts: e.ts, props: e.props })),
    },
  };
  // Don't push to buffer — errors are reported standalone.
  shipEvent(event);
}

// Test helpers — never used in app code, but lets a test harness verify
// without poking module internals.
export function _getBuffer() { return buffer.slice(); }
export function _getConfig() { return { ...config }; }
