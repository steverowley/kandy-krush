export function createSettingsUI({ initial, onChange }) {
  const overlay = document.getElementById('settings-overlay');
  const panel = document.getElementById('settings-panel');
  const closeBtn = document.getElementById('settings-close');
  const openBtn = document.getElementById('settings-open');
  const soundBtn = document.getElementById('setting-sound');
  const contrastBtn = document.getElementById('setting-contrast');
  const sizeButtons = Array.from(document.querySelectorAll('[data-size]'));

  let current = { ...initial };

  function refresh() {
    soundBtn.setAttribute('aria-pressed', String(current.sound));
    soundBtn.textContent = current.sound ? 'Sound: On' : 'Sound: Off';

    contrastBtn.setAttribute('aria-pressed', String(current.contrast));
    contrastBtn.textContent = current.contrast
      ? 'High Contrast: On'
      : 'High Contrast: Off';

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
  contrastBtn.addEventListener('click', () =>
    apply({ contrast: !current.contrast })
  );
  for (const b of sizeButtons) {
    b.addEventListener('click', () => apply({ size: b.dataset.size }));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) hide();
  });

  refresh();
}
