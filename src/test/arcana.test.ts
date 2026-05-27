import { describe, expect, it, beforeEach } from "vitest";
import {
  MAJOR_ARCANA,
  MAX_HELD_ARCANA,
  applyArcanaToStep,
  arcanaById,
  rollDraw,
} from "../game/arcana";
import { createRng } from "../game/engine/rng";
import { useArcana } from "../state/arcana";
import type { CascadeStep, MatchGroup, Suit } from "../game/engine/types";

function step(
  matches: Array<{ suit: Suit; cells: number }>,
  overrides: Partial<CascadeStep> = {},
): CascadeStep {
  const groups: MatchGroup[] = matches.map((m) => ({
    suit: m.suit,
    cells: Array.from({ length: m.cells }, (_, i) => ({ row: 0, col: i })),
  }));
  const totalCells = matches.reduce((a, m) => a + m.cells, 0);
  return {
    matches: groups,
    depth: 1,
    chips: totalCells * 10,
    mult: matches.reduce(
      (a, m) =>
        a +
        (m.cells >= 6 ? 20 : m.cells >= 5 ? 8 : m.cells >= 4 ? 4 : 2),
      0,
    ),
    scoreGained: 0,
    ...overrides,
  };
}

const META = (over: Partial<Parameters<typeof applyArcanaToStep>[2]> = {}) => ({
  depth: 1,
  movesUsed: 0,
  totalMoves: 12,
  ...over,
});

