import { useEffect, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { useArcana } from "../state/arcana";
import { useQuerent } from "../state/querent";
import { routes } from "../router";
import type { Arcana } from "../game/arcana";
import "./Draw.css";

/**
 * The Arcana Draw — between every chamber in The Querent's Path the
 * player flips one of three face-down cards into a slot. Effects fire
 * left-to-right when scoring (see `applyArcanaToStep`).
 *
 * URL params:
 *   ?next=<chamberIndex>  — chamber to route to after a pick / skip
 */
export function Draw() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const nextChamber = nextChamberFromQuery(search);
  const querentRun = useQuerent((s) => s.run);

  const offered = useArcana((s) => s.offered());
  const held = useArcana((s) => s.held());
  const isFull = useArcana((s) => s.isFull());
  const rollOffer = useArcana((s) => s.rollOffer);
  const acceptOffer = useArcana((s) => s.acceptOffer);
  const skipOffer = useArcana((s) => s.skipOffer);

  // Roll a fresh offer the first time this screen mounts for a given
  // chamber-transition. Re-mounts via back-button reuse the existing
  // offerings (drawSeed survives in the store).
  useEffect(() => {
    if (offered.length === 0 && !isFull) rollOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  function flip(idx: number) {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }

  function pick(arcana: Arcana) {
    acceptOffer(arcana.id);
    advance();
  }

  function skip() {
    skipOffer();
    advance();
  }

  function advance() {
    if (querentRun && nextChamber) {
      navigate(`${routes.play}?mode=querent&chamber=${nextChamber}`);
    } else {
      navigate(routes.querent);
    }
  }

  // Edge case: arrived here outside an active run, or no offer available.
  if (!querentRun) {
    return (
      <main class="screen draw stack" style={{ "--gap": "var(--space-4)" }}>
        <header class="draw__head">
          <p class="eyebrow">The Reading</p>
          <h1 class="draw__title">No path open</h1>
        </header>
        <p class="draw__body">
          Begin a Querent's Path before drawing arcana.
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
    <main class="screen draw stack" style={{ "--gap": "var(--space-4)" }}>
      <header class="draw__head">
        <p class="eyebrow">The Reading</p>
        <h1 class="draw__title">
          A Card <em>Turns</em>
        </h1>
        <p class="draw__sub script">choose your fortune</p>
        {isFull ? (
          <p class="draw__notice">Your slots are full — the draw passes you.</p>
        ) : null}
      </header>

      {!isFull ? (
        <section class="draw__deck" aria-label="Three cards offered">
          {offered.map((arcana, idx) => (
            <DrawCard
              key={arcana.id}
              arcana={arcana}
              revealed={flipped.has(idx)}
              onFlip={() => flip(idx)}
              onPick={() => pick(arcana)}
            />
          ))}
        </section>
      ) : null}

      {held.length > 0 ? (
        <section class="draw__held" aria-label="Held arcana">
          <p class="eyebrow">Your hand</p>
          <ul class="draw__held-list">
            {held.map((a) => (
              <li class="draw__held-item" key={a.id}>
                <span class="numeral">{a.numeral}</span>
                <span class="draw__held-name">{a.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer class="draw__foot">
        <button type="button" class="btn btn--ghost" onClick={skip}>
          {isFull ? "Onward" : "Pass the draw"}
        </button>
      </footer>
    </main>
  );
}

function DrawCard({
  arcana,
  revealed,
  onFlip,
  onPick,
}: {
  arcana: Arcana;
  revealed: boolean;
  onFlip: () => void;
  onPick: () => void;
}) {
  if (!revealed) {
    return (
      <button
        type="button"
        class="draw__card-back"
        aria-label="Turn the card"
        onClick={onFlip}
      >
        <span class="draw__card-back-pattern" aria-hidden="true">
          <CardBackPattern />
        </span>
        <span class="draw__card-back-label script">turn</span>
      </button>
    );
  }
  return (
    <div class="draw__card-wrap">
      <TarotCard
        numeral={arcana.numeral}
        panelName={arcana.name}
        panelCaption={arcana.panelCaption}
        headline={arcana.name}
        script={arcana.name.toLowerCase()}
        subtitle={arcana.subtitle}
        panelColor={arcana.panelColor}
        figure={<ArcanaFigure id={arcana.id} />}
        footer={
          <>
            <p class="draw__card-effect">{arcana.description}</p>
            <button
              type="button"
              class="btn btn--primary btn--on-card draw__card-cta"
              onClick={onPick}
            >
              Read this card
            </button>
          </>
        }
      />
    </div>
  );
}

/** Per-Arcana figure illustrations. Filled silhouettes in the ink color,
 *  with the panel color tinting through cut-out apertures. */
function ArcanaFigure({ id }: { id: Arcana["id"] }) {
  switch (id) {
    case "fool":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* A figure striding off a ledge, bindle on stick */}
          <path d="M70 26a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" />
          <path d="M52 38h16l-2 30h-12z" />
          <path d="M48 70l-6 30 6 4 8-28z" />
          <path d="M68 70l8 26 8-4-10-30z" />
          <rect x="58" y="98" width="4" height="22" />
          <rect x="62" y="98" width="4" height="22" />
          {/* Bindle on a stick */}
          <line x1="84" y1="20" x2="100" y2="50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="100" cy="50" r="6" />
          <circle cx="100" cy="50" r="2.4" fill="var(--card-panel, transparent)" />
          {/* Edge of cliff */}
          <path d="M0 124h70l4 6h-74z" />
        </svg>
      );
    case "empress":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Seated figure with floral crown */}
          <circle cx="60" cy="36" r="14" />
          {/* Crown of stars */}
          {[36, 50, 64].map((x, i) => (
            <path
              key={i}
              d={`M${x} 14l1.6 4 4.4.4-3.4 3 1 4.4L${x} 23.6l-3.6 2.2 1-4.4-3.4-3 4.4-.4z`}
            />
          ))}
          <path d="M44 56h32l4 50H40z" />
          <circle cx="60" cy="76" r="6" fill="var(--card-panel, transparent)" />
          {/* Wheat sheaves */}
          <path d="M22 108l4-30 4 30zM94 108l-4-30-4 30z" />
        </svg>
      );
    case "lovers":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Two heads facing inward */}
          <circle cx="42" cy="40" r="14" />
          <circle cx="78" cy="40" r="14" />
          {/* Shoulders / bodies */}
          <path d="M22 64c0 18 10 28 20 28s12-10 12-18v-4h12v4c0 8 2 18 12 18s20-10 20-28z" />
          {/* Angel wings above */}
          <path d="M44 20c-10-4-20-2-20 6 4-2 14 0 20 4M76 20c10-4 20-2 20 6-4-2-14 0-20 4" stroke="currentColor" stroke-width="2" fill="none" />
          {/* Heart between */}
          <path d="M60 96c-6-6-12-2-12 4s12 12 12 12 12-6 12-12-6-10-12-4z" />
        </svg>
      );
    case "chariot":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Chariot body */}
          <path d="M24 70h72l-6 24H30z" />
          <rect x="40" y="50" width="40" height="22" />
          {/* Driver */}
          <circle cx="60" cy="42" r="8" />
          <path d="M52 50h16v8H52z" />
          {/* Wheels */}
          <circle cx="34" cy="100" r="12" />
          <circle cx="34" cy="100" r="6" fill="var(--card-panel, transparent)" />
          <circle cx="86" cy="100" r="12" />
          <circle cx="86" cy="100" r="6" fill="var(--card-panel, transparent)" />
          {/* Stars over the canopy */}
          <path d="M44 18l1.4 3.4 3.6.4-2.8 2.4.8 3.6-3-1.8-3 1.8.8-3.6L39 22l3.6-.4zM76 18l1.4 3.4 3.6.4-2.8 2.4.8 3.6-3-1.8-3 1.8.8-3.6L71 22l3.6-.4z" />
        </svg>
      );
    case "hermit":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Cloaked silhouette holding a lantern */}
          <path d="M60 20c-12 0-22 10-22 22v50c0 14 10 22 22 22s22-8 22-22V42c0-12-10-22-22-22z" />
          {/* Face peeking from hood */}
          <ellipse cx="60" cy="46" rx="8" ry="6" fill="var(--card-panel, transparent)" />
          <circle cx="58" cy="46" r="1.6" />
          {/* Lantern */}
          <rect x="22" y="62" width="14" height="16" />
          <path d="M22 62l-2-6h18l-2 6z" />
          <circle cx="29" cy="70" r="3" fill="var(--card-panel, transparent)" />
          {/* Lantern light rays */}
          <path d="M10 70l4-2M10 80l4-1M14 60l4 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          {/* Staff */}
          <line x1="92" y1="38" x2="100" y2="120" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
      );
    case "death":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Skull silhouette */}
          <path d="M60 20c-16 0-26 12-26 28v6c0 6 2 10 6 12v6h8v-8h4v8h16v-8h4v8h8v-6c4-2 6-6 6-12v-6c0-16-10-28-26-28z" />
          {/* Eye sockets */}
          <ellipse cx="50" cy="44" rx="4" ry="6" fill="var(--card-panel, transparent)" />
          <ellipse cx="70" cy="44" rx="4" ry="6" fill="var(--card-panel, transparent)" />
          {/* Nose */}
          <path d="M58 56l2 8 2-8z" fill="var(--card-panel, transparent)" />
          {/* Scythe */}
          <line x1="92" y1="14" x2="100" y2="120" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          <path d="M100 14c-12 0-22 10-22 22 0-12 10-22 22-22z" />
          {/* Rose at the base */}
          <circle cx="40" cy="118" r="5" />
          <circle cx="40" cy="118" r="2" fill="var(--card-panel, transparent)" />
        </svg>
      );
    case "tower":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Tall tower */}
          <rect x="44" y="30" width="32" height="80" />
          <path d="M40 30l40 0-4-10H44z" />
          {/* Windows */}
          <rect x="54" y="50" width="12" height="10" fill="var(--card-panel, transparent)" />
          <rect x="54" y="74" width="12" height="10" fill="var(--card-panel, transparent)" />
          {/* Lightning bolt */}
          <path d="M76 12l-14 26 8 0-6 18 18-22-8 0z" />
          {/* Falling figures */}
          <circle cx="28" cy="100" r="3" />
          <circle cx="96" cy="116" r="3" />
          {/* Ground crack */}
          <path d="M20 124h80l-4 4-12-2-10 3-12-3-12 2-10-3-12 2-8-3z" />
        </svg>
      );
    case "magician":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Hand holding a wand */}
          <rect x="56" y="20" width="8" height="60" rx="2" />
          <path d="M60 14a5 5 0 0 0-5 5l5 6 5-6a5 5 0 0 0-5-5z" />
          <circle cx="60" cy="22" r="2.4" fill="var(--card-panel, transparent)" />
          <path d="M36 84c0 14 10 24 24 24s24-10 24-24v-8H36z" />
          <circle cx="60" cy="94" r="3" fill="var(--card-panel, transparent)" />
        </svg>
      );
    case "strength":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Lion's head with infinity halo */}
          <path d="M40 26c-3 6-3 13 3 16-3 8 4 14 12 14s7 0 12 0c8 0 15-6 12-14 6-3 6-10 3-16-4-3-9-2-12 2-3-3-7-4-12-2s-9-1-12-2c-3 1-6 0-6 2z" />
          <circle cx="50" cy="42" r="2" fill="var(--card-panel, transparent)" />
          <circle cx="70" cy="42" r="2" fill="var(--card-panel, transparent)" />
          <path d="M52 54c4 5 12 5 16 0" stroke="var(--card-panel, transparent)" stroke-width="2" fill="none" stroke-linecap="round" />
          <path d="M48 70c-12 6-14 22-2 30s28 8 28-2 0-22-12-26-10-6-14-2z" />
          <path d="M40 14a8 6 0 1 0 16 0 8 6 0 1 0-16 0M64 14a8 6 0 1 0 16 0 8 6 0 1 0-16 0" fill="none" stroke="currentColor" stroke-width="2.5" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Sun disc with rays */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const x1 = 60 + Math.cos(a) * 36;
            const y1 = 64 + Math.sin(a) * 36;
            const x2 = 60 + Math.cos(a) * (i % 2 ? 52 : 60);
            const y2 = 64 + Math.sin(a) * (i % 2 ? 52 : 60);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                stroke-width={i % 2 ? 3 : 5}
                stroke-linecap="round"
              />
            );
          })}
          <circle cx="60" cy="64" r="30" />
          <circle cx="52" cy="60" r="3" fill="var(--card-panel, transparent)" />
          <circle cx="68" cy="60" r="3" fill="var(--card-panel, transparent)" />
          <path d="M50 72c4 6 16 6 20 0" stroke="var(--card-panel, transparent)" stroke-width="3" fill="none" stroke-linecap="round" />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Crescent moon with face */}
          <path d="M82 56a32 32 0 1 1-42-30 24 24 0 0 0 42 30z" />
          <circle cx="46" cy="42" r="2.6" fill="var(--card-panel, transparent)" />
          <path d="M40 56c4 3 10 3 14 0" stroke="var(--card-panel, transparent)" stroke-width="2" fill="none" stroke-linecap="round" />
          {/* Tide stars */}
          <path d="M20 102l1.6 3.8 4.2.4-3.2 2.8 1 4.2-3.6-2-3.6 2 1-4.2-3.2-2.8 4.2-.4z" />
          <circle cx="48" cy="116" r="2" />
          <path d="M76 112l1.4 3.2 3.4.4-2.6 2.2.8 3.4-3-1.6-3 1.6.8-3.4-2.6-2.2 3.4-.4z" />
          <circle cx="100" cy="122" r="1.8" />
        </svg>
      );
    case "world":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Wreath circle */}
          <circle cx="60" cy="64" r="44" fill="none" stroke="currentColor" stroke-width="5" />
          <circle cx="60" cy="64" r="36" fill="none" stroke="currentColor" stroke-width="2" />
          {/* Four corner symbols (cardinal compass) */}
          <circle cx="60" cy="14" r="5" />
          <circle cx="60" cy="114" r="5" />
          <circle cx="10" cy="64" r="5" />
          <circle cx="110" cy="64" r="5" />
          {/* Central figure */}
          <path d="M54 50h12l-2 14 4 4 -4 8 -2 -6 -2 6 -4 -8 4 -4z" />
          <circle cx="60" cy="42" r="6" />
        </svg>
      );
  }
}

function CardBackPattern() {
  // Cream cardstock with a centered sunburst + gold double border —
  // matches the recruitment-poster card chrome on the front.
  return (
    <svg viewBox="0 0 100 140" preserveAspectRatio="none" fill="none">
      <rect x="3" y="3" width="94" height="134" rx="10" fill="var(--bone-100)" />
      <rect x="6" y="6" width="88" height="128" rx="8" fill="none" stroke="var(--accent-gold)" stroke-width="1.2" />
      <rect x="10" y="10" width="80" height="120" rx="6" fill="none" stroke="var(--accent-gold-3)" stroke-width="0.8" />
      <g transform="translate(50 70)">
        <circle r="6" fill="var(--accent-gold)" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
          <line
            key={deg}
            x1="0"
            y1="0"
            x2="0"
            y2={i % 2 === 0 ? -22 : -16}
            transform={`rotate(${deg})`}
            stroke="var(--accent-gold)"
            stroke-width={i % 2 === 0 ? 1.8 : 1.2}
            stroke-linecap="round"
          />
        ))}
      </g>
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
