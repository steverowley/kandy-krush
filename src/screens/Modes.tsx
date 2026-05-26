import { useLocation } from "wouter-preact";
import { routes } from "../router";

export function Modes() {
  const [, navigate] = useLocation();

  return (
    <main class="screen stack" style={{ "--gap": "var(--space-6)" }}>
      <header>
        <p class="eyebrow">Index</p>
        <h1>The Spreads</h1>
      </header>
      <div class="rule rule--soft" />
      <p>Mode index is mapped through the Reading Room for now.</p>
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
