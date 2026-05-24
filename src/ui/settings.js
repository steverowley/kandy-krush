export function createSettingsUI({ initial, onChange, onResetProgress }) {
  const overlay = document.getElementById('settings-overlay');
  const panel = document.getElementById('settings-panel');
  const closeBtn = document.getElementById('settings-close');
  const openBtn = document.getElementById('settings-open');
  const soundBtn = document.getElementById('setting-sound');
  const speechBtn = document.getElementById('setting-speech');
  const musicBtn = document.getElementById('setting-music');
  const contrastBtn = document.getElementById('setting-contrast');
  const modeBtn = document.getElementById('setting-mode');
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

    if (modeBtn) {
      modeBtn.setAttribute('aria-pressed', String(current.mode === 'levels'));
      modeBtn.textContent = current.mode === 'levels' ? 'Mode: Levels' : 'Mode: Free Play';
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
  if (modeBtn) {
    modeBtn.addEventListener('click', () =>
      apply({ mode: current.mode === 'levels' ? 'free' : 'levels' })
    );
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
