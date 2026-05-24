export function makeCell(type, special = null) {
  return { type, special };
}

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

  cell(c, r) {
    return this.inBounds(c, r) ? this.grid[this.idx(c, r)] : null;
  }

  at(c, r) {
    return this.cell(c, r);
  }

  typeAt(c, r) {
    const v = this.cell(c, r);
    return v ? v.type : null;
  }

  specialAt(c, r) {
    const v = this.cell(c, r);
    return v ? v.special : null;
  }

  set(c, r, cell) {
    this.grid[this.idx(c, r)] = cell;
  }

  setType(c, r, type) {
    this.grid[this.idx(c, r)] = makeCell(type, null);
  }

  fillNoMatches() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const forbidden = new Set();
        if (c >= 2 && this.typeAt(c - 1, r) === this.typeAt(c - 2, r)) {
          forbidden.add(this.typeAt(c - 1, r));
        }
        if (r >= 2 && this.typeAt(c, r - 1) === this.typeAt(c, r - 2)) {
          forbidden.add(this.typeAt(c, r - 1));
        }
        let choice;
        do {
          choice = Math.floor(Math.random() * this.candyTypes);
        } while (forbidden.has(choice));
        this.setType(c, r, choice);
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