describe("MAJOR_ARCANA data", () => {
  it("has at least twelve arcana", () => {
    expect(MAJOR_ARCANA.length).toBeGreaterThanOrEqual(12);
  });
  it("each arcana has a unique id", () => {
    const ids = MAJOR_ARCANA.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("each declares a panel color token", () => {
    for (const a of MAJOR_ARCANA) {
      expect(a.panelColor).toMatch(/^var\(--panel-/);
    }
  });
});

describe("arcanaById", () => {
  it("returns the matching arcana", () => {
    expect(arcanaById("magician")?.name).toBe("The Magician");
  });
  it("returns undefined for unknown ids", () => {
    expect(arcanaById("not-a-card" as never)).toBeUndefined();
  });
});

describe("rollDraw", () => {
  it("returns the requested count", () => {
    const rng = createRng(1);
    expect(rollDraw(MAJOR_ARCANA, [], rng, 3)).toHaveLength(3);
  });
  it("excludes already-held arcana", () => {
    const rng = createRng(1);
    const held = [MAJOR_ARCANA[0]!];
    const out = rollDraw(MAJOR_ARCANA, held, rng, 3);
    expect(out.map((a) => a.id)).not.toContain(held[0]!.id);
  });
  it("is deterministic for a given seed", () => {
    const a = rollDraw(MAJOR_ARCANA, [], createRng(42), 3);
    const b = rollDraw(MAJOR_ARCANA, [], createRng(42), 3);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe("applyArcanaToStep — The Magician", () => {
  const magician = arcanaById("magician")!;

  it("adds 30 chips per Wand cell", () => {
    const s = step([{ suit: "wands", cells: 4 }]); // chips=40 mult=4
    const out = applyArcanaToStep(s, [magician], META());
    // 4 wand cells × 30 = 120 chips bonus.
    expect(out.chips).toBe(40 + 120);
    expect(out.mult).toBe(4);
    expect(out.scoreGained).toBe(out.chips * out.mult);
  });

  it("doesn't change a Cup-only step", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = applyArcanaToStep(s, [magician], META());
    expect(out.chips).toBe(30);
    expect(out.mult).toBe(2);
  });
});

describe("applyArcanaToStep — Strength", () => {
  const strength = arcanaById("strength")!;
  it("adds +2 mult per match of size 4+", () => {
    const s = step([
      { suit: "cups", cells: 3 },
      { suit: "wands", cells: 4 },
      { suit: "swords", cells: 5 },
    ]);
    // base mult: 2 + 4 + 8 = 14
    // bonus: 2 matches of size ≥4 → +4
    const out = applyArcanaToStep(s, [strength], META());
    expect(out.mult).toBe(14 + 4);
  });
});

describe("applyArcanaToStep — The Sun", () => {
  const sun = arcanaById("sun")!;
  it("adds 50 chips on the first cascade step", () => {
    const s = step([{ suit: "cups", cells: 3 }], { depth: 1 });
    const out = applyArcanaToStep(s, [sun], META({ depth: 1 }));
    expect(out.chips).toBe(30 + 50);
  });
  it("does NOT add chips on a chained step", () => {
    const s = step([{ suit: "cups", cells: 3 }], { depth: 2 });
    const out = applyArcanaToStep(s, [sun], META({ depth: 2 }));
    expect(out.chips).toBe(30);
  });
});

describe("applyArcanaToStep — The World", () => {
  const world = arcanaById("world")!;
  it("does not multiply before half-budget", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = applyArcanaToStep(s, [world], META({ movesUsed: 3, totalMoves: 12 }));
    expect(out.mult).toBe(2);
  });
  it("multiplies mult by 1.25 once half budget is spent", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = applyArcanaToStep(s, [world], META({ movesUsed: 6, totalMoves: 12 }));
    // 2 * 1.25 = 2.5 → round = 3
    expect(out.mult).toBe(3);
  });
  it("no-ops when totalMoves is null", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = applyArcanaToStep(s, [world], META({ totalMoves: null }));
    expect(out.mult).toBe(2);
  });
});

describe("applyArcanaToStep — The Fool", () => {
  const fool = arcanaById("fool")!;
  it("triples chips on the first cascade step", () => {
    const s = step([{ suit: "cups", cells: 3 }], { depth: 1 });
    const out = applyArcanaToStep(s, [fool], META({ depth: 1 }));
    expect(out.chips).toBe(90);
  });
  it("does nothing on cascade depth >= 2", () => {
    const s = step([{ suit: "cups", cells: 3 }], { depth: 2 });
    const out = applyArcanaToStep(s, [fool], META({ depth: 2 }));
    expect(out.chips).toBe(30);
  });
});

describe("applyArcanaToStep — The Empress", () => {
  const empress = arcanaById("empress")!;
  it("adds 20 chips per Cup cell", () => {
    const s = step([{ suit: "cups", cells: 4 }]); // base chips 40
    const out = applyArcanaToStep(s, [empress], META());
    expect(out.chips).toBe(40 + 80);
  });
  it("ignores non-Cup matches", () => {
    const s = step([{ suit: "wands", cells: 3 }]);
    const out = applyArcanaToStep(s, [empress], META());
    expect(out.chips).toBe(30);
  });
});

describe("applyArcanaToStep — The Lovers", () => {
  const lovers = arcanaById("lovers")!;
  it("multiplies mult by 1.5 when Cups AND Wands both match", () => {
    const s = step([
      { suit: "cups", cells: 3 },
      { suit: "wands", cells: 3 },
    ]);
    // base mult: 2 + 2 = 4
    const out = applyArcanaToStep(s, [lovers], META());
    expect(out.mult).toBe(6); // 4 * 1.5
  });
  it("does nothing when only Cups match", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = applyArcanaToStep(s, [lovers], META());
    expect(out.mult).toBe(2);
  });
  it("does nothing when only Wands match", () => {
    const s = step([{ suit: "wands", cells: 3 }]);
    const out = applyArcanaToStep(s, [lovers], META());
    expect(out.mult).toBe(2);
  });
});

describe("applyArcanaToStep — The Chariot", () => {
  const chariot = arcanaById("chariot")!;
  it("adds +3 mult per cascade depth", () => {
    const s1 = step([{ suit: "cups", cells: 3 }], { depth: 1 });
    const out1 = applyArcanaToStep(s1, [chariot], META({ depth: 1 }));
    expect(out1.mult).toBe(2 + 3); // depth 1 → +3
    const s3 = step([{ suit: "cups", cells: 3 }], { depth: 3 });
    const out3 = applyArcanaToStep(s3, [chariot], META({ depth: 3 }));
    expect(out3.mult).toBe(2 + 9); // depth 3 → +9
  });
});

describe("applyArcanaToStep — The Hermit", () => {
  const hermit = arcanaById("hermit")!;
  it("multiplies mult by 1+0.5×empty when slots are open", () => {
    const s = step([{ suit: "cups", cells: 3 }]); // base mult 2
    // Holding only Hermit (1 of 5 slots filled) → 4 empty slots → ×3
    const out = applyArcanaToStep(s, [hermit], META());
    expect(out.mult).toBe(Math.round(2 * 3));
  });
  it("no-op when slots are full (heldCount === MAX_HELD_ARCANA)", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const fullHand = [
      arcanaById("hermit")!,
      arcanaById("magician")!,
      arcanaById("empress")!,
      arcanaById("lovers")!,
      arcanaById("chariot")!,
    ];
    // Only the Hermit's apply contributes here; others would touch
    // mult/chips but for this test we just verify Hermit's branch.
    // Strip the others by passing only hermit but with heldCount=MAX.
    // Easier: use the full hand directly and assert the final mult is
    // unchanged from a hand-without-hermit's mult.
    const withoutHermit = fullHand.slice(1);
    const withoutOut = applyArcanaToStep(s, withoutHermit, META());
    const withOut = applyArcanaToStep(s, fullHand, META());
    expect(withOut.mult).toBe(withoutOut.mult);
  });
});

describe("applyArcanaToStep — Death", () => {
  const death = arcanaById("death")!;
  it("adds +1 mult per cleared cell across all matches", () => {
    const s = step([
      { suit: "cups", cells: 3 },
      { suit: "wands", cells: 4 },
    ]); // base mult 2+4=6, 7 cells total
    const out = applyArcanaToStep(s, [death], META());
    expect(out.mult).toBe(6 + 7);
  });
});

describe("Death.postMove — board-modifying wiring", () => {
  const death = arcanaById("death")!;

  function makeBoard(rows: string[]) {
    const cols = rows[0]!.length;
    const charToSuit = (ch: string): Suit => {
      switch (ch) {
        case "c": return "cups";
        case "p": return "pentacles";
        case "s": return "swords";
        case "w": return "wands";
        default: throw new Error(`bad suit ${ch}`);
      }
    };
    const tiles = rows.flatMap((r, ri) =>
      r.split("").map((ch, ci) => ({
        id: ri * cols + ci + 1,
        suit: charToSuit(ch),
      })),
    );
    return { rows: rows.length, cols, tiles };
  }

  it("returns a single in-bounds cell each call", () => {
    const board = makeBoard(["cpsw", "wpsw", "spwc"]);
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) {
      const cells = death.postMove!(board, rng);
      expect(cells).toHaveLength(1);
      const c = cells[0]!;
      expect(c.row).toBeGreaterThanOrEqual(0);
      expect(c.row).toBeLessThan(board.rows);
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col).toBeLessThan(board.cols);
    }
  });

  it("removes the picked tile when fed through destroyCells", async () => {
    const { destroyCells } = await import("../game/engine/cascade");
    const board = makeBoard(["cpsw", "wpsw", "spwc", "cwps"]);
    const idsBefore = new Set(board.tiles.map((t) => t.id));
    const rng = createRng(11);
    const cells = death.postMove!(board, rng);
    const targetId = board.tiles[cells[0]!.row * board.cols + cells[0]!.col]!.id;
    const { board: out } = destroyCells(board, rng, cells);
    const idsAfter = new Set(out.tiles.map((t) => t!.id));
    expect(idsBefore.has(targetId)).toBe(true);
    expect(idsAfter.has(targetId)).toBe(false);
  });
});

