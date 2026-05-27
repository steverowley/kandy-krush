import type { ComponentChildren, JSX } from "preact";

/**
 * The TarotCard chassis — modern recruitment-poster tarot.
 *
 * Cream cardstock frame with a gold double-line border. Four sun-ray
 * flourishes anchor the corners. The figure sits inside an arched
 * aperture panel; the per-card accent color shows as a thin stripe
 * across the arch and tints the cursive flourish. Underneath: a Cinzel
 * caps headline, a short gold rule, a cursive echo, and a tiny italic
 * multilingual subtitle.
 *
 * Use it directly to compose mode cards, chapter cards, class cards,
 * and the win/loss "card revealed" outcome modal.
 */
export type TarotCardProps = {
  numeral: string;
  /** The bright headline shown on the colored panel (allcaps caps-serif). */
  panelName: string;
  /** Italic caption inside the panel, wrapped in /slashes/ automatically. */
  panelCaption?: string;
  /** Big caps-serif name below the panel ("THE DEVIL"). */
  headline: string;
  /** Cursive echo overlaid behind the figure ("temptation"). Drawn at
   *  low opacity for ornament. Defaults to the headline. */
  script?: string;
  /** Tiny italic at the bottom — multilingual flavor text. */
  subtitle?: string;
  /** The figure shown on the panel — typically a filled-silhouette SVG. */
  figure: ComponentChildren;
  panelColor?: string;
  /** Optional CTA / footer row beneath the headline. */
  footer?: ComponentChildren;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLElement>, "className" | "onClick">;

export function TarotCard({
  numeral,
  panelName,
  panelCaption,
  headline,
  script,
  subtitle,
  figure,
  panelColor,
  footer,
  className,
  onClick,
  disabled,
}: TarotCardProps) {
  const isInteractive = !!onClick;
  return (
    <article
      class={`card ${className ?? ""} ${disabled ? "card--disabled" : ""}`.trim()}
      style={panelColor ? { "--card-panel": panelColor } : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive && !disabled
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? (disabled ? -1 : 0) : undefined}
    >
      <CornerFlourishes />

      <div class="card__corners">
        <span class="card__corner tick"><CornerMoon /> a.</span>
        <span class="card__numeral numeral">{numeral}</span>
        <span class="card__corner tick">b. <CornerSun /></span>
      </div>

      <div class="card__panel">
        <div class="card__figure">
          <span class="card__script" aria-hidden="true">
            {script ?? headline}
          </span>
          <span class="card__figure-svg-wrap">{figure}</span>
        </div>
        <p class="card__panel-name">{panelName}</p>
        {panelCaption ? (
          <p class="card__panel-caption">{panelCaption}</p>
        ) : null}
      </div>

      <div class="card__foot">
        <h2 class="card__headline">{headline}</h2>
        {script || headline ? (
          <p class="card__echo" aria-hidden="true">
            {script ?? headline.toLowerCase()}
          </p>
        ) : null}
        {subtitle ? <p class="card__subtitle">{subtitle}</p> : null}
        {footer}
      </div>
    </article>
  );
}

/** Four sun-ray flourishes, one in each corner of the card frame. They
 *  sit behind the content (pointer-events disabled) and use the gold
 *  accent for color. */
function CornerFlourishes() {
  return (
    <div class="card__flourishes" aria-hidden="true">
      <SunBurst className="card__flourish card__flourish--tl" />
      <SunBurst className="card__flourish card__flourish--tr" />
      <SunBurst className="card__flourish card__flourish--bl" />
      <SunBurst className="card__flourish card__flourish--br" />
    </div>
  );
}

function SunBurst({ className }: { className?: string }) {
  // 8 rays alternating long/short, with a small disc at center —
  // matches the brief's recruitment-poster "sun-ray flourish" motif.
  return (
    <svg viewBox="0 0 24 24" class={className} fill="none">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <line
          key={deg}
          x1="12"
          y1="12"
          x2="12"
          y2={i % 2 === 0 ? 2 : 5}
          transform={`rotate(${deg} 12 12)`}
          stroke="currentColor"
          stroke-width={i % 2 === 0 ? 1.4 : 1}
          stroke-linecap="round"
        />
      ))}
    </svg>
  );
}

function CornerMoon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor">
      <path d="M9 6a4 4 0 1 1-5-3.87A4 4 0 0 0 9 6z" />
    </svg>
  );
}

function CornerSun() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="6" cy="6" r="2.2" fill="currentColor" />
      <g>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="6"
            y1="6"
            x2="6"
            y2="1.4"
            transform={`rotate(${deg} 6 6)`}
            stroke-linecap="round"
          />
        ))}
      </g>
    </svg>
  );
}
