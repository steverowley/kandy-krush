import { Component, type ComponentChildren } from "preact";
import { TarotCard } from "./TarotCard";

type Props = {
  children: ComponentChildren;
};

type State = {
  err: Error | null;
};

/**
 * Top-level error boundary. Catches uncaught render-time errors and
 * renders a TarotCard fallback so the player can return to the lobby
 * without a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error) {
    // The local telemetry bus is the only sink, and it might itself
    // throw on a corrupt localStorage — best-effort log.
    try {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary caught", err);
    } catch {
      /* ignore */
    }
  }

  reset = () => {
    this.setState({ err: null });
    window.location.hash = "#/home";
  };

  render() {
    if (this.state.err) {
      return (
        <main
          class="screen"
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ maxWidth: "360px", width: "100%" }}>
            <TarotCard
              numeral="?"
              panelName="Misread"
              panelCaption="algo se ha torcido"
              headline="Broken"
              script="misread"
              subtitle="something went sideways — let's start the reading again"
              panelColor="var(--panel-coral)"
              figure={
                <svg viewBox="0 0 120 140" fill="currentColor" class="card__figure-svg">
                  <circle cx="60" cy="60" r="40" />
                  <circle cx="48" cy="52" r="6" fill="var(--card-panel, transparent)" />
                  <circle cx="72" cy="52" r="6" fill="var(--card-panel, transparent)" />
                  <path
                    d="M44 84c4-6 10-8 16-8s12 2 16 8"
                    stroke="var(--card-panel, transparent)"
                    stroke-width="4"
                    fill="none"
                    stroke-linecap="round"
                  />
                  <path
                    d="M28 110l64-12"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                </svg>
              }
              footer={
                <button
                  type="button"
                  class="btn btn--on-card btn--primary"
                  onClick={this.reset}
                >
                  Return to the Reading Room
                </button>
              }
            />
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
