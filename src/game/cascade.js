export function applyGravity(board, candyTypes) {
  const fallenCells = [];

  for (let c = 0; c < board.cols; c++) {
    let writeRow = board.rows - 1;
    for (let r = board.rows - 1; r >= 0; r--) {
      const v = board.at(c, r);
      if (v !== null) {
        if (writeRow !== r) {
          board.set(c, writeRow, v);
          board.set(c, r, null);
          fallenCells.push({ c, r: writeRow });
        }
        writeRow--;
      }
    }
    for (let r = writeRow; r >= 0; r--) {
      board.set(c, r, Math.floor(Math.random() * candyTypes));
      fallenCells.push({ c, r });
    }
  }

  return fallenCells;
}
