import { useLocation } from "wouter-preact";
import { routes } from "../router";
import { useSettings } from "../state/settings";

export function Settings() {
  const [, navigate] = useLocation();
  const { sound, haptics, reducedMotion, set } = useSettings();

  return (
    <main class="screen stack" style={{ "--gap": "var(--space-6)" }}>
      <header class="stack" style={{ "--gap": "var(--space-2)" }}>
        <p class="eyebrow">House Rules</p>
        <h1>Settings</h1>
      </header>

      <div class="rule rule--soft" />

      <section class="stack" style={{ "--gap": "var(--space-4)" }}>
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

      <div class="rule rule--soft" />

      <button
        type="button"
        class="btn btn--ghost"
        onClick={() => navigate(routes.home)}
      >
        ← Back to the Reading Room
      </button>
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
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "var(--space-6)",
        padding: "var(--space-3) 0",
        borderBottom: "var(--rule-soft)",
        cursor: "pointer",
      }}
    >
      <span>
        <span style={{ display: "block", fontFamily: "var(--font-engraved)", fontSize: "0.95rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ display: "block", color: "var(--ink-soft)", fontStyle: "italic", marginTop: "var(--space-1)" }}>
          {hint}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
        style={{ marginTop: "var(--space-2)", width: "1.25rem", height: "1.25rem", accentColor: "var(--accent)" }}
      />
    </label>
  );
}
