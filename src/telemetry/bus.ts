/**
 * Tiny local-only telemetry bus. Events are kept in a capped ring
 * buffer in localStorage so the player can audit what's recorded
 * (Settings has a "View recent events" affordance). Nothing leaves the
 * device — no network, no IDs, no third-party.
 */

export type TelemetryEventName =
  | "app_open"
  | "mode_start"
  | "swap_made"
  | "match_resolved"
  | "cascade_step"
  | "deadlock"
  | "mode_won"
  | "mode_lost"
  | "chamber_passed"
  | "chamber_failed"
  | "settings_toggled";

export type TelemetryEvent = {
  name: TelemetryEventName;
  at: number;
  data?: Record<string, string | number | boolean>;
};

const STORAGE_KEY = "arcana.telemetry.v1";
const RING_LIMIT = 200;

let _enabled = true;
let _cache: TelemetryEvent[] | null = null;
const listeners = new Set<(events: TelemetryEvent[]) => void>();

function load(): TelemetryEvent[] {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

function persist() {
  if (!_cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
  } catch {
    /* full / unavailable — drop silently */
  }
}

export function setEnabled(on: boolean) {
  _enabled = on;
}

export function emit(
  name: TelemetryEventName,
  data?: TelemetryEvent["data"],
) {
  if (!_enabled) return;
  const events = load();
  events.push({ name, at: Date.now(), data });
  while (events.length > RING_LIMIT) events.shift();
  persist();
  for (const fn of listeners) fn(events.slice());
}

export function recent(limit = 50): TelemetryEvent[] {
  const events = load();
  return events.slice(-limit);
}

export function clear() {
  _cache = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn([]);
}

export function subscribe(fn: (events: TelemetryEvent[]) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Test seam — wipes in-memory cache without touching localStorage. */
export function _resetCache() {
  _cache = null;
}
