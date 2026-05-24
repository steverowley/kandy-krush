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
    tip: 'Match candies on the purple jelly to clear one layer.',
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
    tip: 'Darker jelly needs two hits to clear.',
    obstacles: {
      jelly: [
        [0, 0, 2], [5, 0, 2],
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
        [0, 5, 2], [5, 5, 2],
      ],
    },
  },
  {
    id: 11,
    name: 'Set them free',
    moves: 24,
    objective: { kind: 'score', target: 900 },
    hint: 'Locked tiles need a match to break free. Reach 900 points.',
    tip: 'Locked tiles can’t be swapped. Match next to them to break the chain.',
    obstacles: {
      locks: [
        [2, 1, 1], [3, 1, 1],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 12,
    name: 'Locked vault',
    moves: 30,
    objective: { kind: 'score', target: 1800 },
    hint: 'Some locks take two hits to break! Reach 1,800 points.',
    tip: 'A "2" on a lock badge means it takes two hits to break.',
    obstacles: {
      locks: [
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [2, 0, 1], [3, 0, 1],
        [2, 5, 1], [3, 5, 1],
      ],
    },
  },
  {
    id: 13,
    name: 'Locked yellow',
    moves: 24,
    objective: { kind: 'clearType', type: 0, target: 14 },
    hint: 'Clear 14 yellow circles. Watch out for the locks!',
    obstacles: {
      locks: [
        [1, 2, 1], [4, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 14,
    name: 'Sticky jelly',
    moves: 26,
    objective: { kind: 'clearJelly' },
    hint: 'Clear the jelly — some takes two hits.',
    obstacles: {
      jelly: [
        [0, 1, 1], [5, 1, 1],
        [1, 2, 2], [4, 2, 2],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 15,
    name: 'Crossroads',
    moves: 28,
    objective: { kind: 'score', target: 1600 },
    hint: 'Reach 1,600 with jelly AND locks on the board.',
    tip: 'Jelly AND locks together. Free up the locks first to score faster.',
    obstacles: {
      jelly: [
        [0, 0, 1], [5, 0, 1],
        [0, 5, 1], [5, 5, 1],
      ],
      locks: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 16,
    name: 'Grand puzzle',
    moves: 34,
    objective: { kind: 'score', target: 2800 },
    hint: 'The final challenge: jelly, locks, and a steep target.',
    obstacles: {
      jelly: [
        [1, 0, 2], [4, 0, 2],
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
        [1, 5, 2], [4, 5, 2],
      ],
      locks: [
        [2, 1, 1], [3, 1, 1],
        [2, 4, 2], [3, 4, 2],
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
