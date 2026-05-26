import { useLocation } from "wouter-preact";
import { routes } from "../router";

export function NotFound() {
  const [, navigate] = useLocation();

  return (
    <main
      class="screen stack"
      style={{
        "--gap": "var(--space-6)",
        alignItems: "center",
        textAlign: "center",
        justifyContent: "center",
      }}
    >
      <p class="numeral">— 0 —</p>
      <h1>The Fool's Page</h1>
      <p style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>
        This card was not in the deck.
      </p>
      <button
        type="button"
        class="btn"
        onClick={() => navigate(routes.home)}
      >
        Return
      </button>
    </main>
  );
}
