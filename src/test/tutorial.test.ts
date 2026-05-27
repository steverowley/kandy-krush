import { describe, expect, it, beforeEach } from "vitest";
import { useTutorial } from "../state/tutorial";

describe("useTutorial", () => {
  beforeEach(() => {
    useTutorial.setState({ seen: false });
  });

  it("starts unseen", () => {
    expect(useTutorial.getState().seen).toBe(false);
  });

  it("markSeen flips the flag", () => {
    useTutorial.getState().markSeen();
    expect(useTutorial.getState().seen).toBe(true);
  });

  it("reset restores the unseen state", () => {
    useTutorial.getState().markSeen();
    useTutorial.getState().reset();
    expect(useTutorial.getState().seen).toBe(false);
  });
});
