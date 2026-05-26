import { useLocation } from "wouter-preact";
import { routes } from "../router";
import "./Splash.css";

export function Splash() {
  const [, navigate] = useLocation();

  return (
    <main class="screen splash">
      <div class="splash__plate">
        <p class="numeral splash__numeral">— I —</p>
        <h1 class="splash__title">
          Arcana
          <br />
          <em>Cascada</em>
        </h1>
        <div class="rule rule--double splash__rule" aria-hidden="true" />
        <p class="splash__epigraph">An oracle of small fortunes.</p>
        <button
          type="button"
          class="btn btn--primary splash__cta"
          onClick={() => navigate(routes.home)}
        >
          Begin the Reading
        </button>
        <p class="eyebrow splash__footnote">A match-three in three suits</p>
      </div>
    </main>
  );
}
