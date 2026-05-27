import { useLocation } from "wouter-preact";
import { routes } from "../router";
import "./Home.css";

type Mode = {
  numeral: string;
  name: string;
  tagline: string;
  body: string;
  cta: string;
  to: string;
  status?: string;
};

const modes: Mode[] = [
  {
    numeral: "I",
    name: "Free Reading",
    tagline: "No limits. No ledger.",
    body: "Play loose. Practice the suits. Watch the patterns settle.",
    cta: "Open the cloth",
    to: `${routes.play}?mode=free`,
    status: "Playable",
  },
  {
    numeral: "II",
    name: "The Spread",
    tagline: "A measured progression.",
    body: "Eight chapters of escalating omens. Master each before the next page turns.",
    cta: "Open the book",
    to: routes.spread,
    status: "Playable",
  },
  {
    numeral: "III",
    name: "Daily Draw",
    tagline: "One reading. One day.",
    body: "A single fixed spread for every querent today. Same seed worldwide; resume mid-day from any device.",
    cta: "Draw today",
    to: `${routes.play}?mode=daily`,
    status: "Playable",
  },
  {
    numeral: "IV",
    name: "The Querent's Path",
    tagline: "Choose your class. Walk the line.",
    body: "A roguelike journey through nine cards. Permanent loss; permanent insight.",
    cta: "Walk the path",
    to: `${routes.play}?mode=querent`,
  },
];

export function Home() {
  const [, navigate] = useLocation();

  return (
    <main class="screen home">
      <header class="home__masthead">
        <p class="eyebrow">The Reading Room</p>
        <h1 class="home__title">Arcana Cascada</h1>
        <p class="home__subtitle">Choose your spread.</p>
      </header>

      <div class="rule rule--double" aria-hidden="true" />

      <section class="home__modes" aria-label="Modes">
        {modes.map((mode) => (
          <article key={mode.name} class="leaf mode">
            <header class="leaf__head">
              <span class="numeral mode__numeral">{mode.numeral}</span>
              {mode.status ? <span class="eyebrow">{mode.status}</span> : null}
            </header>
            <h2 class="mode__name">{mode.name}</h2>
            <p class="mode__tagline">{mode.tagline}</p>
            <p class="mode__body">{mode.body}</p>
            <button
              type="button"
              class="btn mode__cta"
              onClick={() => navigate(mode.to)}
            >
              {mode.cta}
            </button>
          </article>
        ))}
      </section>

      <footer class="home__foot">
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.settings)}
        >
          Settings
        </button>
        <span aria-hidden="true" class="home__foot-sep">·</span>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => navigate(routes.about)}
        >
          About
        </button>
      </footer>
    </main>
  );
}
