/**
 * The corner tree: a fixed, hand-tuned ASCII tree in the bottom-right corner with a
 * crown that sways in the wind, leaves that break off and drift down into the grass,
 * and a long bare branch (plus two twigs) where birds can rest. The renderer lays it
 * out on resize and draws it each frame; nothing here touches the birds or the sim.
 */
import { clamp, hash3, TAU, wind } from "./math";

/** A branch segment, in tree heights: x right, y up from the foot of the trunk; w is full width. */
interface Bough {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w0: number;
  w1: number;
}
/** A clump of leaves: a lumpy disc around (x, y). */
interface Clump {
  x: number;
  y: number;
  r: number;
  ph: number;
}

/** Sunlit leaves are sparse and pale, shaded leaves dense and dark (index 0 is deepest shade). */
const LEAF_RAMP = "@&%#*+;:";
const LEAF_EDGE = ".,'`";
const BARK_DARK: [number, number, number] = [66, 40, 20];
const BARK_LIGHT: [number, number, number] = [138, 92, 52];
const LEAF_DARK: [number, number, number] = [16, 78, 38];
const LEAF_LIGHT: [number, number, number] = [74, 162, 78];

/** Grow the same tree every time: a leaning trunk that forks four times, leaves at the outer forks. */
function growTree() {
  const boughs: Bough[] = [];
  const clumps: Clump[] = [];
  let seed = 1;
  const rnd = () => hash3(seed++, 71, 5);
  const grow = (x: number, y: number, angle: number, len: number, w: number, depth: number) => {
    // Each limb bends once halfway, so nothing is ruler-straight.
    const bend = angle + (rnd() - 0.5) * 0.35;
    const mx = x + Math.cos(angle) * len * 0.5;
    const my = y + Math.sin(angle) * len * 0.5;
    const ex = mx + Math.cos(bend) * len * 0.5;
    const ey = my + Math.sin(bend) * len * 0.5;
    boughs.push({ x0: x, y0: y, x1: mx, y1: my, w0: w, w1: w * 0.84 });
    boughs.push({ x0: mx, y0: my, x1: ex, y1: ey, w0: w * 0.84, w1: w * 0.66 });
    if (depth >= 2) clumps.push({ x: ex, y: ey, r: 0.075 + 0.045 * rnd() + 0.02 * (4 - depth), ph: rnd() * TAU });
    if (depth === 4) return;
    const n = depth === 0 ? 3 : rnd() < 0.45 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const spread = 0.36 + 0.22 * rnd();
      const childAngle = bend + (k - (n - 1) / 2) * spread + (rnd() - 0.5) * 0.2;
      grow(ex, ey, childAngle, len * (0.64 + 0.14 * rnd()), w * 0.62, depth + 1);
    }
  };
  grow(0, 0, Math.PI / 2 + 0.06, 0.4, 0.12, 0);
  // Roots flaring into the ground.
  boughs.push({ x0: -0.02, y0: 0.06, x1: -0.15, y1: -0.01, w0: 0.07, w1: 0.016 });
  boughs.push({ x0: 0.02, y0: 0.06, x1: 0.14, y1: -0.01, w0: 0.07, w1: 0.016 });

  // Bare twigs poking out of the crown, for birds to sit on. Each perch is the top of
  // its twig, out past the leaves.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const k of clumps) {
    minX = Math.min(minX, k.x - k.r * 1.25);
    maxX = Math.max(maxX, k.x + k.r * 1.25);
    minY = Math.min(minY, k.y - k.r * 1.25);
    maxY = Math.max(maxY, k.y + k.r * 1.25);
  }
  const perches: { x: number; y: number; long: boolean }[] = [];
  const twig = (x0: number, y0: number, x1: number, y1: number, at: number) => {
    boughs.push({ x0, y0, x1, y1, w0: 0.024, w1: 0.012 });
    const w = 0.024 + (0.012 - 0.024) * at;
    perches.push({ x: x0 + (x1 - x0) * at, y: y0 + (y1 - y0) * at + w / 2, long: false });
  };
  // One long, bare limb reaching out under the crown: room for both birds to rest on it.
  const longY = minY - 0.03;
  const x0 = -0.06 * longY;
  const kx = minX * 0.45;
  const ky = longY + 0.03;
  const ex = minX - 0.12;
  const ey = longY + 0.07;
  boughs.push({ x0, y0: longY - 0.02, x1: kx, y1: ky, w0: 0.05, w1: 0.032 });
  boughs.push({ x0: kx, y0: ky, x1: ex, y1: ey, w0: 0.032, w1: 0.016 });
  for (const at of [0.25, 0.85]) {
    const w = 0.032 + (0.016 - 0.032) * at;
    perches.push({ x: kx + (ex - kx) * at, y: ky + (ey - ky) * at + w / 2, long: true });
  }
  const highY = minY + (maxY - minY) * 0.8;
  twig(minX + 0.16, highY, minX - 0.1, highY + 0.06, 0.8);
  const cx = (minX + maxX) / 2 - 0.04;
  boughs.push({ x0: cx, y0: maxY - 0.1, x1: cx + 0.03, y1: maxY + 0.11, w0: 0.026, w1: 0.012 });
  perches.push({ x: cx + 0.03, y: maxY + 0.112, long: false });

  // How far the tree reaches left and up, so layout scans every cell it covers (a lumpy clump grows ~1.4x its radius).
  let left = 0;
  let top = 0;
  for (const b of boughs) {
    left = Math.min(left, b.x0 - b.w0 / 2, b.x1 - b.w1 / 2);
    top = Math.max(top, b.y0 + b.w0 / 2, b.y1 + b.w1 / 2);
  }
  for (const k of clumps) {
    left = Math.min(left, k.x - k.r * 1.4);
    top = Math.max(top, k.y + k.r * 1.4);
  }
  return { boughs, clumps, perches, left, top };
}
const TREE = growTree();

