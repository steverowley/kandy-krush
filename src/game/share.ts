import { LEVELS } from "./levels";
import { CHAMBER_COUNT } from "./querent";

export type ShareInput = {
  spreadStars: Record<string, number>;
  querentMeta: {
    bestDepth: number;
    runsCompleted: number;
    insight: number;
  };
  dailyRuns: ReadonlyArray<{ outcome: string; finalScore: number }>;
};

export function buildShareText(input: ShareInput): string {
  const spreadTotal = Object.values(input.spreadStars).reduce<number>(
    (a, b) => a + b,
    0,
  );
  const spreadPossible = LEVELS.length * 3;

  const completedDaily = input.dailyRuns.filter(
    (r) => r.outcome !== "in-progress",
  );
  const dailyTotal = completedDaily.reduce((a, b) => a + b.finalScore, 0);

  return [
    "Arcana Cascada — my readings",
    `The Spread · ${spreadTotal} / ${spreadPossible} stars`,
    `The Querent's Path · depth ${input.querentMeta.bestDepth} / ${CHAMBER_COUNT} · ${input.querentMeta.runsCompleted} runs · ${input.querentMeta.insight.toLocaleString()} insight`,
    `Daily Draw · ${completedDaily.length} days · ${dailyTotal.toLocaleString()} fortune`,
  ].join("\n");
}
