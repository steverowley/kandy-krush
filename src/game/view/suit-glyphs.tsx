import type { JSX } from "preact";
import type { Suit } from "../engine/types";

type GlyphProps = JSX.SVGAttributes<SVGSVGElement>;

/**
 * Bold filled-silhouette suit illustrations — poster-art style, heavier
 * + more characterful than the early stroke icons. Each glyph keeps its
 * core symbol legible at tile size (32px+) while reading as a small
 * illustration at card size (120px+).
 */

export function CupsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      {/* Chalice bowl */}
      <path d="M12 14h40l-3 24a17 17 0 0 1-34 0z" />
      {/* Knot at the stem */}
      <ellipse cx="32" cy="42" rx="6" ry="3" />
      {/* Stem */}
      <rect x="29" y="44" width="6" height="10" />
      {/* Base */}
      <rect x="18" y="54" width="28" height="5" rx="1" />
      {/* Star above */}
      <path d="M32 4l1.8 4.4 4.8.4-3.6 3.2 1.1 4.6L32 14l-4.1 2.6 1.1-4.6L25.4 8.8l4.8-.4z" />
      {/* Window in the bowl */}
      <circle cx="32" cy="24" r="4" fill="var(--card-panel, transparent)" />
      {/* Droplets */}
      <circle cx="20" cy="18" r="1.5" fill="var(--card-panel, transparent)" />
      <circle cx="44" cy="18" r="1.5" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

export function PentaclesGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      {/* Outer disc */}
      <circle cx="32" cy="32" r="24" />
      {/* Inner ring */}
      <circle cx="32" cy="32" r="20" fill="var(--card-panel, transparent)" />
      <circle cx="32" cy="32" r="18" />
      {/* Five-point star inset */}
      <path
        d="M32 16l4.5 9.6L47 27 39 34l2 11-9-5.5L23 45l2-11-8-7 10.5-1.4z"
        fill="var(--card-panel, transparent)"
      />
      {/* Center bead */}
      <circle cx="32" cy="32" r="2.5" />
    </svg>
  );
}

export function SwordsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      {/* Tip flare */}
      <path d="M30 4l2-3 2 3 1 4-3 1-3-1z" />
      {/* Blade */}
      <path d="M28 8h8l2 32H26z" />
      {/* Fuller on the blade */}
      <rect
        x="31"
        y="12"
        width="2"
        height="22"
        fill="var(--card-panel, transparent)"
      />
      {/* Cross-guard */}
      <rect x="14" y="40" width="36" height="5" rx="1" />
      {/* Guard finials */}
      <circle cx="14" cy="42.5" r="3" />
      <circle cx="50" cy="42.5" r="3" />
      {/* Grip */}
      <rect x="29" y="46" width="6" height="10" />
      {/* Pommel */}
      <circle cx="32" cy="58" r="4" />
      <circle cx="32" cy="58" r="1.6" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

export function WandsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      {/* Outer flame petals */}
      <path d="M32 2c5 8 10 11 10 18a10 10 0 0 1-20 0c0-7 5-10 10-18z" />
      {/* Inner flame */}
      <path
        d="M32 12c2.5 5 5 6.5 5 11a5 5 0 0 1-10 0c0-4.5 2.5-6 5-11z"
        fill="var(--card-panel, transparent)"
      />
      {/* Core spark */}
      <circle cx="32" cy="18" r="1.6" />
      {/* Wand body */}
      <rect x="29" y="22" width="6" height="32" rx="1" />
      {/* Decorative bands */}
      <rect x="27" y="28" width="10" height="2" />
      <rect x="27" y="46" width="10" height="2" />
      {/* Base */}
      <path d="M24 54h16l-2 6H26z" />
      {/* Embers */}
      <circle cx="14" cy="20" r="1.5" />
      <circle cx="50" cy="20" r="1.5" />
      <circle cx="20" cy="10" r="1.2" />
      <circle cx="44" cy="10" r="1.2" />
    </svg>
  );
}

export function SuitGlyph({ suit, ...rest }: { suit: Suit } & GlyphProps) {
  switch (suit) {
    case "cups":
      return <CupsGlyph {...rest} />;
    case "pentacles":
      return <PentaclesGlyph {...rest} />;
    case "swords":
      return <SwordsGlyph {...rest} />;
    case "wands":
      return <WandsGlyph {...rest} />;
  }
}

/** Each suit's signature panel color. */
export const SUIT_COLORS: Record<Suit, string> = {
  cups: "var(--panel-cobalt)",
  pentacles: "var(--panel-gold)",
  swords: "var(--panel-amethyst)",
  wands: "var(--panel-coral)",
};