export class CornerTree {
  /** Per cell, rebuilt on resize: 0 none, 1 bark, 2 leaves, 3 leaf edge, 4 grass. */
  kind = new Uint8Array(0);
  private shade = new Float32Array(0);
  /** Bark: the glyph that follows the limb. Leaves and grass: a hash for picking glyphs. */
  private glyph: string[] = [];
  private key = new Uint32Array(0);
  /** Spots where birds can sit, in px. */
  perches: { x: number; y: number; long: boolean }[] = [];
  private cols = 0;
  private rows = 0;
  private cw = 1;
  private ch = 1;
  private width = 0;
  /** Where the tree stands this layout, for sway and for leaves landing in the grass. */
  private baseY = 0;
  private height = 1;
  /** Cells on the rim of the crown that leaves can break off from. */
  private leafSpots: number[] = [];
  /** Loose leaves riding the wind; settle > 0 once a leaf is lying in the grass. */
  private leaves: { x: number; y: number; ph: number; yellow: number; settle: number }[] = [];
  private leafBudget = 0;

  /** A bird landing or leaving shakes a few leaves loose around (x, y). */
  shake(x: number, y: number) {
    for (let k = 0; k < 6; k++) this.dropLeaf(x + (Math.random() - 0.5) * this.cw * 10, y - Math.random() * this.ch * 4);
  }

