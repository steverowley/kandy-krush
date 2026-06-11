import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/preact";
import { App } from "./App";

describe("App", () => {
  it("renders the placeholder heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /new game/i })).toBeDefined();
  });
});
