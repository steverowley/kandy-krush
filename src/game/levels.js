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
    name: 'Sky climb',
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
    name: 'Twin towers',
    moves: 34,
    objective: { kind: 'score', target: 2800 },
    hint: 'Jelly and locks crowd the board. Reach 2,800.',
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
  {
    id: 17,
    name: 'Quick spark',
    moves: 18,
    objective: { kind: 'score', target: 700 },
    hint: 'Tight 18-move budget. Reach 700 points.',
  },
  {
    id: 18,
    name: 'Sunshine festival',
    moves: 24,
    objective: { kind: 'clearType', type: 0, target: 18 },
    hint: 'Clear 18 yellow circles.',
  },
  {
    id: 19,
    name: 'Make magic',
    moves: 24,
    objective: { kind: 'specials', target: 2 },
    hint: 'Make 2 special candies.',
    tip: 'Match 4 in a row for a striped candy. 5 for a rainbow!',
  },
  {
    id: 20,
    name: 'Match marathon',
    moves: 26,
    objective: { kind: 'matches', target: 16 },
    hint: 'Make 16 matches — every one counts.',
  },
  {
    id: 21,
    name: 'Pink unlock',
    moves: 28,
    objective: { kind: 'clearType', type: 2, target: 16 },
    hint: 'Clear 16 pink triangles. Some are behind locks.',
    obstacles: {
      locks: [
        [1, 2, 1], [4, 2, 1],
        [1, 3, 1], [4, 3, 1],
      ],
    },
  },
  {
    id: 22,
    name: 'Sweet symphony',
    moves: 36,
    objective: { kind: 'score', target: 3000 },
    hint: 'Jelly, locks, and a steep climb to 3,000.',
    tip: 'Take your time — there is no losing, only winning.',
    obstacles: {
      jelly: [
        [0, 1, 2], [5, 1, 2],
        [0, 4, 2], [5, 4, 2],
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
      locks: [
        [1, 0, 1], [4, 0, 1],
        [1, 5, 1], [4, 5, 1],
      ],
    },
  },
  {
    id: 23,
    name: 'Tight squeeze',
    moves: 16,
    objective: { kind: 'score', target: 800 },
    hint: 'Only 16 moves. Make them count.',
  },
  {
    id: 24,
    name: 'Yellow vault',
    moves: 26,
    objective: { kind: 'clearType', type: 0, target: 14 },
    hint: 'Clear 14 yellow circles — but locks guard the corners.',
    obstacles: {
      locks: [
        [0, 0, 1], [5, 0, 1],
        [0, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 25,
    name: 'Ocean swim',
    moves: 26,
    objective: { kind: 'clearType', type: 1, target: 18 },
    hint: 'Clear 18 blue squares — no obstacles, just patience.',
  },
  {
    id: 26,
    name: 'Specials galore',
    moves: 28,
    objective: { kind: 'specials', target: 3 },
    hint: 'Make 3 special candies. Plan those 4-in-a-rows!',
  },
  {
    id: 27,
    name: 'Jelly maze',
    moves: 30,
    objective: { kind: 'clearJelly' },
    hint: 'Ten jelly tiles in a snaking pattern — clear them all.',
    obstacles: {
      jelly: [
        [0, 0, 1], [5, 0, 1],
        [2, 1, 2], [3, 1, 2],
        [1, 3, 1], [4, 3, 1],
        [2, 4, 2], [3, 4, 2],
        [0, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 28,
    name: 'Combo master',
    moves: 32,
    objective: { kind: 'score', target: 2500 },
    hint: 'Reach 2,500 with jelly AND locks. Use those power-ups!',
    obstacles: {
      jelly: [
        [1, 1, 1], [4, 1, 1],
        [1, 4, 1], [4, 4, 1],
      ],
      locks: [
        [0, 2, 2], [5, 2, 2],
        [2, 5, 1], [3, 5, 1],
      ],
    },
  },
  {
    id: 29,
    name: 'Pumpkin spice',
    moves: 24,
    objective: { kind: 'clearType', type: 3, target: 15 },
    hint: 'Clear 15 orange hexagons.',
  },
  {
    id: 30,
    name: 'Pop pop pop',
    moves: 22,
    objective: { kind: 'specials', target: 3 },
    hint: 'Make 3 special candies in 22 moves.',
  },
  {
    id: 31,
    name: 'Meadow stars',
    moves: 24,
    objective: { kind: 'clearType', type: 4, target: 14 },
    hint: 'Clear 14 green stars. Locks guard the corners.',
    obstacles: {
      locks: [
        [0, 0, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 32,
    name: 'Plum punch',
    moves: 26,
    objective: { kind: 'clearType', type: 5, target: 14 },
    hint: 'Clear 14 purple hearts. Some sit on jelly.',
    obstacles: {
      jelly: [
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 33,
    name: 'Match parade',
    moves: 30,
    objective: { kind: 'matches', target: 20 },
    hint: 'Make 20 matches. Quick clears count, big ones count more.',
  },
  {
    id: 34,
    name: 'Lantern light',
    moves: 38,
    objective: { kind: 'score', target: 3500 },
    hint: 'Jelly and locks woven across the board. Reach 3,500.',
    tip: 'Hammer through locks. Bombs clear colors. Take your time.',
    obstacles: {
      jelly: [
        [0, 0, 2], [5, 0, 2],
        [0, 5, 2], [5, 5, 2],
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
      locks: [
        [1, 1, 1], [4, 1, 1],
        [1, 4, 1], [4, 4, 1],
        [0, 2, 1], [5, 2, 1],
      ],
    },
  },
  {
    id: 35,
    name: 'Cherry drop',
    moves: 22,
    objective: { kind: 'dropIngredients', target: 2 },
    hint: 'Two cherries need to reach the bottom. Clear under them.',
    tip: 'Cherries fall like candies but cannot be matched. Clear the row below to make them drop.',
    obstacles: {
      ingredients: [[1, 0], [4, 0]],
    },
  },
  {
    id: 36,
    name: 'Cherry shower',
    moves: 26,
    objective: { kind: 'dropIngredients', target: 3 },
    hint: 'Three cherries — drop them all to the bottom.',
    obstacles: {
      ingredients: [[1, 0], [3, 0], [4, 0]],
    },
  },
  {
    id: 37,
    name: 'Cherry orchard',
    moves: 28,
    objective: { kind: 'dropIngredients', target: 4 },
    hint: 'Four cherries to harvest.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
    },
  },
  {
    id: 38,
    name: 'Cherries on jelly',
    moves: 30,
    objective: { kind: 'dropIngredients', target: 3 },
    hint: 'Drop 3 cherries past the jelly.',
    obstacles: {
      ingredients: [[1, 0], [3, 0], [4, 0]],
      jelly: [
        [1, 3, 1], [4, 3, 1],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 39,
    name: 'Sweet harvest',
    moves: 30,
    objective: { kind: 'dropIngredients', target: 5 },
    hint: 'Big harvest day: 5 cherries.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0]],
    },
  },

  // ===== Chapter: Cherry Orchard (40-44) =====
  {
    id: 40,
    name: 'Cherry & key',
    moves: 28,
    objective: { kind: 'dropIngredients', target: 3 },
    hint: 'Three cherries — locks block the lanes.',
    obstacles: {
      ingredients: [[1, 0], [3, 0], [4, 0]],
      locks: [
        [1, 2, 1], [4, 2, 1],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 41,
    name: 'Cherry rapids',
    moves: 30,
    objective: { kind: 'dropIngredients', target: 4 },
    hint: 'Four cherries with jelly underfoot.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
      jelly: [
        [0, 3, 1], [5, 3, 1],
        [1, 4, 1], [4, 4, 1],
      ],
    },
  },
  {
    id: 42,
    name: 'Cherry maze',
    moves: 32,
    objective: { kind: 'dropIngredients', target: 5 },
    hint: 'Five cherries — locks pinch the middle rows.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [4, 0], [5, 0]],
      locks: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 43,
    name: 'Cherry kingdom',
    moves: 34,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries — every column has one.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
    },
  },
  {
    id: 44,
    name: 'Cherry vault',
    moves: 36,
    objective: { kind: 'dropIngredients', target: 4 },
    hint: 'Four cherries through jelly AND locks.',
    obstacles: {
      ingredients: [[1, 0], [2, 0], [3, 0], [4, 0]],
      jelly: [
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
      ],
      locks: [
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },

  // ===== Chapter: Combo Storm (45-49) =====
  {
    id: 45,
    name: 'Cascade dream',
    moves: 24,
    objective: { kind: 'score', target: 2500 },
    hint: 'Look for falling cascades — they score huge.',
    tip: 'After a match, the candies above fall and can chain into new matches. Each chain link scores more.',
  },
  {
    id: 46,
    name: 'Quick specials',
    moves: 20,
    objective: { kind: 'specials', target: 3 },
    hint: 'Three specials in 20 moves. Plan ahead!',
  },
  {
    id: 47,
    name: 'Stripe shower',
    moves: 24,
    objective: { kind: 'specials', target: 4 },
    hint: 'Four specials — match in straight lines of 4.',
  },
  {
    id: 48,
    name: 'Marathon match',
    moves: 30,
    objective: { kind: 'matches', target: 24 },
    hint: '24 matches. Quantity over quality.',
  },
  {
    id: 49,
    name: 'Score spike',
    moves: 22,
    objective: { kind: 'score', target: 3200 },
    hint: 'Reach 3,200 in just 22 moves.',
    tip: 'Specials are worth way more than triples. Aim for 4s and 5s.',
  },

  // ===== Chapter: Jelly Maze (50-54) =====
  {
    id: 50,
    name: 'Halfway home',
    moves: 35,
    objective: { kind: 'clearJelly' },
    hint: 'Level 50 — a jelly heavyweight. Clear it all.',
    tip: 'Halfway to 100! Every jelly tile must be cleared.',
    obstacles: {
      jelly: [
        [0, 0, 2], [5, 0, 2],
        [1, 1, 1], [4, 1, 1],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 1], [4, 4, 1],
        [0, 5, 2], [5, 5, 2],
      ],
    },
  },
  {
    id: 51,
    name: 'Jelly fortress',
    moves: 34,
    objective: { kind: 'clearJelly' },
    hint: 'Top and bottom rows are all jelly.',
    obstacles: {
      jelly: [
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 0, 1], [5, 0, 1],
        [0, 5, 1], [1, 5, 1], [2, 5, 1], [3, 5, 1], [4, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 52,
    name: 'Jelly spine',
    moves: 32,
    objective: { kind: 'clearJelly' },
    hint: 'A vertical spine of double-jelly down the middle.',
    obstacles: {
      jelly: [
        [2, 0, 2], [3, 0, 2],
        [2, 1, 2], [3, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [2, 4, 2], [3, 4, 2],
        [2, 5, 2], [3, 5, 2],
      ],
    },
  },
  {
    id: 53,
    name: 'Jelly + locks',
    moves: 32,
    objective: { kind: 'clearJelly' },
    hint: 'Locks pin the jelly in place — free them first.',
    obstacles: {
      jelly: [
        [1, 1, 1], [4, 1, 1],
        [1, 4, 1], [4, 4, 1],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
      ],
      locks: [
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
      ],
    },
  },
  {
    id: 54,
    name: 'Jelly maelstrom',
    moves: 36,
    objective: { kind: 'clearJelly' },
    hint: 'Two-deep jelly fills the corners and centre.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 2], [4, 0, 2], [5, 0, 2],
        [0, 1, 2], [5, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [0, 4, 2], [5, 4, 2],
        [0, 5, 2], [1, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },

  // ===== Chapter: Lock Tyrant (55-59) =====
  {
    id: 55,
    name: 'Iron gates',
    moves: 28,
    objective: { kind: 'score', target: 2200 },
    hint: 'Locks frame the centre. Break through.',
    obstacles: {
      locks: [
        [1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 1, 1],
        [1, 4, 1], [2, 4, 1], [3, 4, 1], [4, 4, 1],
      ],
    },
  },
  {
    id: 56,
    name: 'Padlock parade',
    moves: 30,
    objective: { kind: 'clearType', type: 1, target: 16 },
    hint: 'Clear 16 blue squares — locks block half the board.',
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
    id: 57,
    name: 'Steel ring',
    moves: 32,
    objective: { kind: 'score', target: 2800 },
    hint: 'A full ring of double-locks. Reach 2,800.',
    obstacles: {
      locks: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [1, 2, 2], [4, 2, 2],
        [1, 3, 2], [4, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 58,
    name: 'Lockdown',
    moves: 34,
    objective: { kind: 'clearType', type: 4, target: 18 },
    hint: '18 green stars and a board of locks.',
    obstacles: {
      locks: [
        [0, 0, 1], [5, 0, 1],
        [2, 1, 2], [3, 1, 2],
        [1, 2, 1], [4, 2, 1],
        [1, 3, 1], [4, 3, 1],
        [2, 4, 2], [3, 4, 2],
        [0, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 59,
    name: 'Tyrant\'s wall',
    moves: 32,
    objective: { kind: 'score', target: 3200 },
    hint: 'Locks across the middle two rows. Crack them open.',
    obstacles: {
      locks: [
        [0, 2, 2], [1, 2, 2], [2, 2, 2], [3, 2, 2], [4, 2, 2], [5, 2, 2],
        [0, 3, 2], [1, 3, 2], [2, 3, 2], [3, 3, 2], [4, 3, 2], [5, 3, 2],
      ],
    },
  },

  // ===== Chapter: Special Lab (60-64) =====
  {
    id: 60,
    name: 'Special spree',
    moves: 28,
    objective: { kind: 'specials', target: 5 },
    hint: 'Five specials. Combine them — wrapped + striped = wow.',
    tip: 'Match 4 in a row → striped. 5 in a row → rainbow. L or T shape → wrapped.',
  },
  {
    id: 61,
    name: 'Rainbow runner',
    moves: 30,
    objective: { kind: 'specials', target: 6 },
    hint: 'Six specials — go for 5-in-a-rows.',
  },
  {
    id: 62,
    name: 'Big chain',
    moves: 28,
    objective: { kind: 'matches', target: 28 },
    hint: '28 matches — cascades count too.',
  },
  {
    id: 63,
    name: 'Power play',
    moves: 26,
    objective: { kind: 'specials', target: 4 },
    hint: 'Four specials AND clear the jelly.',
    obstacles: {
      jelly: [
        [1, 2, 1], [4, 2, 1],
        [1, 3, 1], [4, 3, 1],
      ],
    },
  },
  {
    id: 64,
    name: 'Lab finale',
    moves: 30,
    objective: { kind: 'specials', target: 5 },
    hint: 'Five specials with locks in the way.',
    obstacles: {
      locks: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },

  // ===== Chapter: Cherry Forest (65-69) =====
  {
    id: 65,
    name: 'Forest path',
    moves: 32,
    objective: { kind: 'dropIngredients', target: 5 },
    hint: 'Five cherries with jelly waiting.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [2, 3, 1], [3, 3, 1],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 66,
    name: 'Forest grove',
    moves: 34,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries through locks.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      locks: [
        [0, 3, 1], [5, 3, 1],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 67,
    name: 'Forest gauntlet',
    moves: 36,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries past double-jelly.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [0, 4, 2], [5, 4, 2],
        [1, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 68,
    name: 'Cherry crown',
    moves: 30,
    objective: { kind: 'dropIngredients', target: 4 },
    hint: 'Four cherries — narrow path between locks.',
    obstacles: {
      ingredients: [[1, 0], [2, 0], [3, 0], [4, 0]],
      locks: [
        [0, 1, 1], [5, 1, 1],
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [0, 4, 1], [5, 4, 1],
      ],
    },
  },
  {
    id: 69,
    name: 'Forest finale',
    moves: 38,
    objective: { kind: 'dropIngredients', target: 5 },
    hint: 'Five cherries, both jelly AND locks.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [2, 3, 1], [3, 3, 1],
      ],
      locks: [
        [2, 4, 1], [3, 4, 1],
        [2, 5, 1], [3, 5, 1],
      ],
    },
  },

  // ===== Chapter: Match Marathon (70-74) =====
  {
    id: 70,
    name: 'Marathon mile',
    moves: 30,
    objective: { kind: 'matches', target: 30 },
    hint: '30 matches. Every swap matters.',
  },
  {
    id: 71,
    name: 'Sprint score',
    moves: 18,
    objective: { kind: 'score', target: 2000 },
    hint: 'Tight 18 moves. Hit 2,000.',
  },
  {
    id: 72,
    name: 'Pink purge',
    moves: 24,
    objective: { kind: 'clearType', type: 2, target: 20 },
    hint: 'Clear 20 pink triangles.',
  },
  {
    id: 73,
    name: 'Yellow blitz',
    moves: 24,
    objective: { kind: 'clearType', type: 0, target: 22 },
    hint: 'Clear 22 yellow circles.',
  },
  {
    id: 74,
    name: 'Marathon finale',
    moves: 32,
    objective: { kind: 'matches', target: 32 },
    hint: '32 matches — cascades welcome.',
    obstacles: {
      jelly: [
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
    },
  },

  // ===== Chapter: Rainbow Rush (75-79) =====
  {
    id: 75,
    name: 'Sweet symphony',
    moves: 32,
    objective: { kind: 'score', target: 4000 },
    hint: 'Reach 4,000 — your highest yet.',
  },
  {
    id: 76,
    name: 'Rainbow wave',
    moves: 30,
    objective: { kind: 'specials', target: 6 },
    hint: 'Six specials — chase the rainbow.',
  },
  {
    id: 77,
    name: 'Golden hour',
    moves: 26,
    objective: { kind: 'clearType', type: 0, target: 20 },
    hint: '20 yellows through a lock maze.',
    obstacles: {
      locks: [
        [1, 1, 1], [4, 1, 1],
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
        [1, 4, 1], [4, 4, 1],
      ],
    },
  },
  {
    id: 78,
    name: 'Ocean roar',
    moves: 26,
    objective: { kind: 'clearType', type: 1, target: 22 },
    hint: '22 blues. Jelly slows the board.',
    obstacles: {
      jelly: [
        [0, 0, 1], [5, 0, 1],
        [0, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 79,
    name: 'Rainbow apex',
    moves: 36,
    objective: { kind: 'score', target: 4500 },
    hint: 'Reach 4,500 — the score grows steep.',
    tip: 'Bombs from your bank are worth their weight in points.',
  },

  // ===== Chapter: Stronghold (80-84) =====
  {
    id: 80,
    name: 'Stronghold gate',
    moves: 32,
    objective: { kind: 'score', target: 3500 },
    hint: 'Double locks ring the board.',
    obstacles: {
      locks: [
        [1, 0, 2], [4, 0, 2],
        [0, 1, 2], [5, 1, 2],
        [0, 4, 2], [5, 4, 2],
        [1, 5, 2], [4, 5, 2],
      ],
    },
  },
  {
    id: 81,
    name: 'Stronghold keep',
    moves: 36,
    objective: { kind: 'clearJelly' },
    hint: 'Jelly fortress with sentry locks.',
    obstacles: {
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
      ],
    },
  },
  {
    id: 82,
    name: 'Stronghold breach',
    moves: 30,
    objective: { kind: 'specials', target: 5 },
    hint: 'Five specials despite the lock-up.',
    obstacles: {
      locks: [
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
      ],
    },
  },
  {
    id: 83,
    name: 'Stronghold siege',
    moves: 38,
    objective: { kind: 'score', target: 4200 },
    hint: 'Push to 4,200 through every obstacle.',
    obstacles: {
      jelly: [
        [0, 0, 1], [5, 0, 1],
        [0, 5, 1], [5, 5, 1],
      ],
      locks: [
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
      ],
    },
  },
  {
    id: 84,
    name: 'Stronghold falls',
    moves: 40,
    objective: { kind: 'clearJelly' },
    hint: 'Bring the jelly tower down. Lots of it.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 2], [4, 0, 2], [5, 0, 2],
        [2, 1, 2], [3, 1, 2],
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
        [2, 4, 2], [3, 4, 2],
        [0, 5, 2], [1, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },

  // ===== Chapter: Cherry Vault (85-89) =====
  {
    id: 85,
    name: 'Vault entrance',
    moves: 34,
    objective: { kind: 'dropIngredients', target: 5 },
    hint: 'Five cherries past the vault locks.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0]],
      locks: [
        [0, 3, 2], [5, 3, 2],
      ],
    },
  },
  {
    id: 86,
    name: 'Vault corridor',
    moves: 36,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries — jelly + locks.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [1, 4, 1], [4, 4, 1],
      ],
      locks: [
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 87,
    name: 'Vault chamber',
    moves: 38,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries through the locked chamber.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      locks: [
        [0, 2, 1], [5, 2, 1],
        [2, 3, 1], [3, 3, 1],
        [0, 4, 2], [5, 4, 2],
      ],
    },
  },
  {
    id: 88,
    name: 'Vault treasury',
    moves: 40,
    objective: { kind: 'dropIngredients', target: 5 },
    hint: 'Five cherries — jelly fortress around them.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [0, 3, 2], [5, 3, 2],
        [1, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 89,
    name: 'Vault unlocked',
    moves: 40,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries with the toughest mix yet.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [0, 3, 1], [5, 3, 1],
      ],
      locks: [
        [2, 4, 2], [3, 4, 2],
      ],
    },
  },

  // ===== Chapter: Jelly Castle (90-94) =====
  {
    id: 90,
    name: 'Castle gates',
    moves: 36,
    objective: { kind: 'clearJelly' },
    hint: 'Most of the board is jelly. Clear it all.',
    obstacles: {
      jelly: [
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 0, 1], [5, 0, 1],
        [0, 1, 2], [5, 1, 2],
        [0, 4, 2], [5, 4, 2],
        [0, 5, 1], [1, 5, 1], [2, 5, 1], [3, 5, 1], [4, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 91,
    name: 'Castle walls',
    moves: 38,
    objective: { kind: 'clearJelly' },
    hint: 'Two-deep jelly ring. Work the corners hard.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 2], [4, 0, 2], [5, 0, 2],
        [0, 1, 1], [5, 1, 1],
        [0, 4, 1], [5, 4, 1],
        [0, 5, 2], [1, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },
  {
    id: 92,
    name: 'Castle court',
    moves: 36,
    objective: { kind: 'clearJelly' },
    hint: 'Jelly in the centre court — locks at the entrances.',
    obstacles: {
      jelly: [
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 2, 1], [4, 2, 1],
        [1, 3, 1], [4, 3, 1],
      ],
      locks: [
        [0, 2, 1], [5, 2, 1],
        [0, 3, 1], [5, 3, 1],
      ],
    },
  },
  {
    id: 93,
    name: 'Castle throne',
    moves: 40,
    objective: { kind: 'clearJelly' },
    hint: 'Big jelly throne room.',
    obstacles: {
      jelly: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [1, 2, 2], [4, 2, 2],
        [1, 3, 2], [4, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 94,
    name: 'Castle falls',
    moves: 42,
    objective: { kind: 'score', target: 5000 },
    hint: 'Push past the jelly to 5,000.',
    obstacles: {
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
        [1, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 0, 2], [5, 0, 2],
        [0, 5, 2], [5, 5, 2],
      ],
    },
  },

  // ===== Chapter: Mastery (95-99) =====
  {
    id: 95,
    name: 'Master\'s test',
    moves: 28,
    objective: { kind: 'specials', target: 7 },
    hint: 'Seven specials. Plan every swap.',
  },
  {
    id: 96,
    name: 'Master\'s climb',
    moves: 30,
    objective: { kind: 'score', target: 5000 },
    hint: 'Reach 5,000 in 30 moves.',
    obstacles: {
      jelly: [
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 97,
    name: 'Master\'s gauntlet',
    moves: 36,
    objective: { kind: 'dropIngredients', target: 6 },
    hint: 'Six cherries through the gauntlet.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [0, 3, 1], [5, 3, 1],
        [2, 4, 1], [3, 4, 1],
      ],
      locks: [
        [1, 4, 1], [4, 4, 1],
      ],
    },
  },
  {
    id: 98,
    name: 'Master\'s jelly',
    moves: 38,
    objective: { kind: 'clearJelly' },
    hint: 'The biggest jelly board yet.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 1], [2, 0, 2], [3, 0, 2], [4, 0, 1], [5, 0, 2],
        [0, 1, 1], [5, 1, 1],
        [0, 4, 1], [5, 4, 1],
        [0, 5, 2], [1, 5, 1], [2, 5, 2], [3, 5, 2], [4, 5, 1], [5, 5, 2],
      ],
    },
  },
  {
    id: 99,
    name: 'Champion\'s mile',
    moves: 36,
    objective: { kind: 'score', target: 6000 },
    hint: 'Reach 6,000. One level from the summit.',
    obstacles: {
      jelly: [
        [1, 2, 1], [4, 2, 1],
        [1, 3, 1], [4, 3, 1],
      ],
      locks: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 100,
    name: 'Sweet Apocalypse',
    moves: 50,
    objective: { kind: 'score', target: 8000 },
    hint: 'Level 100 — the Sweet Apocalypse. Every obstacle. Every cherry. 8,000 points.',
    tip: 'Use everything in your bank. This is the summit.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [2, 5, 1], [3, 5, 1],
      ],
    },
  },

  // ===== Chapter: Beyond the Apocalypse (101-110) — post-game brutality =====
  {
    id: 101,
    name: 'Aftermath',
    moves: 25,
    objective: { kind: 'score', target: 5000 },
    hint: 'No obstacles. 25 moves. 5,000 points. Pure skill.',
    tip: 'Specials and combos only. Cherish every cascade.',
  },
  {
    id: 102,
    name: 'Cascade trial',
    moves: 22,
    objective: { kind: 'specials', target: 8 },
    hint: 'Eight specials in 22 moves.',
  },
  {
    id: 103,
    name: 'Jelly armageddon',
    moves: 40,
    objective: { kind: 'clearJelly' },
    hint: 'The whole board is double-jelly. Strap in.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 2], [2, 0, 2], [3, 0, 2], [4, 0, 2], [5, 0, 2],
        [0, 1, 2], [1, 1, 2], [4, 1, 2], [5, 1, 2],
        [0, 4, 2], [1, 4, 2], [4, 4, 2], [5, 4, 2],
        [0, 5, 2], [1, 5, 2], [2, 5, 2], [3, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },
  {
    id: 104,
    name: 'Cherry purgatory',
    moves: 36,
    objective: { kind: 'dropIngredients', target: 7 },
    hint: 'Seven cherries. Yes, seven. Slot one per column.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [3, 1]],
      jelly: [
        [0, 3, 1], [5, 3, 1],
        [2, 4, 1], [3, 4, 1],
      ],
    },
  },
  {
    id: 105,
    name: 'Iron grip',
    moves: 32,
    objective: { kind: 'clearType', type: 2, target: 24 },
    hint: '24 pink triangles through a maze of double-locks.',
    obstacles: {
      locks: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 106,
    name: 'Centurion',
    moves: 50,
    objective: { kind: 'matches', target: 50 },
    hint: '50 matches in 50 moves. Average 1.0 per move. Cascades help.',
  },
  {
    id: 107,
    name: 'Champion\'s ladder',
    moves: 30,
    objective: { kind: 'score', target: 8000 },
    hint: '8,000 in 30 — speed-score gauntlet.',
    obstacles: {
      jelly: [
        [2, 2, 1], [3, 2, 1], [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 108,
    name: 'Locked-down vault',
    moves: 32,
    objective: { kind: 'score', target: 6000 },
    hint: 'Every cell except the centre is locked. 6,000 points.',
    obstacles: {
      locks: [
        [0, 0, 2], [1, 0, 2], [2, 0, 2], [3, 0, 2], [4, 0, 2], [5, 0, 2],
        [0, 1, 2], [5, 1, 2],
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
        [0, 4, 2], [5, 4, 2],
        [0, 5, 2], [1, 5, 2], [2, 5, 2], [3, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },
  {
    id: 109,
    name: 'Rainbow rite',
    moves: 28,
    objective: { kind: 'specials', target: 10 },
    hint: 'Ten specials. Yes ten. Use the centre well.',
  },
  {
    id: 110,
    name: 'Beyond the summit',
    moves: 60,
    objective: { kind: 'score', target: 12000 },
    hint: 'The final challenge: 12,000 points through EVERY obstacle, harder than Sweet Apocalypse.',
    tip: 'If you reach this — you\'re an Arcana Cascada master.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
      jelly: [
        [0, 1, 2], [1, 1, 2], [4, 1, 2], [5, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [0, 4, 2], [1, 4, 2], [4, 4, 2], [5, 4, 2],
      ],
      locks: [
        [0, 2, 2], [5, 2, 2],
        [0, 3, 2], [5, 3, 2],
      ],
    },
  },
  // ===== Chapter: True Hell (111-115) — way beyond grandma mode =====
  {
    id: 111,
    name: 'Crimson Tide',
    moves: 22,
    objective: { kind: 'score', target: 7000 },
    hint: '7,000 points in 22 moves, zero obstacles. Pure skill.',
  },
  {
    id: 112,
    name: 'Eternal Loop',
    moves: 30,
    objective: { kind: 'matches', target: 50 },
    hint: '50 matches in 30 moves. Cascades count — chain everything.',
  },
  {
    id: 113,
    name: 'Jelly Singularity',
    moves: 45,
    objective: { kind: 'clearJelly' },
    hint: 'The ENTIRE board is double-jelly. 36 cells. Good luck.',
    obstacles: {
      jelly: [
        [0, 0, 2], [1, 0, 2], [2, 0, 2], [3, 0, 2], [4, 0, 2], [5, 0, 2],
        [0, 1, 2], [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2], [5, 1, 2],
        [0, 2, 2], [1, 2, 2], [2, 2, 2], [3, 2, 2], [4, 2, 2], [5, 2, 2],
        [0, 3, 2], [1, 3, 2], [2, 3, 2], [3, 3, 2], [4, 3, 2], [5, 3, 2],
        [0, 4, 2], [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2], [5, 4, 2],
        [0, 5, 2], [1, 5, 2], [2, 5, 2], [3, 5, 2], [4, 5, 2], [5, 5, 2],
      ],
    },
  },
  {
    id: 114,
    name: 'Cherry Symphony',
    moves: 40,
    objective: { kind: 'dropIngredients', target: 7 },
    hint: 'Seven cherries — every column has one, plus one extra to crown.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [3, 1]],
    },
  },
  {
    id: 115,
    name: 'Sweet Infinity',
    moves: 60,
    objective: { kind: 'score', target: 15000 },
    hint: 'The new top: 15,000 score through every obstacle. ∞ build complexity.',
    tip: 'If you beat this, you really did beat the game.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 1, 2], [5, 1, 2],
        [0, 4, 2], [5, 4, 2],
        [2, 0, 2], [3, 0, 2],
        [2, 5, 2], [3, 5, 2],
      ],
    },
  },
  // ===== Chapter: Beyond (116-120) — for the player who beat the game =====
  {
    id: 116,
    name: 'Echoes',
    moves: 50,
    objective: { kind: 'score', target: 18000 },
    hint: '18,000 score, open board. Pure cascade craft.',
  },
  {
    id: 117,
    name: 'Mirror Pond',
    moves: 38,
    objective: { kind: 'clearJelly' },
    hint: 'Symmetric double-jelly. Match the shape.',
    obstacles: {
      jelly: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [1, 2, 2],                       [4, 2, 2],
        [1, 3, 2],                       [4, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 118,
    name: 'Last Cherry Grove',
    moves: 48,
    objective: { kind: 'dropIngredients', target: 10 },
    hint: 'Ten cherries in 48 moves. Plan your gravity.',
    obstacles: {
      ingredients: [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [1, 1], [4, 1],
        [2, 2], [3, 2],
      ],
    },
  },
  {
    id: 119,
    name: 'Forever Loop',
    moves: 40,
    objective: { kind: 'matches', target: 70 },
    hint: '70 matches in 40 moves. Cascades are not optional.',
  },
  {
    id: 120,
    name: 'True End',
    moves: 75,
    objective: { kind: 'score', target: 25000 },
    hint: 'The final challenge: 25,000 score against every obstacle the game can throw.',
    tip: 'Beat this and you have truly mastered Arcana Cascada.',
    obstacles: {
      ingredients: [[0, 0], [5, 0]],
      jelly: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [1, 2, 2],                       [4, 2, 2],
        [1, 3, 2],                       [4, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 1, 3], [5, 1, 3],
        [0, 4, 3], [5, 4, 3],
        [2, 0, 2], [3, 0, 2],
        [2, 5, 2], [3, 5, 2],
      ],
    },
  },
  // ===== Chapter: Encore (121-125) — for the curious that kept playing =====
  {
    id: 121,
    name: 'Curtain Call',
    moves: 30,
    objective: { kind: 'score', target: 10000 },
    hint: '10,000 score, 30 moves, nothing in the way.',
  },
  {
    id: 122,
    name: 'Sticky Web',
    moves: 36,
    objective: { kind: 'clearJelly' },
    hint: 'A diagonal stripe of double-jelly. Read the angle.',
    obstacles: {
      jelly: [
        [0, 0, 2],
        [1, 1, 2],
        [2, 2, 2],
        [3, 3, 2],
        [4, 4, 2],
        [5, 5, 2],
      ],
    },
  },
  {
    id: 123,
    name: 'Locked Garden',
    moves: 42,
    objective: { kind: 'score', target: 12000 },
    hint: '12,000 score through a ring of locked tiles.',
    obstacles: {
      locks: [
        [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2],
        [1, 2, 2],                       [4, 2, 2],
        [1, 3, 2],                       [4, 3, 2],
        [1, 4, 2], [2, 4, 2], [3, 4, 2], [4, 4, 2],
      ],
    },
  },
  {
    id: 124,
    name: 'Cherry Fountain',
    moves: 36,
    objective: { kind: 'dropIngredients', target: 8 },
    hint: '8 cherries plus a center jelly wall.',
    obstacles: {
      ingredients: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [4, 1]],
      jelly: [
        [2, 2, 1], [3, 2, 1],
        [2, 3, 1], [3, 3, 1],
      ],
    },
  },
  {
    id: 125,
    name: 'Encore!',
    moves: 50,
    objective: { kind: 'matches', target: 60 },
    hint: '60 matches in 50 moves. Cascades or it doesn\'t happen.',
    tip: 'If you got here, you really love this game. Thanks for playing.',
  },
  // ===== Chapter: Aftermath (126-130) — pure puzzle distillation =====
  {
    id: 126,
    name: 'Glass Maze',
    moves: 40,
    objective: { kind: 'clearJelly' },
    hint: 'Single jelly everywhere — clear the maze.',
    obstacles: {
      jelly: [
        [0, 0, 1], [2, 0, 1], [4, 0, 1],
        [1, 1, 1], [3, 1, 1], [5, 1, 1],
        [0, 2, 1], [2, 2, 1], [4, 2, 1],
        [1, 3, 1], [3, 3, 1], [5, 3, 1],
        [0, 4, 1], [2, 4, 1], [4, 4, 1],
        [1, 5, 1], [3, 5, 1], [5, 5, 1],
      ],
    },
  },
  {
    id: 127,
    name: 'Tower Defense',
    moves: 36,
    objective: { kind: 'score', target: 14000 },
    hint: '14,000 score through a tower of locks down the middle.',
    obstacles: {
      locks: [
        [2, 1, 2], [3, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [2, 4, 2], [3, 4, 2],
      ],
    },
  },
  {
    id: 128,
    name: 'Picky Eater',
    moves: 32,
    objective: { kind: 'clearType', type: 3, target: 25 },
    hint: 'Clear 25 of the green tiles. Tunnel-vision.',
  },
  {
    id: 129,
    name: 'Marathon',
    moves: 80,
    objective: { kind: 'score', target: 20000 },
    hint: 'A long quiet 80-move grind to 20k. Pace yourself.',
  },
  {
    id: 130,
    name: 'Aftermath',
    moves: 55,
    objective: { kind: 'score', target: 30000 },
    hint: 'The new top: 30,000 score. Everything in your bag.',
    tip: 'Past True End, past Encore. This is the final final.',
    obstacles: {
      ingredients: [[0, 0], [2, 0], [3, 0], [5, 0]],
      jelly: [
        [1, 1, 2], [4, 1, 2],
        [2, 2, 2], [3, 2, 2],
        [2, 3, 2], [3, 3, 2],
        [1, 4, 2], [4, 4, 2],
      ],
      locks: [
        [0, 2, 3], [5, 2, 3],
        [0, 3, 3], [5, 3, 3],
      ],
    },
  },
  // ===== Chapter: Postlude (131-135) — for the truly relentless =====
  {
    id: 131,
    name: 'Edge Case',
    moves: 28,
    objective: { kind: 'score', target: 11000 },
    hint: '11,000 score in just 28 moves. No fluff.',
  },
  {
    id: 132,
    name: 'Slowburn',
    moves: 36,
    objective: { kind: 'matches', target: 55 },
    hint: '55 matches, 36 moves. Cascade-rich or bust.',
  },
  {
    id: 133,
    name: 'Iron Cage',
    moves: 50,
    objective: { kind: 'score', target: 18000 },
    hint: '18,000 score through level-3 locks ringing the outside.',
    obstacles: {
      locks: [
        [0, 0, 3], [1, 0, 3], [4, 0, 3], [5, 0, 3],
        [0, 5, 3], [1, 5, 3], [4, 5, 3], [5, 5, 3],
      ],
    },
  },
  {
    id: 134,
    name: 'Cherry Storm',
    moves: 38,
    objective: { kind: 'dropIngredients', target: 9 },
    hint: 'Nine cherries spread across the top two rows.',
    obstacles: {
      ingredients: [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [1, 1], [3, 1], [4, 1],
      ],
    },
  },
  {
    id: 135,
    name: 'Endless',
    moves: 100,
    objective: { kind: 'score', target: 40000 },
    hint: 'A hundred moves. Forty thousand. The Endless level.',
    tip: 'If you beat this without using any power-ups, please email me about your therapy bills.',
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
    case 'dropIngredients': {
      const total = progress.ingredientsTotal || 0;
      const dropped = progress.ingredientsDropped || 0;
      return {
        current: dropped,
        target: total,
        done: total > 0 && dropped >= total,
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
