export function createSettingsUI({ initial, onChange, onResetProgress, onHome }) {
  const overlay = document.getElementById('settings-overlay');
  const panel = document.getElementById('settings-panel');
  const closeBtn = document.getElementById('settings-close');
  const openBtn = document.getElementById('settings-open');
  const soundBtn = document.getElementById('setting-sound');
  const speechBtn = document.getElementById('setting-speech');
  const musicBtn = document.getElementById('setting-music');
  const contrastBtn = document.getElementById('setting-contrast');
  const motionBtn = document.getElementById('setting-reduce-motion');
  const enemiesBtn = document.getElementById('setting-enemies');
  const canvasBtn = document.getElementById('setting-canvas');
  const homeBtn = document.getElementById('setting-home');
  const resetBtn = document.getElementById('setting-reset');
  const resetOverlay = document.getElementById('reset-overlay');
  const resetPanel = document.getElementById('reset-panel');
  const resetCancel = document.getElementById('reset-cancel');
  const resetConfirm = document.getElementById('reset-confirm');
  const sizeButtons = Array.from(document.querySelectorAll('[data-size]'));

  let current = { ...initial };

  function refresh() {
    soundBtn.setAttribute('aria-pressed', String(current.sound));
    soundBtn.textContent = current.sound ? 'Sound: On' : 'Sound: Off';

    if (speechBtn) {
      speechBtn.setAttribute('aria-pressed', String(current.speech));
      speechBtn.textContent = current.speech ? 'Spoken cheers: On' : 'Spoken cheers: Off';
    }

    if (musicBtn) {
      musicBtn.setAttribute('aria-pressed', String(current.music));
      musicBtn.textContent = current.music ? 'Background music: On' : 'Background music: Off';
    }

    contrastBtn.setAttribute('aria-pressed', String(current.contrast));
    contrastBtn.textContent = current.contrast
      ? 'High Contrast: On'
      : 'High Contrast: Off';

    if (motionBtn) {
      motionBtn.setAttribute('aria-pressed', String(current.reduceMotion));
      motionBtn.textContent = current.reduceMotion
        ? 'Reduce motion: On'
        : 'Reduce motion: Off';
    }

    if (enemiesBtn) {
      // Default true if not set yet
      const enemiesOn = current.enemies !== false;
      enemiesBtn.setAttribute('aria-pressed', String(enemiesOn));
      enemiesBtn.textContent = enemiesOn
        ? 'Enemies: On'
        : 'Enemies: Off';
    }

    if (canvasBtn) {
      // Reflects localStorage directly — not part of the regular settings
      // object because flipping it requires a page reload to load Pixi.
      let on = false;
      try { on = window.localStorage && window.localStorage.getItem('sweetMatchCanvas') === '1'; } catch {}
      canvasBtn.setAttribute('aria-pressed', String(on));
      canvasBtn.textContent = on
        ? '🎨 WebGL renderer: On (reload to apply)'
        : '🎨 WebGL renderer: Off';
    }

    for (const b of sizeButtons) {
      const active = b.dataset.size === current.size;
      b.setAttribute('aria-pressed', String(active));
      b.classList.toggle('active', active);
    }
  }

  function apply(next) {
    current = { ...current, ...next };
    onChange(current);
    refresh();
  }

  function show() {
    overlay.classList.remove('hidden');
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function hide() {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    openBtn.focus();
  }

  openBtn.addEventListener('click', show);
  closeBtn.addEventListener('click', hide);
  overlay.addEventListener('click', hide);

  soundBtn.addEventListener('click', () => apply({ sound: !current.sound }));
  if (speechBtn) {
    speechBtn.addEventListener('click', () => apply({ speech: !current.speech }));
  }
  if (musicBtn) {
    musicBtn.addEventListener('click', () => apply({ music: !current.music }));
  }
  contrastBtn.addEventListener('click', () =>
    apply({ contrast: !current.contrast })
  );
  if (motionBtn) {
    motionBtn.addEventListener('click', () =>
      apply({ reduceMotion: !current.reduceMotion })
    );
  }
  if (enemiesBtn) {
    enemiesBtn.addEventListener('click', () =>
      apply({ enemies: !(current.enemies !== false) })
    );
  }
  if (canvasBtn) {
    canvasBtn.addEventListener('click', () => {
      let on = false;
      try { on = window.localStorage && window.localStorage.getItem('sweetMatchCanvas') === '1'; } catch {}
      try { window.localStorage.setItem('sweetMatchCanvas', on ? '0' : '1'); } catch {}
      // Page reload is the cleanest way to flip Pixi on/off — it needs
      // to be loaded (or not) at page load, before the first render.
      window.location.reload();
    });
  }
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      hide();
      if (onHome) onHome();
    });
  }
  for (const b of sizeButtons) {
    b.addEventListener('click', () => apply({ size: b.dataset.size }));
  }

  function showResetConfirm() {
    if (!resetOverlay || !resetPanel) return;
    resetOverlay.classList.remove('hidden');
    resetPanel.classList.remove('hidden');
    resetPanel.setAttribute('aria-hidden', 'false');
    resetCancel.focus();
  }
  function hideResetConfirm() {
    if (!resetOverlay || !resetPanel) return;
    resetOverlay.classList.add('hidden');
    resetPanel.classList.add('hidden');
    resetPanel.setAttribute('aria-hidden', 'true');
    if (resetBtn) resetBtn.focus();
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', showResetConfirm);
  }
  if (resetCancel) {
    resetCancel.addEventListener('click', hideResetConfirm);
  }
  if (resetOverlay) {
    resetOverlay.addEventListener('click', hideResetConfirm);
  }
  if (resetConfirm) {
    resetConfirm.addEventListener('click', () => {
      hideResetConfirm();
      hide();
      if (onResetProgress) onResetProgress();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (resetOverlay && !resetOverlay.classList.contains('hidden')) {
      hideResetConfirm();
      return;
    }
    if (!overlay.classList.contains('hidden')) hide();
  });

  refresh();
}
