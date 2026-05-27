import { describe, expect, it } from "vitest";
import { buildShareText } from "../game/share";
import { LEVELS } from "../game/levels";
import { CHAMBER_COUNT } from "../game/querent";

describe("buildShareText", () => {
  const empty = {
    spreadStars: {},
    querentMeta: { bestDepth: 0, runsCompleted: 0, insight: 0 },
    dailyRuns: [],
  };

  it("renders a sensible blank state", () => {
    const text = buildShareText(empty);
    expect(text).toContain("Arcana Cascada");
    expect(text).toContain(`0 / ${LEVELS.length * 3} stars`);
    expect(text).toContain(`depth 0 / ${CHAMBER_COUNT}`);
    expect(text).toContain("0 days");
  });

  it("sums spread stars across chapters", () => {
    const text = buildShareText({
      ...empty,
      spreadStars: { "i": 3, "ii": 2, "iii": 1 },
    });
    expect(text).toContain(`6 / ${LEVELS.length * 3} stars`);
  });

  it("counts only finished daily runs, ignores in-progress", () => {
    const text = buildShareText({
      ...empty,
      dailyRuns: [
        { outcome: "won", finalScore: 1000 },
        { outcome: "lost", finalScore: 200 },
        { outcome: "in-progress", finalScore: 999 },
      ],
    });
    expect(text).toContain("2 days");
    expect(text).toContain("1,200 fortune");
  });

  it("formats large insight with thousands separator", () => {
    const text = buildShareText({
      ...empty,
      querentMeta: { bestDepth: 7, runsCompleted: 4, insight: 12345 },
    });
    expect(text).toContain("12,345 insight");
  });

  it("produces a stable line shape", () => {
    const text = buildShareText(empty);
    const lines = text.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Arcana Cascada — my readings");
  });
});
