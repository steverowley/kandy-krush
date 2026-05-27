import type { JSX } from "preact";
import type { Suit } from "../engine/types";

type GlyphProps = JSX.SVGAttributes<SVGSVGElement>;

/**
 * Bold filled-silhouette suit illustrations — heavy poster style. Each
 * is rendered in currentColor so a parent can tint it to the ink color
 * that contrasts the panel behind.
 */

export function CupsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      <path d="M14 14h36l-3 24a16 16 0 0 1-30 0z" />
      <rect x="29" y="40" width="6" height="10" />
      <rect x="20" y="50" width="24" height="4" rx="1" />
      <path d="M32 8c2 2 4 4 2 6s-4-2-2-6z" />
      <circle cx="32" cy="26" r="3" fill="var(--card-panel, transparent)" />
    </svg>
  );
}

export function PentaclesGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      <circle cx="32" cy="32" r="22" />
      <path
        d="M32 14l5.5 16.9h17.8L40.9 41.3l5.5 16.9L32 47.8l-14.4 10.4 5.5-16.9L8.7 30.9h17.8z"
        fill="var(--card-panel, transparent)"
        transform="translate(0,-1) scale(0.78) translate(8.7,7)"
      />
      <circle cx="32" cy="32" r="4" />
    </svg>
  );
}

export function SwordsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      {/* Blade */}
      <path d="M30 6h4l2 32h-8z" />
      {/* Cross-guard */}
      <rect x="20" y="36" width="24" height="4" rx="1" />
      {/* Grip */}
      <rect x="29" y="40" width="6" height="12" />
      {/* Pommel */}
      <circle cx="32" cy="55" r="4" />
      {/* Tip flare */}
      <path d="M28 6l4-4 4 4z" />
    </svg>
  );
}

export function WandsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" {...props}>
      {/* Staff */}
      <rect x="29" y="22" width="6" height="34" rx="1" />
      {/* Flame petals */}
      <path d="M32 4c4 6 8 8 8 14a8 8 0 0 1-16 0c0-6 4-8 8-14z" />
      {/* Inner flame */}
      <path
        d="M32 12c2 4 4 5 4 9a4 4 0 0 1-8 0c0-4 2-5 4-9z"
        fill="var(--card-panel, transparent)"
      />
      {/* Base */}
      <rect x="24" y="55" width="16" height="5" rx="1" />
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

/** Map each suit to its signature panel color. */
export const SUIT_COLORS: Record<Suit, string> = {
  cups: "var(--panel-cobalt)",
  pentacles: "var(--panel-gold)",
  swords: "var(--panel-amethyst)",
  wands: "var(--panel-coral)",
};
