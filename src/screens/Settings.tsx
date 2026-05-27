import { useEffect, useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { routes } from "../router";
import { useSettings } from "../state/settings";
import { clear as clearTelemetry, recent as recentTelemetry, subscribe as subscribeTelemetry, type TelemetryEvent } from "../telemetry/bus";
import "./Settings.css";

export function Settings() {
  const [, navigate] = useLocation();
  const { sound, haptics, reducedMotion, telemetry, set } = useSettings();

  return (
    <main class="screen settings">
      <header class="settings__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div class="settings__title">
          <p class="eyebrow">House Rules</p>
          <h1>
            <em>Settings</em>
          </h1>
          <p class="script settings__sub">how the room is set</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <section class="settings__list" aria-label="Preferences">
        <Toggle
          label="Sound"
          hint="Soft chimes and reading-room ambience."
          checked={sound}
          onChange={(v) => set({ sound: v })}
        />
        <Toggle
          label="Haptics"
          hint="A gentle pulse on each match."
          checked={haptics}
          onChange={(v) => set({ haptics: v })}
        />
        <Toggle
          label="Reduced motion"
          hint="Calm the flourishes between pages."
          checked={reducedMotion}
          onChange={(v) => set({ reducedMotion: v })}
        />
        <Toggle
          label="Telemetry"
          hint="Local-only event log. Nothing leaves this device."
          checked={telemetry}
          onChange={(v) => set({ telemetry: v })}
        />
      </section>

      <TelemetryViewer />
    </main>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label class="toggle">
      <span class="toggle__text">
        <span class="toggle__label">{label}</span>
        <span class="toggle__hint">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
        class="toggle__input"
      />
      <span class="toggle__switch" aria-hidden="true" />
    </label>
  );
}

function TelemetryViewer() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<TelemetryEvent[]>(() => recentTelemetry(20));

  useEffect(() => {
    const unsub = subscribeTelemetry((all) => setEvents(all.slice(-20)));
    return unsub;
  }, []);

  return (
    <section class="settings__telemetry" aria-label="Telemetry log">
      <div class="settings__telemetry-head">
        <button
          type="button"
          class="btn btn--ghost"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "▾" : "▸"} Recent events ({events.length})
        </button>
        {open ? (
          <button
            type="button"
            class="btn btn--ghost"
            onClick={() => clearTelemetry()}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        events.length === 0 ? (
          <p class="settings__telemetry-empty">No events recorded yet.</p>
        ) : (
          <ul class="settings__telemetry-list">
            {events.slice().reverse().map((ev, i) => (
              <li key={`${ev.at}-${i}`} class="settings__telemetry-row">
                <span class="settings__telemetry-name">{ev.name}</span>
                <span class="settings__telemetry-time tabular">
                  {new Date(ev.at).toLocaleTimeString()}
                </span>
                {ev.data ? (
                  <span class="settings__telemetry-data tabular">
                    {summarizeData(ev.data)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function summarizeData(data: Record<string, string | number | boolean>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}
