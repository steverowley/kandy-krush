import { useLocation } from "wouter-preact";
import { routes } from "../router";
import "./About.css";

export function About() {
  const [, navigate] = useLocation();

  return (
    <main class="screen about">
      <header class="about__head">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.home)}
        >
          ← Reading Room
        </button>
        <div class="about__title">
          <p class="eyebrow">Colophon</p>
          <h1>
            About <em>Arcana</em>
          </h1>
          <p class="script about__sub">read · choose · divine</p>
        </div>
        <span aria-hidden="true" />
      </header>

      <section class="about__body">
        <p class="about__lede">
          A match-three in four suits. Cards fall, fortunes settle, the
          querent reads what remains.
        </p>
        <p>
          The deck is built around modern poster-style tarot art:
          saturated jewel-tone panels, bold flat illustration, and a
          headline stack that pairs heavy serif, all-caps sans, and a
          loose cursive flourish.
        </p>
        <p class="about__credit">
          <span class="script">arcana cascada</span>
          <span class="about__dot">·</span>
          <span class="eyebrow">2026 ·</span>
          <span class="eyebrow">v0.5</span>
        </p>
      </section>
    </main>
  );
}
