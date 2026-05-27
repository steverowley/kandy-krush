import { useLocation } from "wouter-preact";
import { routes } from "../router";
import { useSettings } from "../state/settings";
import "./Settings.css";

export function Settings() {
  const [, navigate] = useLocation();
  const { sound, haptics, reducedMotion, set } = useSettings();

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

      <section class="settings__list">
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
      </section>
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
