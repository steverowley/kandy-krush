import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { App } from "../App";

function gotoHash(hash: string) {
  window.location.hash = hash;
}

describe("Router", () => {
  beforeEach(() => {
    gotoHash("");
  });

  it("renders the Splash on root", () => {
    render(<App />);
    expect(screen.getByText("Begin the Reading")).toBeTruthy();
  });

  it("renders Home on #/home", () => {
    gotoHash("#/home");
    render(<App />);
    expect(screen.getByText("Choose your spread.")).toBeTruthy();
  });

  it("renders About on #/about", () => {
    gotoHash("#/about");
    render(<App />);
    expect(screen.getByText("Colophon")).toBeTruthy();
  });

  it("renders NotFound on an unknown hash", () => {
    gotoHash("#/this-card-is-not-real");
    render(<App />);
    expect(screen.getByText("The Fool's Page")).toBeTruthy();
  });
});
