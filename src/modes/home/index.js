// Home mode — the start menu / mode picker. First-class mode in
// the runtime (was an ad-hoc overlay before #337) so every "return
// to start menu" transition fires the previous mode's exit() before
// the menu shows. Owns the ambient home-screen music.
//
// Home is intentionally the only mode that does NOT mutate
// state.settings.mode — that field tracks the player's last *game*
// mode preference (Roguelike / Levels / Free Play / Daily) so the
// in-game UI can branch on it, and home doesn't override it.

import { registerMode } from '../index.js';

export function register(deps) {
  const {
    sfx,
    openStartMenu,
    hideStartMenu,
  } = deps;

  function enter(opts) {
    sfx.setMusicMode('home');
    // Force-clear the roguelike palette without touching
    // state.settings.mode (the player's last game-mode preference).
    document.body.classList.remove('mode-roguelike');
    openStartMenu(opts && opts.subtitle ? opts.subtitle : null);
  }

  function exit() {
    hideStartMenu();
  }

  registerMode({ id: 'home', enter, exit });
}
