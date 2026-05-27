import type { JSX } from "preact";
import type { Suit } from "../engine/types";

type GlyphProps = JSX.SVGAttributes<SVGSVGElement>;

const STROKE = 1.6;

export function CupsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width={STROKE} stroke-linecap="round" stroke-linejoin="round" {...props}>
      <path d="M14 12h20l-2 14a8 8 0 0 1-16 0z" />
      <path d="M24 26v8" />
      <path d="M18 36h12" />
      <path d="M24 8v2" />
    </svg>
  );
}

export function PentaclesGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width={STROKE} stroke-linecap="round" stroke-linejoin="round" {...props}>
      <circle cx="24" cy="24" r="14" />
      <path d="M24 10l4.04 12.43h13.07l-10.57 7.68 4.04 12.43L24 34.86l-10.57 7.68 4.04-12.43-10.57-7.68h13.07z" />
    </svg>
  );
}

export function SwordsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width={STROKE} stroke-linecap="round" stroke-linejoin="round" {...props}>
      <path d="M24 6v26" />
      <path d="M16 30l8 8 8-8" />
      <path d="M18 14l6-6 6 6" />
      <path d="M19 32h10" />
    </svg>
  );
}

export function WandsGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width={STROKE} stroke-linecap="round" stroke-linejoin="round" {...props}>
      <path d="M10 38L34 14" />
      <path d="M30 10l8 8" />
      <path d="M26 14l8 8" />
      <path d="M14 30l-4 8 8-4" />
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
