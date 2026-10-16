// Pure High-Performance Hexagonal 2048 Game Engine

export const HEX_DIRECTIONS = {
  TOP_RIGHT: { id: 0, name: 'Top-Right', dq: 1, dr: -1, angle: -Math.PI / 6, label: '↗' },
  RIGHT: { id: 1, name: 'Right', dq: 1, dr: 0, angle: 0, label: '→' },
  BOTTOM_RIGHT: { id: 2, name: 'Bottom-Right', dq: 0, dr: 1, angle: Math.PI / 6, label: '↘' },
  BOTTOM_LEFT: { id: 3, name: 'Bottom-Left', dq: -1, dr: 1, angle: 5 * Math.PI / 6, label: '↙' },
  LEFT: { id: 4, name: 'Left', dq: -1, dr: 0, angle: Math.PI, label: '←' },
  TOP_LEFT: { id: 5, name: 'Top-Left', dq: 0, dr: -1, angle: -5 * Math.PI / 6, label: '↖' }
};

export class Hex2048Engine {
  constructor(radius = 2) {
    this.radius = radius; // radius 2 = 19 cells, radius 3 = 37 cells
    this.cells = new Map(); // key "q,r" -> value
    this.score = 0;
    this.history = [];
    this.won = false;
    this.keepPlaying = false;
    this.over = false;
    this.initBoard();
  }

  // Generate all valid cubic coordinates within radius
  getAllCoordinates() {
    const coords = [];
    for (let q = -this.radius; q <= this.radius; q++) {
      const r1 = Math.max(-this.radius, -q - this.radius);
      const r2 = Math.min(this.radius, -q + this.radius);
      for (let r = r1; r <= r2; r++) {
        coords.push({ q, r, s: -q - r });
      }
    }
    return coords;
  }

  key(q, r) {
    return `${q},${r}`;
  }

  initBoard() {
    this.cells.clear();
    this.score = 0;
    this.history = [];
    this.won = false;
    this.keepPlaying = false;
    this.over = false;

    for (const c of this.getAllCoordinates()) {
      this.cells.set(this.key(c.q, c.r), 0);
    }

    // Spawn 2 initial tiles
    this.spawnTile();
    this.spawnTile();
  }

  getEmptyCells() {
    const empty = [];
    for (const [k, val] of this.cells.entries()) {
      if (val === 0) {
        const [q, r] = k.split(',').map(Number);
        empty.push({ q, r });
      }
    }
    return empty;
  }

  spawnTile() {
    const empty = this.getEmptyCells();
    if (empty.length === 0) return null;
    const choice = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.85 ? 2 : 4;
    this.cells.set(this.key(choice.q, choice.r), value);
    return { q: choice.q, r: choice.r, value };
  }

  saveSnapshot() {
    const state = {
      cells: new Map(this.cells),
      score: this.score,
      won: this.won,
      over: this.over
    };
    this.history.push(state);
    if (this.history.length > 5) this.history.shift(); // Keep last 5 undos
  }

  undo() {
    if (this.history.length === 0) return false;
    const last = this.history.pop();
    this.cells = new Map(last.cells);
    this.score = last.score;
    this.won = last.won;
    this.over = last.over;
    return true;
  }

  // Slide all tiles along a hexagonal direction
  // dir: one of HEX_DIRECTIONS (TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT, LEFT, TOP_LEFT)
  move(dir) {
    if (this.over && !this.keepPlaying) return { moved: false };

    // Group cells into parallel lines along the direction vector
    const lines = this.getLinesInDirection(dir);
    let movedAny = false;
    let gainedScore = 0;
    const newCells = new Map(this.cells);
    const mergedValues = [];

    for (const line of lines) {
      // line is ordered from destination end to source end
      const originalValues = line.map(c => this.cells.get(this.key(c.q, c.r)));
      
      // Filter non-zero
      const nonZero = originalValues.filter(v => v !== 0);
      const merged = [];
      let i = 0;

      while (i < nonZero.length) {
        if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
          const sum = nonZero[i] * 2;
          merged.push(sum);
          gainedScore += sum;
          mergedValues.push(sum);
          if (sum === 2048 && !this.won) {
            this.won = true;
          }
          i += 2;
        } else {
          merged.push(nonZero[i]);
          i += 1;
        }
      }

      // Pad with zeroes
      while (merged.length < line.length) {
        merged.push(0);
      }

      // Check if this line changed
      for (let j = 0; j < line.length; j++) {
        const coord = line[j];
        const oldVal = originalValues[j];
        const newVal = merged[j];
        if (oldVal !== newVal) {
          movedAny = true;
        }
        newCells.set(this.key(coord.q, coord.r), newVal);
      }
    }

    if (!movedAny) {
      return { moved: false };
    }

    // Save previous state for undo
    this.saveSnapshot();

    this.cells = newCells;
    this.score += gainedScore;

    // Spawn a new tile
    const spawned = this.spawnTile();

    // Check game over
    this.over = this.checkGameOver();

    return {
      moved: true,
      score: this.score,
      gainedScore,
      spawned,
      won: this.won,
      over: this.over,
      mergedValues
    };
  }

  // Decompose hex grid into 1D lines parallel to direction
  getLinesInDirection(dir) {
    const all = this.getAllCoordinates();
    const { dq, dr } = dir;
    const ds = -dq - dr;

    // Group by projection along line perpendicular to (dq, dr, ds)
    // In cubic coords:
    // If dr == 0, lines are fixed r, movement along q (dq != 0, ds != 0)
    // If dq == 0, lines are fixed q, movement along r (dr != 0, ds != 0)
    // If ds == 0 (dq == -dr), lines are fixed s (q + r), movement along q and r
    const groups = new Map();

    for (const c of all) {
      let groupKey;
      if (dr === 0) {
        groupKey = c.r;
      } else if (dq === 0) {
        groupKey = c.q;
      } else {
        groupKey = c.q + c.r; // fixed s
      }

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(c);
    }

    // Sort each line so the destination cell comes first
    // Direction vector is (dq, dr, ds). Projection of cell c along dir is:
    // c.q * dq + c.r * dr + c.s * ds
    // Destination has MAXIMUM projection along direction!
    const result = [];
    for (const line of groups.values()) {
      line.sort((a, b) => {
        const projA = a.q * dq + a.r * dr + a.s * ds;
        const projB = b.q * dq + b.r * dr + b.s * ds;
        return projB - projA; // descending -> destination first
      });
      result.push(line);
    }

    return result;
  }

  checkGameOver() {
    if (this.getEmptyCells().length > 0) return false;

    // Check if any adjacent neighbors share the same value
    const dirs = Object.values(HEX_DIRECTIONS);
    for (const c of this.getAllCoordinates()) {
      const val = this.cells.get(this.key(c.q, c.r));
      if (val === 0) return false;

      for (const d of dirs) {
        const nKey = this.key(c.q + d.dq, c.r + d.dr);
        if (this.cells.has(nKey) && this.cells.get(nKey) === val) {
          return false;
        }
      }
    }
    return true;
  }
}
