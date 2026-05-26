import { render } from "preact";
import { App } from "./App";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing from index.html");

render(<App />, root);