  /**
   * Rasterise the corner tree into cells once per resize. Leaves sit over the bark;
   * bark glyphs follow each limb's direction, and twigs thinner than a cell still get one.
   */
  plant(cols: number, rows: number, cw: number, ch: number, W: number, H: number) {
    const n = cols * rows;
    if (this.kind.length !== n) {
      this.kind = new Uint8Array(n);
      this.shade = new Float32Array(n);
      this.key = new Uint32Array(n);
      this.glyph = new Array(n).fill("");
    }
    Object.assign(this, { cols, rows, cw, ch, width: W });
    const { kind: treeKind, shade: treeShade, key: treeKey, glyph: treeGlyph } = this;
    treeKind.fill(0);
    this.leafSpots = [];
    this.perches = [];
    this.leaves = [];
    // Upright screens are narrow, so the tree can take more of their width.
    const T = Math.min(H * 0.52, W * (W < H ? 0.55 : 0.36));
    const baseX = W - T * 0.36;
    const baseY = H - ch * 1.5;
    this.baseY = baseY;
    this.height = T;
    this.perches = TREE.perches.map((p) => ({ x: baseX + p.x * T, y: baseY - p.y * T, long: p.long }));
    // Thin limbs still get a cell: half a cell across the limb, which for flat limbs is half a (taller) row.
    const minHalf = (sx: number, sy: number) => (0.55 * (Math.abs(sy) * cw + Math.abs(sx) * ch)) / (Math.hypot(sx, sy) || 1) / T;
    // Light from the upper left, in tree coordinates (y up).
    const lx = -0.6;
    const ly = 0.8;

    const c0 = Math.max(0, Math.floor((baseX + TREE.left * T) / cw) - 1);
    const r0 = Math.max(0, Math.floor((baseY - TREE.top * T) / ch) - 1);
    for (let r = r0; r < rows; r++) {
      for (let c = c0; c < cols; c++) {
        const i = r * cols + c;
        const x = (c * cw + cw / 2 - baseX) / T;
        const y = (baseY - (r * ch + ch / 2)) / T;
        treeKey[i] = (hash3(c, r, 913) * 4294967295) >>> 0;

        // Leaves: the nearest clump the point falls inside, with a lumpy outline.
        let leaf = -1;
        let leafEdge = false;
        for (const k of TREE.clumps) {
          const dx = x - k.x;
          const dy = y - k.y;
          const a = Math.atan2(dy, dx);
          const rr = k.r * (1 + 0.16 * Math.sin(3 * a + k.ph) + 0.09 * Math.sin(5 * a - k.ph));
          const d = Math.hypot(dx, dy) / rr;
          if (d > 1.12) continue;
          if (d > 1) {
            leafEdge = true;
            continue;
          }
          const lit = 0.55 + 0.4 * ((dx * lx + dy * ly) / rr) - 0.25 * d * d;
          leaf = Math.max(leaf, lit);
        }
        // A few gaps in the canopy let branches and sky show through.
        if (leaf >= 0 && hash3(c, r, 517) > 0.06) {
          treeKind[i] = 2;
          treeShade[i] = clamp(leaf, 0, 1);
          if (leafEdge || hash3(c, r, 29) < 0.04) this.leafSpots.push(i);
          continue;
        }

        let best = Infinity;
        let bough: Bough | null = null;
        let side = 0;
        for (const b of TREE.boughs) {
          const sx = b.x1 - b.x0;
          const sy = b.y1 - b.y0;
          const u = clamp(((x - b.x0) * sx + (y - b.y0) * sy) / (sx * sx + sy * sy || 1), 0, 1);
          const qx = b.x0 + sx * u;
          const qy = b.y0 + sy * u;
          const half = Math.max((b.w0 + (b.w1 - b.w0) * u) / 2, minHalf(sx, sy));
          const d = Math.hypot(x - qx, y - qy) / half;
          if (d < 1 && d < best) {
            best = d;
            bough = b;
            side = (x - qx) * -sy + (y - qy) * sx < 0 ? -d : d;
          }
        }
        if (bough) {
          const dx = bough.x1 - bough.x0;
          const dy = bough.y1 - bough.y0;
          const len = Math.hypot(dx, dy) || 1;
          // Steep limbs read as |, leaning ones as / or \, flat ones as _.
          const glyph = Math.abs(dx) / len < 0.38 ? "|" : Math.abs(dy) / len < 0.38 ? "_" : dx * dy > 0 ? "/" : "\\";
          const wide = (bough.w0 + bough.w1) / 2 > (cw * 2.2) / T;
          treeKind[i] = 1;
          // Lit on the left flank, shaded on the right.
          treeShade[i] = clamp(0.55 - side * 0.35, 0, 1);
          treeGlyph[i] = wide && best < 0.55 ? "|!:"[treeKey[i] % 3] : glyph;
          continue;
        }

        if (leafEdge && hash3(c, r, 211) < 0.55) {
          treeKind[i] = 3;
          this.leafSpots.push(i);
          continue;
        }
        // Grass tufts along the ground under the tree.
        if (y < 0.012 && y > -0.03 && Math.abs(x) < 0.42 && hash3(c, r, 77) < 0.6) {
          treeKind[i] = 4;
        }
      }
    }
  }

