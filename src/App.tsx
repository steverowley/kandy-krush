import { Route, Router, Switch } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";

import { Splash } from "./screens/Splash";
import { Home } from "./screens/Home";
import { Modes } from "./screens/Modes";
import { Spread } from "./screens/Spread";
import { Play } from "./screens/Play";
import { Settings } from "./screens/Settings";
import { About } from "./screens/About";
import { NotFound } from "./screens/NotFound";
import { routes } from "./router";

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path={routes.splash} component={Splash} />
        <Route path={routes.home} component={Home} />
        <Route path={routes.modes} component={Modes} />
        <Route path={routes.spread} component={Spread} />
        <Route path={routes.play} component={Play} />
        <Route path={routes.settings} component={Settings} />
        <Route path={routes.about} component={About} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}
