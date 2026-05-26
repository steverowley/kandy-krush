// 🚌 Audio bus subscribers — every "playing a sound at a gameplay
// moment" is now a bus subscription, not an inline `sfx.playX()`
// scattered through the cascade pipeline.
//
// Migration philosophy: only events that semantically OWN their
// sound move here. One-shot sfx tied to a specific user action
// (button press, mode picker click, etc.) stay inline — they don't
// belong on the bus because nothing else cares when they happen.
//
// Order of subscription matters when other subscribers (run-effects,
// achievements) gate on the same event. Audio is registered FIRST
// at boot so the sound fires before any game-logic subscriber
// mutates the payload — preserves the previous "sfx then logic"
// ordering of the legacy inline calls.

export function register(deps) {
  const { bus, sfx } = deps;
  const unsubs = [];

  // ---- Match cleared (every cascade level, including level 1) ----
  unsubs.push(bus.on('match', (ctx) => {
    sfx.playMatch(ctx.allCleared?.size ?? ctx.matchSize, ctx.cascadeLevel);
  }));

  // ---- Cascade (only fires for cascadeLevel >= 2) ----
  unsubs.push(bus.on('cascade', () => {
    sfx.playCascade();
  }));

  return {
    off() {
      for (const u of unsubs) u();
      unsubs.length = 0;
    },
  };
}
