import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { useArcana } from "../state/arcana";
import { useQuerent } from "../state/querent";
import { useVouchers } from "../state/vouchers";
import { routes } from "../router";
import { MAX_HELD_ARCANA, type Arcana } from "../game/arcana";
import { aggregateVoucherEffects } from "../game/vouchers";
import { stakeById } from "../game/stakes";
import { classById } from "../game/querent";
import { MAX_HELD_MINORS, MINOR_ARCANA, type MinorArcana } from "../game/minor-arcana";
import { useMinorArcana } from "../state/minor-arcana";
import { createRng } from "../game/engine/rng";
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

  const stakeRule = useMemo(
    () => (querentRun ? stakeById(querentRun.stakeId)?.rule ?? null : null),
    [querentRun?.stakeId],
  );
  const querentClass = useMemo(
    () => (querentRun ? classById(querentRun.classId) ?? null : null),
    [querentRun?.classId],
  );
  const ownedVouchers = useVouchers((s) => s.owned());
  const voucherEffects = useMemo(
    () => aggregateVoucherEffects(ownedVouchers),
    [ownedVouchers],
  );
  const drawCount = stakeRule?.arcanaDrawCount ?? 3;
  const baseHand =
    querentClass?.handCap ?? stakeRule?.maxHand ?? MAX_HELD_ARCANA;
  const handCap = baseHand + voucherEffects.handCapBonus;
  const extraMinorOffer = querentClass?.extraMinorDraw ?? false;

  const offered = useArcana((s) => s.offered());
  const held = useArcana((s) => s.held());
  const isFull = useArcana((s) => s.isFull(handCap));
  const rollOffer = useArcana((s) => s.rollOffer);
  const acceptOffer = useArcana((s) => s.acceptOffer);
  const skipOffer = useArcana((s) => s.skipOffer);
  const grantMinor = useMinorArcana((s) => s.grant);

  // Skeptic class: roll a single bonus Minor offer alongside the
  // standard Majors. Stored locally so re-mounts don't re-roll it.
  const [bonusMinor, setBonusMinor] = useState<MinorArcana | null>(null);

  // Roll a fresh offer the first time this screen mounts for a given
  // chamber-transition. Re-mounts via back-button reuse the existing
  // offerings (drawSeed survives in the store).
  useEffect(() => {
    if (offered.length === 0 && !isFull) rollOffer(undefined, drawCount);
    if (extraMinorOffer && bonusMinor === null) {
      const seed = Math.floor(Math.random() * 2 ** 31);
      const rng = createRng(seed);
      setBonusMinor(
        MINOR_ARCANA[Math.floor(rng() * MINOR_ARCANA.length)] ?? null,
      );
    }
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
    acceptOffer(arcana.id, handCap);
    // Picking a Major also clears the bonus minor — only one card is
    // taken per draw, regardless of which it was.
    setBonusMinor(null);
    advance();
  }

  function pickMinor(minor: MinorArcana) {
    // Effective minor cap = baseline MAX_HELD_MINORS + Deeper Cup
    // voucher bonus. If the tray is full we just skip the grant — the
    // UI guards against this with the button's disabled state.
    grantMinor(minor.id, MAX_HELD_MINORS + voucherEffects.minorCapBonus);
    skipOffer();
    setBonusMinor(null);
    advance();
  }

  function skip() {
    skipOffer();
    setBonusMinor(null);
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
        <section
          class="draw__deck"
          aria-label={
            bonusMinor ? "Four cards offered (Skeptic)" : "Three cards offered"
          }
        >
          {offered.map((arcana, idx) => (
            <DrawCard
              key={arcana.id}
              arcana={arcana}
              revealed={flipped.has(idx)}
              onFlip={() => flip(idx)}
              onPick={() => pick(arcana)}
            />
          ))}
          {bonusMinor ? (
            <MinorDrawCard
              minor={bonusMinor}
              revealed={flipped.has(99)}
              onFlip={() => flip(99)}
              onPick={() => pickMinor(bonusMinor)}
              disabled={
                useMinorArcana.getState().heldIds.length >=
                MAX_HELD_MINORS + voucherEffects.minorCapBonus
              }
            />
          ) : null}
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

function MinorDrawCard({
  minor,
  revealed,
  onFlip,
  onPick,
  disabled,
}: {
  minor: MinorArcana;
  revealed: boolean;
  onFlip: () => void;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <div class={`draw__flip${revealed ? " draw__flip--revealed" : ""}`}>
      <button
        type="button"
        class="draw__flip-face draw__flip-face--back draw__card-back draw__card-back--minor"
        aria-hidden={revealed}
        aria-label="Turn the bonus Minor card"
        tabIndex={revealed ? -1 : 0}
        onClick={onFlip}
      >
        <span class="draw__card-back-pattern" aria-hidden="true">
          <CardBackPattern />
        </span>
        <span class="draw__card-back-label script">bonus · turn</span>
      </button>
      <div
        class="draw__flip-face draw__flip-face--front"
        aria-hidden={!revealed}
      >
        <TarotCard
          numeral={minor.numeral}
          panelName={minor.name}
          panelCaption="consumable"
          headline={minor.name}
          script={minor.name.toLowerCase()}
          subtitle={minor.flavor}
          panelColor={minor.panelColor}
          figure={<MinorBonusGlyph />}
          footer={
            <>
              <p class="draw__card-effect">{minor.description}</p>
              <button
                type="button"
                class="btn btn--primary btn--on-card draw__card-cta"
                disabled={disabled}
                onClick={onPick}
                tabIndex={revealed ? 0 : -1}
              >
                {disabled ? "Tray full" : "Pocket this"}
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}

function MinorBonusGlyph() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      {/* Small coin with a flame above — same vocabulary as Parlour Minors. */}
      <circle cx="60" cy="80" r="22" />
      <circle cx="60" cy="80" r="16" fill="var(--card-panel, transparent)" />
      <path d="M60 26c6 12 16 16 16 30a16 16 0 0 1-32 0c0-14 10-18 16-30z" />
      <path
        d="M60 42c3 6 6 8 6 14a6 6 0 0 1-12 0c0-6 3-8 6-14z"
        fill="var(--card-panel, transparent)"
      />
    </svg>
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
  return (
    <div class={`draw__flip${revealed ? " draw__flip--revealed" : ""}`}>
      <button
        type="button"
        class="draw__flip-face draw__flip-face--back draw__card-back"
        aria-hidden={revealed}
        aria-label="Turn the card"
        tabIndex={revealed ? -1 : 0}
        onClick={onFlip}
      >
        <span class="draw__card-back-pattern" aria-hidden="true">
          <CardBackPattern />
        </span>
        <span class="draw__card-back-label script">turn</span>
      </button>
      <div
        class="draw__flip-face draw__flip-face--front"
        aria-hidden={!revealed}
      >
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
                tabIndex={revealed ? 0 : -1}
              >
                Read this card
              </button>
            </>
          }
        />
      </div>
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
    case "emperor":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Emperor's helmet/crown — square authority */}
          <path d="M44 18h32v8H44z" />
          <path d="M46 26h28l-2 6H48z" />
          {/* Head */}
          <ellipse cx="60" cy="42" rx="9" ry="7" fill="var(--card-panel, transparent)" />
          <circle cx="56" cy="42" r="1.6" />
          <circle cx="64" cy="42" r="1.6" />
          {/* Armored body — straight blocks */}
          <rect x="38" y="52" width="44" height="20" />
          <rect x="32" y="72" width="56" height="40" />
          {/* Belt */}
          <rect x="32" y="78" width="56" height="6" fill="var(--card-panel, transparent)" />
          {/* Throne arms */}
          <rect x="22" y="80" width="10" height="32" />
          <rect x="88" y="80" width="10" height="32" />
          {/* Ram heads at throne ends */}
          <circle cx="27" cy="76" r="4" />
          <circle cx="93" cy="76" r="4" />
          {/* Sceptre */}
          <line x1="100" y1="36" x2="106" y2="118" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          <circle cx="100" cy="34" r="4" />
        </svg>
      );
    case "hierophant":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Mitre crown */}
          <path d="M40 22h40l-4 18H44z" />
          <path d="M48 12h24l-2 10H50z" />
          {/* Face */}
          <ellipse cx="60" cy="50" rx="8" ry="6" fill="var(--card-panel, transparent)" />
          <circle cx="56" cy="50" r="1.6" />
          <circle cx="64" cy="50" r="1.6" />
          {/* Robes */}
          <path d="M40 60h40l8 60H32z" />
          <rect x="56" y="68" width="8" height="40" fill="var(--card-panel, transparent)" />
          {/* Cross within */}
          <rect x="58" y="80" width="4" height="20" />
          <rect x="50" y="86" width="20" height="4" />
          {/* Two acolytes (small heads at base) */}
          <circle cx="34" cy="120" r="4" />
          <circle cx="86" cy="120" r="4" />
        </svg>
      );
    case "justice":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Crown */}
          <path d="M50 16h20l-2 8H52z" />
          {/* Head */}
          <circle cx="60" cy="32" r="8" />
          {/* Robes */}
          <path d="M44 40h32l4 70H40z" />
          {/* Sword raised */}
          <rect x="58" y="46" width="4" height="44" />
          <path d="M52 46l8-12 8 12z" />
          {/* Scales horizontal bar */}
          <path d="M20 70h80" stroke="currentColor" stroke-width="3" fill="none" />
          {/* Scale pans */}
          <path d="M30 70l-8 14h16z" />
          <path d="M90 70l-8 14h16z" />
        </svg>
      );
    case "hanged-man":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Gallows beam */}
          <rect x="20" y="14" width="80" height="4" />
          <rect x="20" y="14" width="4" height="20" />
          {/* Rope */}
          <rect x="58" y="18" width="4" height="22" />
          {/* Head inverted */}
          <circle cx="60" cy="48" r="8" />
          {/* Body inverted (T-shape upside down) */}
          <rect x="56" y="56" width="8" height="28" />
          {/* One leg bent crossing the other (the iconic 4-pose) */}
          <path d="M56 80l-12 24m12-24l4 24m4-24l8 18-10 6" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" />
          {/* Halo at the head */}
          <circle cx="60" cy="48" r="14" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
        </svg>
      );
    case "temperance":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Angel wings */}
          <path d="M30 30c0 14 14 22 30 22s30-8 30-22c-6 0-14 4-18 8-2-6-6-10-12-10s-10 4-12 10c-4-4-12-8-18-8z" />
          {/* Head + halo */}
          <circle cx="60" cy="56" r="8" />
          <circle cx="60" cy="56" r="14" fill="none" stroke="currentColor" stroke-width="2" />
          {/* Two vessels pouring */}
          <path d="M36 78h12l4 18a8 8 0 0 1-20 0z" />
          <path d="M72 78h12l4 18a8 8 0 0 1-20 0z" />
          {/* Pouring streams meeting in the middle */}
          <path d="M50 98l8 14M70 98l-8 14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />
        </svg>
      );
    case "devil":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Horns */}
          <path d="M40 14l8 22-12-10z" />
          <path d="M80 14l-8 22 12-10z" />
          {/* Head */}
          <ellipse cx="60" cy="44" rx="20" ry="14" />
          {/* Eyes (cut-outs) */}
          <ellipse cx="52" cy="44" rx="3" ry="4" fill="var(--card-panel, transparent)" />
          <ellipse cx="68" cy="44" rx="3" ry="4" fill="var(--card-panel, transparent)" />
          {/* Wicked grin */}
          <path d="M48 52c4 6 20 6 24 0" stroke="var(--card-panel, transparent)" stroke-width="3" fill="none" />
          {/* Bat wings */}
          <path d="M18 70c8-2 14 2 22 8-2-8 0-14 4-18-8 4-18 4-26 10z" />
          <path d="M102 70c-8-2-14 2-22 8 2-8 0-14-4-18 8 4 18 4 26 10z" />
          {/* Pillar with chained figures */}
          <rect x="50" y="72" width="20" height="40" />
          <path d="M40 110h40v6H40z" />
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
    case "star":
      return (
        <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
          {/* Big radiant star */}
          <path d="M60 14l8 20 22 2-16 14 6 22-20-12-20 12 6-22-16-14 22-2z" />
          {/* Two pouring vessels */}
          <path d="M30 70h12l2 14a6 6 0 0 1-16 0z" />
          <path d="M78 70h12l2 14a6 6 0 0 1-16 0z" />
          {/* Pouring streams */}
          <path d="M40 90c-2 8-4 14-4 22" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M88 90c2 8 4 14 4 22" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />
          {/* Small auxiliary stars */}
          <path d="M22 26l2 4 4 .4-3 3 1 4-4-2-4 2 1-4-3-3 4-.4z" />
          <path d="M100 30l2 4 4 .4-3 3 1 4-4-2-4 2 1-4-3-3 4-.4z" />
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
