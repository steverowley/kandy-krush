export function attachInput(handler) {
  const board = document.getElementById('board');
  board.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile || !board.contains(tile)) return;
    const c = Number(tile.dataset.c);
    const r = Number(tile.dataset.r);
    if (Number.isNaN(c) || Number.isNaN(r)) return;
    handler({ c, r });
  });
}
