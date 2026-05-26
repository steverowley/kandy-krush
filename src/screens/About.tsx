import { useLocation } from "wouter-preact";
import { routes } from "../router";

export function About() {
  const [, navigate] = useLocation();

  return (
    <main class="screen stack" style={{ "--gap": "var(--space-6)" }}>
      <header class="stack" style={{ "--gap": "var(--space-2)" }}>
        <p class="eyebrow">Colophon</p>
        <h1>Arcana Cascada</h1>
      </header>

      <div class="rule rule--soft" />

      <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "var(--step-1)" }}>
        A match-three in three suits. Cards fall, fortunes settle, the
        querent reads what remains.
      </p>

      <p>
        Set in editorial bone, parchment, oxblood, and gold. Designed to feel
        like a chapter in an old occult journal rather than a stack of bright
        candies. The matching is the divination.
      </p>

      <div class="rule rule--soft" />

      <p class="eyebrow">— II —</p>

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
