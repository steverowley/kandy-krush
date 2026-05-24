import { LEVELS } from '../game/levels.js';

function tileHTML(level, earnedStars, isCurrent, isUnlocked) {
  const stars =
    '★'.repeat(earnedStars) + '☆'.repeat(3 - earnedStars);
  const lockBadge = isUnlocked
    ? ''
    : `<div class="lt-lock" aria-label="locked">Locked</div>`;
  return `
    <div class="lt-num">${level.id}</div>
    <div class="lt-name">${level.name}</div>
    <div class="lt-hint">${level.hint}</div>
    <div class="lt-stars" aria-label="${earnedStars} of 3 stars">${stars}</div>
    ${lockBadge}
  `;
}

export function createLevelSelect({ getProgress, onChoose }) {
  const overlay = document.getElementById('level-select-overlay');
  const panel = document.getElementById('level-select-panel');
  const grid = document.getElementById('level-select-grid');
  const closeBtn = document.getElementById('level-select-close');
  if (!overlay || !panel || !grid || !closeBtn) {
    return { show: () => {}, hide: () => {} };
  }

  function populate() {
    const { currentLevel, stars } = getProgress();
    grid.innerHTML = '';
    for (const lv of LEVELS) {
      const earned = stars[lv.id] || 0;
      const unlocked = lv.id <= currentLevel;
      const isCurrent = lv.id === currentLevel;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'level-tile';
      tile.disabled = !unlocked;
      tile.setAttribute('aria-label',
        `Level ${lv.id} ${lv.name}, ${lv.hint}, ${earned} of 3 stars${unlocked ? '' : ', locked'}`
      );
      if (isCurrent) tile.classList.add('current');
      if (!unlocked) tile.classList.add('locked');
      tile.innerHTML = tileHTML(lv, earned, isCurrent, unlocked);
      if (unlocked) {
        tile.addEventListener('click', () => {
          hide();
          onChoose(lv.id);
        });
      }
      grid.appendChild(tile);
    }
  }

  function show() {
    populate();
    overlay.classList.remove('hidden');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function hide() {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
  }

  closeBtn.addEventListener('click', hide);
  overlay.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) hide();
  });

  return { show, hide };
}
