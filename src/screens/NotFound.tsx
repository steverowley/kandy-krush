import { useLocation } from "wouter-preact";
import { TarotCard } from "../components/TarotCard";
import { routes } from "../router";

export function NotFound() {
  const [, navigate] = useLocation();

  return (
    <main
      class="screen"
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-6)",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "320px", width: "100%" }}>
        <TarotCard
          numeral="0"
          panelName="Not Found"
          panelCaption="esta carta no existe"
          headline="The Fool"
          script="missing"
          subtitle="el loco · this card was not in the deck"
          panelColor="var(--panel-pink)"
          figure={
            <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
              <path d="M60 28a12 12 0 1 1 0-24 12 12 0 0 1 0 24z" />
              <path d="M44 36c2 8 8 16 16 16s14-8 16-16h-32z" />
              <path d="M40 62l8-2 8 36 8-36 8 2 10 56H30z" />
              <path d="M30 96l-12-30-6 12 8 22 10 4z" />
              <path d="M88 96l12-30 6 12-8 22-10 4z" />
            </svg>
          }
          footer={
            <button
              type="button"
              class="btn btn--on-card btn--primary"
              onClick={() => navigate(routes.home)}
            >
              Return
            </button>
          }
        />
      </div>
    </main>
  );
}
