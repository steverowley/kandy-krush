import { Route, Router, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";

import { Splash } from "./screens/Splash";
import { Home } from "./screens/Home";
import { Spread } from "./screens/Spread";
import { Querent } from "./screens/Querent";
import { Play } from "./screens/Play";
import { Draw } from "./screens/Draw";
import { Parlour } from "./screens/Parlour";
import { HowToPlay } from "./screens/HowToPlay";
import { Codex } from "./screens/Codex";
import { Settings } from "./screens/Settings";
import { About } from "./screens/About";
import { NotFound } from "./screens/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { routes } from "./router";

export function App() {
  return (
    <ErrorBoundary>
      <Router hook={useHashLocation}>
        <a class="skip-link" href="#main-content">Skip to main content</a>
        <div id="main-content" tabIndex={-1}>
          <Switch>
            <Route path={routes.splash} component={Splash} />
            <Route path={routes.home} component={Home} />
            <Route path={routes.spread} component={Spread} />
            <Route path={routes.querent} component={Querent} />
            <Route path={routes.play} component={Play} />
            <Route path={routes.draw} component={Draw} />
            <Route path={routes.parlour} component={Parlour} />
            <Route path={routes.howto} component={HowToPlay} />
            <Route path={routes.codex} component={Codex} />
            <Route path={routes.settings} component={Settings} />
            <Route path={routes.about} component={About} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
