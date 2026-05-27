import type { ComponentChildren, JSX } from "preact";

/**
 * The TarotCard chassis. Renders the cream cardstock frame, corner ticks,
 * inner colored panel, optional cursive flourish behind the figure, and
 * the multilingual headline stack underneath.
 *
 * Use it directly to compose mode cards, chapter cards, class cards,
 * and the win/loss "card revealed" outcome modal.
 */
export type TarotCardProps = {
  numeral: string;
  /** The bright headline shown on the colored panel (allcaps sans). */
  panelName: string;
  /** Italic caption inside the panel, wrapped in /slashes/ automatically. */
  panelCaption?: string;
  /** Big heavy-serif name below the panel ("The Devil"). */
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
