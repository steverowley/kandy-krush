import { showAchievement } from './render.js';

const MILESTONES = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

export function createAchievements({ speak }) {
  const fired = new Set();
  let matchesThisGame = 0;
  let cascadesThisGame = 0;

  function announce(label) {
    if (fired.has(label)) return;
    fired.add(label);
    showAchievement(label);
    if (speak) speak(label);
  }

  return {
    onNewGame() {
      fired.clear();
      matchesThisGame = 0;
      cascadesThisGame = 0;
    },

    onMatch({ matchCount, cascadeLevel, specialsCreated, specialsActivated }) {
      matchesThisGame++;
      if (cascadeLevel > 1) cascadesThisGame++;

      if (matchesThisGame === 1) announce('Sweet match!');
      if (matchCount >= 5) announce('Wow!');
      if (matchCount >= 8) announce('Massive match!');
      if (matchCount >= 12) announce('Unbelievable!');
      if (specialsCreated.some((s) => s.kind === 'rainbow')) announce('Rainbow!');
      else if (specialsCreated.some((s) => s.kind && s.kind.startsWith('line'))) announce('Striped!');
      if (specialsActivated.some((a) => a === 'rainbow')) announce('Magical!');
      if (cascadeLevel >= 3) announce('On fire!');
      if (cascadeLevel >= 6) announce('Mega cascade!');
      if (cascadeLevel >= 9) announce('LEGENDARY!');
      if (cascadesThisGame >= 5) announce('Cascade master!');
      if (cascadesThisGame >= 15) announce('Cascade god!');
    },

    onScore(score) {
      for (const m of MILESTONES) {
        if (score >= m) announce(`${m.toLocaleString()} points!`);
      }
    },
  };
}