  /**
   * Draw the bark and leaves, skipping covered cells. The crown bends with the wind, more toward the top,
   * gusts flip leaves pale, and the odd leaf glyph turns over.
   */
  draw(ctx: CanvasRenderingContext2D, t: number, covered: Uint8Array) {
    const { cols, cw, ch, kind: treeKind, shade: treeShade, key: treeKey, glyph: treeGlyph, baseY: treeBaseY, height: treeHeight } = this;
    const breeze = wind(t);
    // Heavier strokes than the sky, so the tree reads as solid ink.
    const font = ctx.font;
    ctx.font = font.replace(/^\d+/, "800");
    const tone = (from: [number, number, number], to: [number, number, number], k: number) =>
      `rgb(${Math.round(from[0] + (to[0] - from[0]) * k)},${Math.round(from[1] + (to[1] - from[1]) * k)},${Math.round(from[2] + (to[2] - from[2]) * k)})`;
    for (let i = 0; i < treeKind.length; i++) {
      const kind = treeKind[i];
      if (!kind || covered[i]) continue;
      const col = i % cols;
      const row = (i / cols) | 0;
      const x = col * cw + cw / 2;
      const y = row * ch + ch / 2 + 1;
      const key = treeKey[i];
      if (kind === 1) {
        ctx.fillStyle = tone(BARK_DARK, BARK_LIGHT, treeShade[i]);
        ctx.fillText(treeGlyph[i], x, y);
        continue;
      }
      const ripple = 0.08 * Math.sin(t * 1.1 - col * 0.3 + row * 0.18);
      const tick = Math.floor(t * (0.7 + Math.abs(breeze)) + (key % 997) / 61);
      if (kind === 2 || kind === 3) {
        // Bend: whole cells of sideways shift, growing with height up the crown.
        const h = clamp((treeBaseY - (row * ch + ch / 2)) / treeHeight, 0, 1.3);
        const shift = Math.round((breeze * 2 + 0.4 * Math.sin(t * 1.6 + row * 0.25)) * h * h);
        const sx = x + shift * cw;
        if (kind === 2) {
          const shade = clamp(treeShade[i] + ripple + Math.max(0, breeze) * 0.12 * h, 0, 1);
          const jitter = Math.floor(hash3(key, tick, 3) * 3) - 1;
          ctx.fillStyle = tone(LEAF_DARK, LEAF_LIGHT, shade);
          ctx.fillText(LEAF_RAMP[clamp(Math.floor(shade * 7.99) + jitter, 0, LEAF_RAMP.length - 1)], sx, y);
        } else {
          ctx.fillStyle = tone(LEAF_DARK, LEAF_LIGHT, 0.55 + ripple);
          ctx.fillText(LEAF_EDGE[(key + tick) % LEAF_EDGE.length], sx, y);
        }
      } else {
        ctx.fillStyle = tone(LEAF_DARK, LEAF_LIGHT, 0.4 + 0.3 * ((key >>> 5) % 3) / 2);
        ctx.fillText(",.'\"wv"[(key + tick) % 6], x, y);
      }
    }
    ctx.font = font;
  }

  /** Break a leaf off the crown at (x, y). */
  private dropLeaf(x: number, y: number) {
    if (this.leaves.length >= 30) return;
    this.leaves.push({ x, y, ph: Math.random() * TAU, yellow: Math.random() < 0.35 ? Math.random() : 0, settle: 0 });
  }

  /**
   * Loose leaves: they break off the rim of the crown (more in gusts), ride the wind,
   * flutter side to side and tumble as they fall, then lie in the grass a few seconds.
   */
  drawLeaves(ctx: CanvasRenderingContext2D, t: number, dt: number) {
    const { cw, ch, cols, rows, leaves, leafSpots, width: W } = this;
    const breeze = wind(t);
    this.leafBudget += (0.15 + 1.6 * Math.max(0, breeze - 0.25)) * dt;
    while (this.leafBudget >= 1) {
      this.leafBudget -= 1;
      if (!leafSpots.length) break;
      const i = leafSpots[Math.floor(Math.random() * leafSpots.length)];
      this.dropLeaf((i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
    }

    const ground = this.baseY + ch * 0.6;
    for (let k = leaves.length - 1; k >= 0; k--) {
      const f = leaves[k];
      if (f.settle > 0) {
        f.settle -= dt;
        if (f.settle <= 0) leaves.splice(k, 1);
      } else {
        f.x += (breeze * 60 + Math.sin(t * 2.7 + f.ph) * 18) * dt;
        f.y += (20 + 10 * Math.sin(t * 1.9 + f.ph * 1.3)) * dt;
        if (f.y >= ground) {
          f.y = ground;
          f.settle = 4;
        }
        if (f.x < -cw * 2 || f.x > W + cw * 2) leaves.splice(k, 1);
      }
    }

    for (const f of leaves) {
      const col = Math.floor(f.x / cw);
      const row = Math.floor(f.y / ch);
      if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
      const k = 0.55;
      const g: [number, number, number] = [
        LEAF_DARK[0] + (LEAF_LIGHT[0] - LEAF_DARK[0]) * k,
        LEAF_DARK[1] + (LEAF_LIGHT[1] - LEAF_DARK[1]) * k,
        LEAF_DARK[2] + (LEAF_LIGHT[2] - LEAF_DARK[2]) * k,
      ];
      const rgb = g.map((v, n) => Math.round(v + ([170, 168, 58][n] - v) * f.yellow));
      const alpha = f.settle > 0 ? clamp(f.settle / 4, 0, 1) : 1;
      ctx.fillStyle = `rgba(${rgb.join(",")},${alpha.toFixed(2)})`;
      // Tumbling: the glyph turns over as the leaf flutters.
      const glyph = f.settle > 0 ? "," : "*'`~,"[Math.floor(t * 4 + f.ph * 3) % 5];
      ctx.fillText(glyph, col * cw + cw / 2, row * ch + ch / 2 + 1);
    }
  }
}
