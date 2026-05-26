import { useLocation } from "wouter-preact";
import { routes } from "../router";
import "./Play.css";

export function Play() {
  const [, navigate] = useLocation();

  return (
    <main class="screen play stack" style={{ "--gap": "var(--space-6)" }}>
      <header class="play__head">
        <button
          type="button"
          class="btn btn--ghost"
          aria-label="Leave the reading"
          onClick={() => navigate(routes.home)}
        >
          ← Leave
        </button>
        <p class="eyebrow">A Reading in Progress</p>
        <span aria-hidden="true" />
      </header>

      <section class="leaf play__board" aria-label="Game board placeholder">
        <p class="numeral">— Pending —</p>
        <h2>The Cloth Is Being Laid</h2>
        <p class="play__note">
          The board, suits, and divination mechanics arrive in a following
          chapter. This screen is the slot they will mount into.
        </p>
      </section>
    </main>
  );
}
