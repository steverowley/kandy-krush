import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation, useSearch } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { useArcana } from "../state/arcana";
import { useCoins } from "../state/coins";
import { useMinorArcana } from "../state/minor-arcana";
import { useQuerent } from "../state/querent";
import { useVouchers } from "../state/vouchers";
import {
  MINOR_PRICE,
  REROLL_PRICE,
  priceOf,
  rollMixedOffers,
  type ParlourOffer,
} from "../game/parlour";
import { MAX_HELD_ARCANA, type Arcana } from "../game/arcana";
import { MAX_HELD_MINORS, type MinorArcana } from "../game/minor-arcana";
import {
  VOUCHERS,
  aggregateVoucherEffects,
  type Voucher,
} from "../game/vouchers";
import { stakeById } from "../game/stakes";
import { createRng } from "../game/engine/rng";
import { routes } from "../router";
import "./Parlour.css";

/**
 * The Parlour — a small velvet-table shop visited every third chamber.
 * Three offer slots roll a mix of Major + Minor Arcana per visit;
 * a single Voucher slot offers a permanent run-scoped upgrade. The
 * player can pay 3 coins to reroll the offer slots (Mystic Mirror
 * voucher gives one free reroll per visit).
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

  const stakeRule = useMemo(
    () => (querentRun ? stakeById(querentRun.stakeId)?.rule ?? null : null),
    [querentRun?.stakeId],
  );
  const offerCount = stakeRule?.parlourOfferCount ?? 3;
  const stakeMaxHand = stakeRule?.maxHand;

  const ownedVouchers = useVouchers((s) => s.owned());
  const voucherEffects = useMemo(
    () => aggregateVoucherEffects(ownedVouchers),
    [ownedVouchers],
  );
  const buyVoucher = useVouchers((s) => s.buy);

  const handCap = (stakeMaxHand ?? MAX_HELD_ARCANA) + voucherEffects.handCapBonus;
  const minorCap = MAX_HELD_MINORS + voucherEffects.minorCapBonus;

  const held = useArcana((s) => s.held());
  const isFullMajors = useArcana((s) => s.isFull(handCap));
  const acceptOffer = useArcana((s) => s.acceptOffer);

  const heldMinors = useMinorArcana((s) => s.heldIds.length);
  const isFullMinors = heldMinors >= minorCap;
  const grantMinor = useMinorArcana((s) => s.grant);

  const [offers, setOffers] = useState<ParlourOffer[]>([]);
  const [purchased, setPurchased] = useState<Set<number>>(new Set());
  const [voucherOffer, setVoucherOffer] = useState<Voucher | null>(null);
  const [voucherTaken, setVoucherTaken] = useState(false);
  const [freeRerollsUsed, setFreeRerollsUsed] = useState(0);
  const [rngSeed, setRngSeed] = useState(0);

  // Roll a fresh offer table on first mount per visit. Re-mounts (e.g.
  // browser-back) reuse the same offers via React state; that's fine
  // because purchases are already reflected via `purchased`.
  useEffect(() => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    setRngSeed(seed);
    const rng = createRng(seed);
    setOffers(rollMixedOffers(held, rng, offerCount));
    // Pick a random voucher from the unowned pool. If none remain,
    // the voucher offer slot stays null.
    const ownedIds = new Set(ownedVouchers.map((v) => v.id));
    const pool = VOUCHERS.filter((v) => !ownedIds.has(v.id));
    setVoucherOffer(pool.length > 0 ? pool[Math.floor(rng() * pool.length)]! : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reroll() {
    const freeAvailable = freeRerollsUsed < voucherEffects.freeRerolls;
    if (!freeAvailable && balance < REROLL_PRICE) return;
    if (!freeAvailable) {
      if (!spend(REROLL_PRICE)) return;
    } else {
      setFreeRerollsUsed(freeRerollsUsed + 1);
    }
    // Bump the rng seed so the next roll differs deterministically.
    const seed = (rngSeed + 1) >>> 0;
    setRngSeed(seed);
    const rng = createRng(seed);
    // Exclude held + already-purchased Majors so we don't re-offer
    // what the player just bought.
    const purchasedMajors: Arcana[] = [];
    offers.forEach((o, i) => {
      if (purchased.has(i) && o.kind === "major") purchasedMajors.push(o.arcana);
    });
    setOffers(rollMixedOffers([...held, ...purchasedMajors], rng, offerCount));
    setPurchased(new Set()); // fresh roll → fresh purchase tracking
  }

  function buy(offer: ParlourOffer, idx: number) {
    if (purchased.has(idx)) return;
    const price = priceOf(offer);
    if (offer.kind === "major") {
      if (isFullMajors) return;
      if (!spend(price)) return;
      acceptOffer(offer.arcana.id, handCap);
    } else {
      if (isFullMinors) return;
      if (!spend(price)) return;
      grantMinor(offer.minor.id, minorCap);
    }
    const next = new Set(purchased);
    next.add(idx);
    setPurchased(next);
  }

  function buyTheVoucher() {
    if (!voucherOffer) return;
    if (voucherTaken) return;
    if (!spend(voucherOffer.price)) return;
    buyVoucher(voucherOffer.id);
    setVoucherTaken(true);
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

  const freeRerollAvailable =
    freeRerollsUsed < voucherEffects.freeRerolls;
  const canReroll =
    freeRerollAvailable || balance >= REROLL_PRICE;

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
        {isFullMajors ? (
          <p class="parlour__notice">Your Arcana hand is full — Majors are sealed.</p>
        ) : null}
      </header>

      <section class="parlour__shelf" aria-label="Offers">
        {offers.map((offer, idx) => {
          const bought = purchased.has(idx);
          const price = priceOf(offer);
          const affordable = balance >= price;
          const handBlocked =
            offer.kind === "major" ? isFullMajors : isFullMinors;
          const disabled = bought || handBlocked || !affordable;
          return (
            <div class="parlour__card-wrap" key={`${idx}-${offer.kind}`}>
              <OfferCard
                offer={offer}
                price={price}
                disabled={disabled}
                bought={bought}
                handBlocked={handBlocked}
                affordable={affordable}
                onBuy={() => buy(offer, idx)}
              />
            </div>
          );
        })}
      </section>

      {voucherOffer ? (
        <section class="parlour__voucher" aria-label="Voucher offer">
          <p class="eyebrow">Voucher</p>
          <VoucherOffer
            voucher={voucherOffer}
            taken={voucherTaken}
            affordable={balance >= voucherOffer.price}
            onBuy={buyTheVoucher}
          />
        </section>
      ) : null}

      <section class="parlour__reroll" aria-label="Reroll">
        <button
          type="button"
          class="btn btn--ghost parlour__reroll-btn"
          disabled={!canReroll}
          onClick={reroll}
          aria-label={
            freeRerollAvailable
              ? "Reroll the offers — free, from the Mystic Mirror"
              : `Reroll the offers for ${REROLL_PRICE} coins`
          }
        >
          {freeRerollAvailable
            ? "↻ Reroll (free · Mystic Mirror)"
            : `↻ Reroll · ${REROLL_PRICE} ☉`}
        </button>
        {voucherEffects.freeRerolls > 0 && !freeRerollAvailable ? (
          <p class="parlour__reroll-note script">
            mirror spent · pay the next reroll
          </p>
        ) : null}
      </section>

      <footer class="parlour__foot">
        <button type="button" class="btn btn--primary" onClick={leave}>
          {nextChamber ? "Onward" : "Back to the path"}
        </button>
      </footer>
    </main>
  );
}

function OfferCard({
  offer,
  price,
  disabled,
  bought,
  handBlocked,
  affordable,
  onBuy,
}: {
  offer: ParlourOffer;
  price: number;
  disabled: boolean;
  bought: boolean;
  handBlocked: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  if (offer.kind === "major") return MajorOffer({
    arcana: offer.arcana,
    price,
    disabled,
    bought,
    handBlocked,
    affordable,
    onBuy,
  });
  return MinorOffer({
    minor: offer.minor,
    price,
    disabled,
    bought,
    handBlocked,
    affordable,
    onBuy,
  });
}

function MajorOffer({
  arcana,
  price,
  disabled,
  bought,
  handBlocked,
  affordable,
  onBuy,
}: {
  arcana: Arcana;
  price: number;
  disabled: boolean;
  bought: boolean;
  handBlocked: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  return (
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
              {price} <span class="parlour__price-label">coins · Major</span>
            </span>
            <button
              type="button"
              class="btn btn--primary btn--on-card parlour__buy"
              disabled={disabled}
              onClick={onBuy}
            >
              {bought
                ? "Taken"
                : handBlocked
                  ? "Hand full"
                  : !affordable
                    ? "Too dear"
                    : "Take it"}
            </button>
          </div>
        </>
      }
    />
  );
}

function MinorOffer({
  minor,
  price,
  disabled,
  bought,
  handBlocked,
  affordable,
  onBuy,
}: {
  minor: MinorArcana;
  price: number;
  disabled: boolean;
  bought: boolean;
  handBlocked: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  return (
    <TarotCard
      numeral={minor.numeral}
      panelName={minor.name}
      panelCaption="consumable"
      headline={minor.name}
      script={minor.name.toLowerCase()}
      subtitle={minor.flavor}
      panelColor={minor.panelColor}
      figure={<MinorGlyph />}
      className={`parlour-card-minor${bought ? " card--disabled" : ""}`}
      footer={
        <>
          <p class="parlour__effect">{minor.description}</p>
          <div class="parlour__price-row">
            <span class="parlour__price tabular">
              {price} <span class="parlour__price-label">coins · Minor</span>
            </span>
            <button
              type="button"
              class="btn btn--primary btn--on-card parlour__buy"
              disabled={disabled}
              onClick={onBuy}
            >
              {bought
                ? "Taken"
                : handBlocked
                  ? "Tray full"
                  : !affordable
                    ? "Too dear"
                    : "Take it"}
            </button>
          </div>
        </>
      }
    />
  );
}

function VoucherOffer({
  voucher,
  taken,
  affordable,
  onBuy,
}: {
  voucher: Voucher;
  taken: boolean;
  affordable: boolean;
  onBuy: () => void;
}) {
  return (
    <div class="parlour__voucher-card" style={{ "--card-panel": voucher.panelColor }}>
      <div class="parlour__voucher-head">
        <p class="eyebrow">Permanent</p>
        <p class="parlour__voucher-name">{voucher.name}</p>
      </div>
      <p class="parlour__voucher-desc">{voucher.description}</p>
      <p class="parlour__voucher-flavor script">{voucher.flavor}</p>
      <div class="parlour__price-row">
        <span class="parlour__price tabular">
          {voucher.price}{" "}
          <span class="parlour__price-label">coins · Voucher</span>
        </span>
        <button
          type="button"
          class="btn btn--primary parlour__buy"
          disabled={taken || !affordable}
          onClick={onBuy}
        >
          {taken ? "Owned" : !affordable ? "Too dear" : "Take it"}
        </button>
      </div>
    </div>
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

/** Glyph for a Minor offer card — a small coin with a flame, denoting
 *  "consumable" rather than the dealer-vignette of Majors. */
function MinorGlyph() {
  return (
    <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
      <circle cx="60" cy="80" r="24" />
      <circle cx="60" cy="80" r="18" fill="var(--card-panel, transparent)" />
      {/* Flame above */}
      <path d="M60 28c6 12 16 16 16 30a16 16 0 0 1-32 0c0-14 10-18 16-30z" />
      <path
        d="M60 44c3 6 6 8 6 14a6 6 0 0 1-12 0c0-6 3-8 6-14z"
        fill="var(--card-panel, transparent)"
      />
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

export { MAX_HELD_ARCANA, MINOR_PRICE, REROLL_PRICE };
