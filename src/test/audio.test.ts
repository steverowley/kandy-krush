import { describe, expect, it, beforeEach, vi } from "vitest";
import * as haptics from "../audio/haptics";

describe("haptics", () => {
  let vibrateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    haptics.setEnabled(true);
    vibrateMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });
  });

  it("tap fires a short pulse", () => {
    haptics.tap();
    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith(8);
  });

  it("bump fires a medium pulse", () => {
    haptics.bump();
    expect(vibrateMock).toHaveBeenCalledWith(18);
  });

  it("reject fires a stutter pattern", () => {
    haptics.reject();
    expect(vibrateMock).toHaveBeenCalledWith([14, 30, 14]);
  });

  it("win fires a longer celebratory pattern", () => {
    haptics.win();
    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(Array.isArray(vibrateMock.mock.calls[0]![0])).toBe(true);
  });

  it("loss fires a descending pattern", () => {
    haptics.loss();
    expect(vibrateMock).toHaveBeenCalledWith([40, 60, 80]);
  });

  it("no-ops when disabled in settings", () => {
    haptics.setEnabled(false);
    haptics.tap();
    haptics.bump();
    haptics.reject();
    haptics.win();
    haptics.loss();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("no-ops when navigator.vibrate is unavailable", () => {
    haptics.setEnabled(true);
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(() => haptics.tap()).not.toThrow();
    expect(() => haptics.win()).not.toThrow();
  });

  it("swallows vibrate() exceptions silently", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: () => {
        throw new Error("Permission denied");
      },
      configurable: true,
      writable: true,
    });
    expect(() => haptics.tap()).not.toThrow();
    expect(() => haptics.reject()).not.toThrow();
  });
});