describe("applyArcanaToStep — The Tower", () => {
  const tower = arcanaById("tower")!;
  it("multiplies mult by 1.3 on a boss chamber", () => {
    const s = step([{ suit: "cups", cells: 3 }]); // base mult 2
    const out = applyArcanaToStep(s, [tower], META({ isBoss: true }));
    expect(out.mult).toBe(Math.round(2 * 1.3));
  });
  it("no-op off a boss chamber", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = applyArcanaToStep(s, [tower], META({ isBoss: false }));
    expect(out.mult).toBe(2);
  });
});

describe("applyArcanaToStep — stacking order", () => {
  it("Strength then World: World multiplies the already-boosted mult", () => {
    const s = step([{ suit: "wands", cells: 4 }]);
    // base: chips 40, mult 4
    // strength: +2 mult per ≥4 match → mult 4+2=6
    // world (halfway): mult 6 * 1.25 = 7.5 → 8
    const strength = arcanaById("strength")!;
    const world = arcanaById("world")!;
    const out = applyArcanaToStep(s, [strength, world], META({ movesUsed: 6, totalMoves: 12 }));
    expect(out.mult).toBe(8);
  });
});

describe("useArcana store", () => {
  beforeEach(() => {
    useArcana.getState().reset();
  });

  it("starts with empty held + offered", () => {
    expect(useArcana.getState().heldIds).toEqual([]);
    expect(useArcana.getState().offeredIds).toEqual([]);
  });

  it("rollOffer with a seed yields a stable trio", () => {
    useArcana.getState().rollOffer(123);
    const first = useArcana.getState().offeredIds.slice();
    useArcana.getState().reset();
    useArcana.getState().rollOffer(123);
    expect(useArcana.getState().offeredIds).toEqual(first);
  });

  it("acceptOffer moves the picked arcana to held + clears offered", () => {
    useArcana.getState().rollOffer(7);
    const id = useArcana.getState().offeredIds[0]!;
    useArcana.getState().acceptOffer(id);
    expect(useArcana.getState().heldIds).toContain(id);
    expect(useArcana.getState().offeredIds).toEqual([]);
  });

  it("skipOffer clears offered without adding to held", () => {
    useArcana.getState().rollOffer(7);
    useArcana.getState().skipOffer();
    expect(useArcana.getState().heldIds).toEqual([]);
    expect(useArcana.getState().offeredIds).toEqual([]);
  });

  it("isFull is true once MAX_HELD_ARCANA cards are held", () => {
    const ids = MAJOR_ARCANA.slice(0, MAX_HELD_ARCANA).map((a) => a.id);
    useArcana.setState({ heldIds: ids });
    expect(useArcana.getState().isFull()).toBe(true);
  });

  it("acceptOffer is a no-op when full", () => {
    const ids = MAJOR_ARCANA.slice(0, MAX_HELD_ARCANA).map((a) => a.id);
    useArcana.setState({ heldIds: ids, offeredIds: [MAJOR_ARCANA[0]!.id] });
    useArcana.getState().acceptOffer(MAJOR_ARCANA[0]!.id);
    expect(useArcana.getState().heldIds).toEqual(ids); // unchanged
    expect(useArcana.getState().offeredIds).toEqual([]); // offer cleared
  });

  it("held() rehydrates arcana objects from stored ids", () => {
    useArcana.setState({ heldIds: ["magician"] });
    const held = useArcana.getState().held();
    expect(held).toHaveLength(1);
    expect(held[0]!.name).toBe("The Magician");
  });

  it("filters out unknown ids gracefully (forward-compat for removed arcana)", () => {
    useArcana.setState({ heldIds: ["magician", "not-real" as never] });
    expect(useArcana.getState().held().map((a) => a.id)).toEqual(["magician"]);
  });
});
