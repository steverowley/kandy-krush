export const LEVELS = [
  {
    id: 1,
    name: 'First steps',
    moves: 20,
    objective: { kind: 'score', target: 400 },
    hint: 'Reach 400 points',
  },
  {
    id: 2,
    name: 'Sunshine chase',
    moves: 20,
    objective: { kind: 'clearType', type: 0, target: 12 },
    hint: 'Clear 12 yellow circles',
  },
  {
    id: 3,
    name: 'Ocean wave',
    moves: 22,
    objective: { kind: 'clearType', type: 1, target: 15 },
    hint: 'Clear 15 blue squares',
  },
  {
    id: 4,
    name: 'Patience',
    moves: 18,
    objective: { kind: 'matches', target: 10 },
    hint: 'Make 10 matches',
  },
  {
    id: 5,
    name: 'First special',
    moves: 20,
    objective: { kind: 'specials', target: 1 },
    hint: 'Make one special candy (4 in a row)',
  },
  {
    id: 6,
    name: 'Big spender',
    moves: 25,
    objective: { kind: 'score', target: 1500 },
    hint: 'Reach 1,500 points',
  },
  {
    id: 7,
    name: 'Rainbow chaser',
    moves: 25,
    objective: { kind: 'specials', target: 2 },
    hint: 'Make two special candies',
  },
  {
    id: 8,
    name: 'Grand finale',
    moves: 30,
    objective: { kind: 'score', target: 3000 },
    hint: 'Reach 3,000 points',
  },
  {
    id: 9,
    name: 'Sweet jelly',
    moves: 22,
    objective: { kind: 'clearJelly' },
    hint: 'Clear all the jelly',
    obstacles: {
      jelly: [
        [1, 1, 1], [4, 1, 1],
        [2, 3, 1], [3, 3, 1],
        [1, 5, 1], [4, 5, 1],
      ],
    },
  },
  {
    id: 10,
    name: 'Big jelly',
    moves: 30,
    objective: { kind: 'clearJelly' },
    hint: 'Clear all the jelly (some takes two hits!)',
    obstacles: {
      jelly: [
        [0, 0, 2], [5, 0, 2],
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
        [0, 5, 2], [5, 5, 2],
      ],
    },
  },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

export function nextLevelId(id) {
  const idx = LEVELS.findIndex((l) => l.id === id);
  if (idx < 0 || idx >= LEVELS.length - 1) return null;
  return LEVELS[idx + 1].id;
}

export function isLastLevel(id) {
  return nextLevelId(id) === null;
}

export function progressTowardObjective(level, score, progress) {
  if (!level) return { current: 0, target: 0, done: false };
  const o = level.objective;
  switch (o.kind) {
    case 'score':
      return { current: score, target: o.target, done: score >= o.target };
    case 'clearType': {
      const c = progress.type[o.type] || 0;
      return { current: c, target: o.target, done: c >= o.target };
    }
    case 'matches':
      return {
        current: progress.matches,
        target: o.target,
        done: progress.matches >= o.target,
      };
    case 'specials':
      return {
        current: progress.specials,
        target: o.target,
        done: progress.specials >= o.target,
      };
    case 'clearJelly': {
      const total = progress.jellyTotal || 0;
      const remaining = progress.jellyRemaining || 0;
      return {
        current: Math.max(0, total - remaining),
        target: total,
        done: total > 0 && remaining === 0,
      };
    }
  }
  return { current: 0, target: 0, done: false };
}

export function starsForLevel(level, movesRemaining) {
  if (!level) return 0;
  const ratio = movesRemaining / level.moves;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}
