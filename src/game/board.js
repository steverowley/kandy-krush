export class Board {
  constructor(cols, rows, candyTypes) {
    this.cols = cols;
    this.rows = rows;
    this.candyTypes = candyTypes;
    this.grid = new Array(cols * rows).fill(null);
  }

  idx(c, r) {
    return r * this.cols + c;
  }

  inBounds(c, r) {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  at(c, r) {
    return this.inBounds(c, r) ? this.grid[this.idx(c, r)] : null;
  }

  set(c, r, v) {
    this.grid[this.idx(c, r)] = v;
  }

  fillNoMatches() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const forbidden = new Set();
        if (c >= 2 && this.at(c - 1, r) === this.at(c - 2, r)) {
          forbidden.add(this.at(c - 1, r));
        }
        if (r >= 2 && this.at(c, r - 1) === this.at(c, r - 2)) {
          forbidden.add(this.at(c, r - 1));
        }
        let choice;
        do {
          choice = Math.floor(Math.random() * this.candyTypes);
        } while (forbidden.has(choice));
        this.set(c, r, choice);
      }
    }
  }

  swap(a, b) {
    const ai = this.idx(a.c, a.r);
    const bi = this.idx(b.c, b.r);
    [this.grid[ai], this.grid[bi]] = [this.grid[bi], this.grid[ai]];
  }

  adjacent(a, b) {
    const dc = Math.abs(a.c - b.c);
    const dr = Math.abs(a.r - b.r);
    return (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
  }

  clear(positions) {
    for (const p of positions) this.set(p.c, p.r, null);
  }
}
