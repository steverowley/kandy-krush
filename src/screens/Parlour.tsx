import { useEffect, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { useArcana } from "../state/arcana";
import { useCoins } from "../state/coins";
import { useQuerent } from "../state/querent";
import { ARCANA_PRICE, rollParlourOffers } from "../game/parlour";
import { MAX_HELD_ARCANA, type Arcana } from "../game/arcana";
import { createRng } from "../game/engine/rng";
import { routes } from "../router";
import "./Parlour.css";

/**
 * The Parlour — a small velvet-table shop visited every third chamber.
 * Coins earned in chambers buy Arcana from a rolled offer table.
 *
 * URL params:
 *   ?next=<chamberIndex>  — chamber to route to on leave.
 */
export function Parlour() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const nextChamber = nextChamberFromQuery(search);
  const querentRun = useQuerent((s) => s.run);

  const balance = useCoins((s) => s.balance);
  const spend = useCoins((s) => s.spend);

  const held = useArcana((s) => s.held());
  const isFull = useArcana((s) => s.isFull());
  const acceptOffer = useArcana((s) => s.acceptOffer);

  const [offers, setOffers] = useState<Arcana[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());

  // Roll a fresh offer table on first mount per visit. Re-mounts (e.g.
  // browser-back) reuse the same offers via React state; that's fine
  // because purchases are already reflected via `purchased`.
  useEffect(() => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const rng = createRng(seed);
    setOffers(rollParlourOffers(held, rng));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buy(arcana: Arcana) {
    if (purchased.has(arcana.id)) return;
    if (isFull) return;
    if (!spend(ARCANA_PRICE)) return;
    acceptOffer(arcana.id);
    setPurchased((prev) => {
      const next = new Set(prev);
      next.add(arcana.id);
      return next;
    });
  }

  function leave() {
    if (querentRun && nextChamber) {
      navigate(`${routes.play}?mode=querent&chamber=${nextChamber}`);
    } else {
      navigate(routes.querent);
    }
  }

  if (!querentRun) {
    return (
      <main class="screen parlour stack" style={{ "--gap": "var(--space-4)" }}>
        <header class="parlour__head">
          <p class="eyebrow">The Parlour</p>
          <h1 class="parlour__title">No path open</h1>
        </header>
        <p class="parlour__body">
          The cards rest on the velvet, waiting for a querent.
        </p>
        <button
          type="button"
          class="btn btn--primary"
          onClick={() => navigate(routes.querent)}
        >
          To the path
        </button>
      </main>
    );
  }

  return (
    <main class="screen parlour stack" style={{ "--gap": "var(--space-4)" }}>
      <header class="parlour__head">
        <p class="eyebrow">The Parlour</p>
        <h1 class="parlour__title">
          A Card <em>For Sale</em>
        </h1>
        <p class="parlour__sub script">spend your fortune</p>
        <p class="parlour__purse">
          <span class="eyebrow">Coins</span>
          <span class="parlour__purse-value tabular">{balance}</span>
        </p>
        {isFull ? (
          <p class="parlour__notice">Your hand is full — purchases are sealed.</p>
        ) : null}
      </header>

      <section class="parlour__shelf" aria-label="Offers">
        {offers.map((arcana) => {
          const bought = purchased.has(arcana.id);
          const affordable = balance >= ARCANA_PRICE;
          const disabled = bought || isFull || !affordable;
          return (
            <div class="parlour__card-wrap" key={arcana.id}>
              <TarotCard
                numeral={arcana.numeral}
                panelName={arcana.name}
                panelCaption={arcana.panelCaption}
                headline={arcana.name}
                script={arcana.name.toLowerCase()}
                subtitle={arcana.subtitle}
                panelColor={arcana.panelColor}
                figure={<OfferGlyph />}
                className={bought ? "card--disabled" : ""}
                footer={
                  <>
                    <p class="parlour__effect">{arcana.description}</p>
                    <div class="parlour__price-row">
                      <span class="parlour__price tabular">
                        {ARCANA_PRICE}{" "}
                        <span class="parlour__price-label">coins</span>
                      </span>
                      <button
                        type="button"
                        class="btn btn--primary btn--on-card parlour__buy"
                        disabled={disabled}
                        onClick={() => buy(arcana)}
                      >
                        {bought
                          ? "Taken"
                          : isFull
                            ? "Hand full"
                            : !affordable
                              ? "Too dear"
                              : "Take it"}
                      </button>
                    </div>
                  </>
                }
              />
            </div>
          );
        })}
      </section>

      <footer class="parlour__foot">
        <button type="button" class="btn btn--primary" onClick={leave}>
          {nextChamber ? "Onward" : "Back to the path"}
        </button>
      </footer>
    </main>
  );
}

/** Filler glyph for the offer card — a coin-and-card vignette so the
 *  shop reads visually distinct from the regular Arcana Draw figures. */
function OfferGlyph() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Coin */}
      <circle cx="42" cy="72" r="22" />
      <circle cx="42" cy="72" r="18" fill="var(--card-panel, transparent)" />
      <circle cx="42" cy="72" r="14" />
      <text
        x="42"
        y="78"
        text-anchor="middle"
        font-family="serif"
        font-size="14"
        font-weight="700"
        fill="var(--card-panel, transparent)"
      >
        ☉
      </text>
      {/* Card behind */}
      <rect
        x="68"
        y="42"
        width="38"
        height="58"
        rx="4"
        transform="rotate(10 87 71)"
      />
      <rect
        x="74"
        y="50"
        width="26"
        height="42"
        rx="2"
        transform="rotate(10 87 71)"
        fill="var(--card-panel, transparent)"
      />
      {/* Hand of dealer */}
      <path d="M16 102c-6 4-6 18 6 20 10 2 32 0 50-10l-4-6c-12 6-30 4-40 4-4 0-12-8-12-8z" />
      {/* Sparks */}
      <circle cx="98" cy="34" r="2" />
      <circle cx="20" cy="42" r="1.6" />
    </svg>
  );
}

function nextChamberFromQuery(search: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get("next");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

// Re-export for adjacent screens that need the same cap.
export { MAX_HELD_ARCANA };
