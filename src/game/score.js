export function calcScore(matches, cascadeLevel) {
  const base = matches.length * 10;
  const lengthBonus = Math.max(0, matches.length - 3) * 15;
  return (base + lengthBonus) * cascadeLevel;
}
