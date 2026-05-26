// 🚌 Haptics bus subscribers — vibration cues at gameplay moments.
//
// Same philosophy as audio.js: only events that semantically OWN a
// haptic move here. One-shot haptics from UI interactions stay
// inline.
//
// Match intensity bucket lives here (was inline in main.js's
// processMatchRound): 5+ tiles cleared in a single match -> intensity 3,
// 4 tiles -> 2, otherwise 1.

export function register(deps) {
  const { bus, haptics } = deps;
  const unsubs = [];

  // ---- Match cleared — intensity scaled by match size ----
  unsubs.push(bus.on('match', (ctx) => {
    const size = ctx.matchSize ?? ctx.allCleared?.size ?? 0;
    const intensity = size >= 5 ? 3 : size >= 4 ? 2 : 1;
    haptics.match(intensity);
  }));

  // ---- Cascade chain — intensity scaled by cascade depth ----
  unsubs.push(bus.on('cascade', (ctx) => {
    haptics.cascade(ctx.cascadeLevel);
  }));

  // ---- Special tile created (line / wrapped / rainbow) ----
  unsubs.push(bus.on('special:birth', () => {
    haptics.specialBirth();
  }));

  return {
    off() {
      for (const u of unsubs) u();
      unsubs.length = 0;
    },
  };
}
