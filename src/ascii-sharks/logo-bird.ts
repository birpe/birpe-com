/**
 * How a bird looks: the Birpe logo bird, traced from the brand sheet and painted in the
 * logo's three blues. The two logo views are turned into a solid bird, so it can be seen
 * from any angle as it turns, banks and rolls. Birds are small, so they're painted on a
 * sub-grid three times finer than the character cells (each cell split 2 × 3), with soft
 * edges. Nothing here moves a bird; bird-brain.ts does that.
 */
import { clamp, smoothstep, TAU } from "./math";
import type { Shark } from "./world";

/**
 * The Birpe logo bird, traced from the brand sheet at 6 px per character:
 * w = wing, b = body, d = the darker overlap, . = empty.
 * SIDE is the right view (beak at the right); TOP looks down on it, beak up.
 * Both share one scale: a unit is the side view's length.
 */
const LOGO_SIDE = [
  "wwwwwwwwwwwwwwwwwwwwwwwwww.................................",
  "wwwwwwwwwwwwwwwwwwwwwwwwwwwww..............................",
  "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwww............................",
  ".wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..........................",
  ".wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.........................",
  "..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww........................",
  "..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.......................",
  "...wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww......................",
  "...wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.....................",
  "....wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww....................",
  "....wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.....bbbbbbbbbb.....",
  ".....wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..bbbbbbbbbbbbbb...",
  "......wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwbbbbbbbbbbbbbbbbbb.",
  ".......wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwddbbbbbbbbbbbbbbbbbb",
  "........wwwwwwwwwwwwwwwwwwwwwwwwwwwwwddddbbbbbbbbbbbbbbb...",
  ".........wwwwwwwwwwwwwwwwwwwwwwwwwwwdddddbbbbbbbbbbbbb.....",
  "..........wwwwwwwwwwwwwwwwwwwwwwwwdddddddbbbbbbbbbbbb......",
  "............wwwwwwwwwwwwwwwwwwwwwdddddddddbbbbbbbbbb.......",
  "..............wwwwwwwwwwwwwwwwwwddddddddddbbbbbbbbb........",
  "................wwwwwwwwwwwwwwddddddddddddbbbbbbbbb........",
  "...................wwwwwwwwwwdddddddddddddbbbbbbbb.........",
  "...........................dddddddddddddddbbbbbbbb.........",
  "..........................ddddddddddddddddbbbbbbb..........",
  ".........................dddddddddddddddddbbbbbbb..........",
  ".......................ddddddddddddddddddbbbbbbb...........",
  "......................dddddddddddddddddddbbbbbbb...........",
  "....................dddddddddddddddddddddbbbbbb............",
  "...................dddddddddddddddddddddbbbbbb.............",
  ".................dddddddddddddddddddddddbbbbbb.............",
  "................ddddddddddddddddddddddddbbbbb..............",
  "..............dddddddddddddddddddddddddbbbbb...............",
  ".............dddddddddddddddddddddddddbbbbb................",
  "............dddddddddddddddddddddddddbbbbb.................",
  "...........dddddddddddddddddddddddddbbbbb..................",
  "............dddddddddddddddddddddddbbbb....................",
  "..............ddddddddddddddddddddbbbb.....................",
  "................ddddddddddddddddbbb........................",
  "...................dddddddddddbb...........................",
];
const LOGO_TOP = [
  "...................................b...................................",
  "..................................bbb..................................",
  ".................................bbbbb.................................",
  "................................bbbbbbb................................",
  "................................bbbbbbb................................",
  "...............................bbbbbbbbb...............................",
  "...............................bbbbbbbbb...............................",
  "..............................bbbbbbbbbbb..............................",
  "................wwwwww........bbbbbbbbbbb........wwwwww................",
  ".........wwwwwwwwwwwwwwwwww..bbbbbbbbbbbb...wwwwwwwwwwwwwwwwww.........",
  "......wwwwwwwwwwwwwwwwwwwwwwwbbbbbbbbbbbbbwwwwwwwwwwwwwwwwwwwwwww......",
  "...wwwwwwwwwwwwwwwwwwwwwwwwwwddbbbbbbbbbddwwwwwwwwwwwwwwwwwwwwwwwwww...",
  ".wwwwwwwwwwwwwwwwwwwwwwwwwwwwdddbbbbbbbdddwwwwwwwwwwwwwwwwwwwwwwwwwwww.",
  "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwddddbbbbbddddwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  ".wwwwwwwwwwwwwwwwwwwwwwwwwwwddddddbbbdddddwwwwwwwwwwwwwwwwwwwwwwwwwwww.",
  "..wwwwwwwwwwwwwwwwwwwwwwwwwwdddddddbddddddwwwwwwwwwwwwwwwwwwwwwwwwwww..",
  "...wwwwwwwwwwwwwwwwwwwwwwwwwddddddddddddddwwwwwwwwwwwwwwwwwwwwwwwwww...",
  "....wwwwwwwwwwwwwwwwwwwwwwwwddddddddddddddwwwwwwwwwwwwwwwwwwwwwwww.....",
  "......wwwwwwwwwwwwwwwwwwwwwwddddddddddddddwwwwwwwwwwwwwwwwwwwwwww......",
  ".......wwwwwwwwwwwwwwwwwwwwwwdddddddddddddwwwwwwwwwwwwwwwwwwwww........",
  ".........wwwwwwwwwwwwwwwwwwwwdddddddddddddwwwwwwwwwwwwwwwwwwww.........",
  "...........wwwwwwwwwwwwwwwwwwdddddddddddddwwwwwwwwwwwwwwwwww...........",
  "..............wwwwwwwwwwwww..ddddddddddddd..wwwwwwwwwwwww..............",
  "..................wwwwww.....dddddddddddd......wwwwww..................",
  "..............................ddddddddddd..............................",
  "..............................ddddddddddd..............................",
  "...............................ddddddddd...............................",
  "...............................ddddddddd...............................",
  "...............................dddddddd................................",
  "................................ddddddd................................",
  ".................................ddddd.................................",
  "..................................ddd..................................",
  "...................................d...................................",
];
/** Half extents of each mask in side-view lengths. */
const SIDE_HALF: [number, number] = [0.5, 228 / 354 / 2];
const TOP_HALF: [number, number] = [426 / 354 / 2, 198 / 354 / 2];
/** Where the side-view wing meets the body; the wing beats about this point. */
const SHOULDER: [number, number] = [0.09, -0.045];

/** The logo's three blues. */
const LOGO_WING: [number, number, number] = [0x3b, 0x9b, 0xfc];
const LOGO_BODY: [number, number, number] = [0x07, 0x80, 0xfd];
const LOGO_DARK: [number, number, number] = [0x01, 0x5b, 0xea];

function logoAt(mask: string[], half: [number, number], x: number, y: number) {
  const col = Math.floor(((x + half[0]) / (half[0] * 2)) * mask[0].length);
  const row = Math.floor(((y + half[1]) / (half[1] * 2)) * mask.length);
  if (row < 0 || row >= mask.length || col < 0 || col >= mask[0].length) return ".";
  return mask[row][col];
}

/** Where a mask's body ('b' or 'd') starts and ends, across its columns or down its rows. */
function bodyExtent(mask: string[], half: [number, number], rows: boolean): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  mask.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== "b" && line[c] !== "d") continue;
      const k = rows ? r : c;
      lo = Math.min(lo, k);
      hi = Math.max(hi, k + 1);
    }
  });
  const n = rows ? mask.length : mask[0].length;
  const h = rows ? half[1] : half[0];
  return [(lo / n) * 2 * h - h, (hi / n) * 2 * h - h];
}

/**
 * The solid body, in bird-local units (x forward, y to its right, z up): the side view's
 * profile carved by the top view's outline (stretched to the same length), with each slice
 * rounded to the ellipse that just fills both. Side-on or from above it is exactly the
 * logo; head-on it's a rounded breast, not a block. Baked once: 1 body blue, 2 the darker blue.
 */
const BX = 64;
const BY = 20;
const BZ = 40;
const BOX: [number, number, number] = [
  0.5,
  Math.max(...bodyExtent(LOGO_TOP, TOP_HALF, false).map(Math.abs)),
  SIDE_HALF[1],
];
const BODY = (() => {
  const [sx0, sx1] = bodyExtent(LOGO_SIDE, SIDE_HALF, false);
  const [ty0, ty1] = bodyExtent(LOGO_TOP, TOP_HALF, true);
  const grid = new Uint8Array(BX * BY * BZ);
  const at = (n: number, size: number, half: number) => (((n + 0.5) / size) * 2 - 1) * half;
  const isBody = (c: string) => c === "b" || c === "d";
  for (let i = 0; i < BX; i++) {
    const x = at(i, BX, BOX[0]);
    // The top view has the beak up, so forward runs up its rows.
    const ty = ty0 + ((sx1 - x) / (sx1 - sx0)) * (ty1 - ty0);
    // This slice's extent in each view, then the ellipse that fills it.
    let z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < BZ; k++) {
      const z = at(k, BZ, BOX[2]);
      if (isBody(logoAt(LOGO_SIDE, SIDE_HALF, x, -z))) (z0 = Math.min(z0, z)), (z1 = Math.max(z1, z));
    }
    for (let j = 0; j < BY; j++) {
      const y = at(j, BY, BOX[1]);
      if (isBody(logoAt(LOGO_TOP, TOP_HALF, y, ty))) (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    }
    if (z0 > z1 || y0 > y1) continue;
    const hz = (z1 - z0) / 2 + BOX[2] / BZ;
    const hy = (y1 - y0) / 2 + BOX[1] / BY;
    for (let k = 0; k < BZ; k++) {
      const z = at(k, BZ, BOX[2]);
      const side = logoAt(LOGO_SIDE, SIDE_HALF, x, -z);
      if (!isBody(side)) continue;
      for (let j = 0; j < BY; j++) {
        const y = at(j, BY, BOX[1]);
        const ey = (y - (y0 + y1) / 2) / hy;
        const ez = (z - (z0 + z1) / 2) / hz;
        if (ey * ey + ez * ez > 1 || !isBody(logoAt(LOGO_TOP, TOP_HALF, y, ty))) continue;
        grid[i + BX * (j + BY * k)] = side === "d" ? 2 : 1;
      }
    }
  }
  return grid;
})();

/** Body voxels per bird length along each axis. */
const VX = BX / (2 * BOX[0]);
const VY = BY / (2 * BOX[1]);
const VZ = BZ / (2 * BOX[2]);

/**
 * For each empty voxel, how far it is to the nearest body voxel, counted in whole voxels
 * along whichever axis is farthest. A ray can leap that far across empty space at once
 * instead of stepping through it, and still never jump over the body.
 */
const GAP = (() => {
  const n = BX * BY * BZ;
  const a = new Uint8Array(n);
  const b = new Uint8Array(n);
  const FAR = 255;
  // Along x: distance to the nearest body voxel in the row, sweeping each way.
  for (let k = 0; k < BZ; k++) {
    for (let j = 0; j < BY; j++) {
      const row = BX * (j + BY * k);
      let d = FAR;
      for (let i = 0; i < BX; i++) a[row + i] = d = BODY[row + i] ? 0 : Math.min(FAR, d + 1);
      d = FAR;
      for (let i = BX - 1; i >= 0; i--) a[row + i] = Math.min(a[row + i], (d = BODY[row + i] ? 0 : Math.min(FAR, d + 1)));
    }
  }
  // Then along y and z: the nearest of (that far across) and (the distance found so far there).
  const spread = (src: Uint8Array, dst: Uint8Array, len: number, stride: number, starts: number[]) => {
    for (const s of starts) {
      for (let p = 0; p < len; p++) {
        let best = FAR;
        for (let q = 0; q < len; q++) best = Math.min(best, Math.max(Math.abs(p - q), src[s + q * stride]));
        dst[s + p * stride] = best;
      }
    }
  };
  const ys: number[] = [];
  for (let k = 0; k < BZ; k++) for (let i = 0; i < BX; i++) ys.push(i + BX * BY * k);
  spread(a, b, BY, BX, ys);
  const zs: number[] = [];
  for (let j = 0; j < BY; j++) for (let i = 0; i < BX; i++) zs.push(i + BX * j);
  spread(b, a, BZ, BX * BY, zs);
  return a;
})();

/** The side view's wing ('w') as a bitmap, and its bounds in mask units: x0, x1, y0, y1. */
const SIDE_COLS = LOGO_SIDE[0].length;
const SIDE_ROWS = LOGO_SIDE.length;
const SIDE_KX = SIDE_COLS / (2 * SIDE_HALF[0]);
const SIDE_KY = SIDE_ROWS / (2 * SIDE_HALF[1]);
const WING_MASK = new Uint8Array(SIDE_COLS * SIDE_ROWS);
const WING_BOX = [Infinity, -Infinity, Infinity, -Infinity];
LOGO_SIDE.forEach((line, r) => {
  for (let c = 0; c < line.length; c++) {
    if (line[c] !== "w") continue;
    WING_MASK[r * SIDE_COLS + c] = 1;
    WING_BOX[0] = Math.min(WING_BOX[0], c / SIDE_KX - SIDE_HALF[0]);
    WING_BOX[1] = Math.max(WING_BOX[1], (c + 1) / SIDE_KX - SIDE_HALF[0]);
    WING_BOX[2] = Math.min(WING_BOX[2], r / SIDE_KY - SIDE_HALF[1]);
    WING_BOX[3] = Math.max(WING_BOX[3], (r + 1) / SIDE_KY - SIDE_HALF[1]);
  }
});

/** Ray-march step through the body, in bird lengths. */
const STEP = 0.014;
/** Half the thickness of a wing, so one seen edge-on still shows as a sliver. */
const WING_SLAB = 0.012;
/** How far behind the body a beating wing can be and still darken it, like the logo's overlap. */
const OVERLAP = 0.15;

let bodyColor = 0;
const slab = [0, 0];

/** Clip the ray o + t·d to |o + t·d| ≤ h along one axis; false when it misses. */
function clip(o: number, d: number, h: number) {
  if (Math.abs(d) < 1e-9) return Math.abs(o) <= h;
  let a = (-h - o) / d;
  let b = (h - o) / d;
  if (a > b) [a, b] = [b, a];
  slab[0] = Math.max(slab[0], a);
  slab[1] = Math.min(slab[1], b);
  return slab[0] <= slab[1];
}

/** Where a ray first enters the body (Infinity if never), leaving its colour in bodyColor. */
function castBody(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) {
  slab[0] = -Infinity;
  slab[1] = Infinity;
  if (!clip(ox, dx, BOX[0]) || !clip(oy, dy, BOX[1]) || !clip(oz, dz, BOX[2])) return Infinity;
  // The most voxels the ray crosses, along any one axis, per unit of t.
  const rate = Math.max(Math.abs(dx) * VX, Math.abs(dy) * VY, Math.abs(dz) * VZ);
  for (let t = slab[0] + STEP / 2; t < slab[1]; ) {
    const i = Math.min(BX - 1, ((ox + dx * t + BOX[0]) * VX) | 0);
    const j = Math.min(BY - 1, ((oy + dy * t + BOX[1]) * VY) | 0);
    const k = Math.min(BZ - 1, ((oz + dz * t + BOX[2]) * VZ) | 0);
    const at = i + BX * (j + BY * k);
    const v = BODY[at];
    if (v) {
      bodyColor = v;
      return t;
    }
    // A voxel `gap` away leaves gap − 1 voxels of clear space, wherever we are in this one.
    const gap = GAP[at];
    t += gap > 1 ? Math.max(STEP, (gap - 1) / rate) : STEP;
  }
  return Infinity;
}

/** One wing's pose: which side, how far out its root sits, its dihedral, sweep, size and half-thickness. */
type Wing = { side: number; root: number; sinP: number; cosP: number; sinS: number; cosS: number; size: number; slab: number };

/**
 * Where a ray first meets a wing (Infinity if never). A wing is the side view's wing laid
 * flat as a plane hinged on the shoulder line: raised straight up at dihedral 0 (the logo
 * pose), spread out level at π/2, and hanging below the body past that.
 */
function castWing(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, w: Wing) {
  const qx = ox - SHOULDER[0];
  const qy = oy - w.side * w.root;
  const qz = oz + SHOULDER[1];
  // Normal = forward × span, span = (0, side·sinφ, cosφ).
  const sy = w.side * w.sinP;
  const dn = -w.cosP * dy + sy * dz;
  const on = -w.cosP * qy + sy * qz;
  let tc = 0;
  let half = 1.2;
  if (Math.abs(dn) > 1e-6) {
    tc = -on / dn;
    half = Math.min(1.2, w.slab / Math.abs(dn));
  } else if (Math.abs(on) > w.slab) return Infinity;
  // Face-on a single sample does; near edge-on, walk the stretch of ray inside the slab.
  const n = half > 0.015 ? Math.min(40, Math.ceil(half / 0.015)) : 0;
  for (let s = -n; s <= n; s++) {
    const t = tc + (n ? (s / n) * half : 0);
    const a = (qx + dx * t) / w.size;
    const span = ((qy + dy * t) * sy + (qz + dz * t) * w.cosP) / w.size;
    // Undo the sweep to find which point of the resting wing lands here.
    const col = (SHOULDER[0] + a * w.cosS - span * w.sinS + SIDE_HALF[0]) * SIDE_KX;
    const row = (SHOULDER[1] - a * w.sinS - span * w.cosS + SIDE_HALF[1]) * SIDE_KY;
    if (col >= 0 && row >= 0 && col < SIDE_COLS && row < SIDE_ROWS && WING_MASK[(row | 0) * SIDE_COLS + (col | 0)]) return t;
  }
  return Infinity;
}

/** Samples per sub-cell, besides its centre, for soft edges. */
const SUBSAMPLES = [0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75];
const COLORS = [LOGO_BODY, LOGO_BODY, LOGO_DARK, LOGO_WING];

/**
 * Each bird paints into its own little image, one pixel per sub-cell, which is drawn
 * onto the sky scaled up in a single call. It remembers what it was painted from, so a
 * bird that hasn't changed (sitting on the tree) is just drawn again, with no ray work.
 */
type Sprite = { canvas: OffscreenCanvas | HTMLCanvasElement; image: ImageData; drawn: number[]; cols: number; rows: number };
const sprites = new WeakMap<Shark, Sprite>();
/** Centre labels of the sub-cells, with a one-cell empty border; shared, grown as needed. */
let labels = new Uint8Array(0);

function makeCanvas(w: number, h: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** True when every number matches what was drawn last time, to well under a pixel. */
function unchanged(drawn: number[], now: number[]) {
  if (drawn.length < now.length) return false;
  for (let k = 0; k < now.length; k++) if (Math.abs(drawn[k] - now[k]) > 1e-4) return false;
  return true;
}

/**
 * Draw a bird as a solid seen from the front of the screen, along its body axes, so it
 * turns, pitches, banks and rolls freely: side-on it is the logo's side view, from above
 * the logo's top view. Poses: flying (both wings beat down from the raised logo pose
 * through level to below the body and back, held up in a shallow V while gliding),
 * flaring to land (wings raised, a touch swept forward), and perched (folded along the body).
 *
 * Kept light: one ray per sub-cell, with the extra soft-edge samples only along the
 * outline; rays leap across empty space in the body; one image draw per bird; and an
 * unchanged bird isn't recomputed at all.
 */
export function drawBird(ctx: CanvasRenderingContext2D, sh: Shark, cw: number, ch: number) {
  const b = sh.bird!;
  // A hint of perspective: a bird farther back in the sky draws a little smaller.
  const L = sh.length * b.scale * (1 - clamp(b.z / (sh.length * 6), -0.25, 0.25));
  const [fx, fy, fz] = b.fwd;
  const [ux, uy, uz] = b.up;
  const rx = fy * uz - fz * uy;
  const ry = fz * ux - fx * uz;
  const rz = fx * uy - fy * ux;

  // The wingbeat: a quick downstroke and a slower recovery, the tips trailing back
  // mid-stroke. Below a light flap the wings are held up, gliding.
  const amp = b.pose === 0 ? clamp((b.flap - 0.15) / 0.85, 0, 1) : 0;
  const u = (((sh.phase / TAU) % 1) + 1) % 1;
  const down = u < 0.42 ? smoothstep(0, 1, u / 0.42) : 1 - smoothstep(0, 1, (u - 0.42) / 0.58);
  const theta = amp * down * Math.PI * 0.8;
  const dihedral = b.pose === 0 ? 0.4 + theta * 0.82 : 0;
  // Folded on the perch: swung back along the body, tucked smaller, lying outside it.
  const sweep = b.pose === 2 ? -1.05 : b.pose === 1 ? 0.12 : -0.22 * Math.sin(theta);
  // Each downstroke lifts the body a little, so the bird rides its wingbeat.
  const cx = b.x;
  const cy = b.y - amp * L * 0.035 * (down - 0.5);
  const sw = cw / 2;
  const sy = ch / 3;

  let sprite = sprites.get(sh);
  const now = [cx, cy, L, fx, fy, fz, ux, uy, uz, dihedral, sweep, b.pose, sw, sy];
  if (sprite && unchanged(sprite.drawn, now)) {
    blit(ctx, sprite, cx, cy, sw, sy);
    return;
  }

  // At least a sub-cell thick edge-on, so the one ray per sub-cell can't slip past it.
  const wingSlab = Math.max(WING_SLAB, (0.5 * Math.max(sw, sy)) / L);
  const wing = (side: number): Wing => ({
    side,
    root: b.pose === 2 ? BOX[1] + 0.01 : 0.05,
    sinP: Math.sin(dihedral),
    cosP: Math.cos(dihedral),
    sinS: Math.sin(sweep),
    cosS: Math.cos(sweep),
    size: b.pose === 2 ? 0.72 : 1,
    slab: wingSlab,
  });
  const wings = [wing(1), wing(-1)];

  // 0 empty, 1 body, 2 dark overlap, 3 wing. Each sample is a ray into the screen,
  // taken into the bird's own axes; the nearest surface wins.
  const layer = (px: number, py: number) => {
    const qx = (px - cx) / L;
    const qy = (py - cy) / L;
    const ox = qx * fx + qy * fy;
    const oy = qx * rx + qy * ry;
    const oz = qx * ux + qy * uy;
    const tb = castBody(ox, oy, oz, fz, rz, uz);
    const tw = Math.min(castWing(ox, oy, oz, fz, rz, uz, wings[0]), castWing(ox, oy, oz, fz, rz, uz, wings[1]));
    if (tw === Infinity) return tb === Infinity ? 0 : bodyColor;
    if (tb === Infinity) return 3;
    // A beating wing darkens where it crosses the body; a folded one lies on top of it.
    if (b.pose === 2) return tw < tb ? 3 : bodyColor;
    return tw < tb + OVERLAP ? 2 : bodyColor;
  };

  // Only cast rays inside the bird's outline on screen: the hull of the body's box and
  // each wing's corners, turned into its current pose.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const corners: number[] = [];
  const reach = (x: number, y: number, z: number) => {
    const px = (x * fx + y * rx + z * ux) * L;
    const py = (x * fy + y * ry + z * uy) * L;
    corners.push(px, py);
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  };
  for (let n = 0; n < 8; n++) reach(n & 1 ? BOX[0] : -BOX[0], n & 2 ? BOX[1] : -BOX[1], n & 4 ? BOX[2] : -BOX[2]);
  for (const w of wings) {
    for (let n = 0; n < 4; n++) {
      const mx = (n & 1 ? WING_BOX[1] : WING_BOX[0]) - SHOULDER[0];
      const my = (n & 2 ? WING_BOX[3] : WING_BOX[2]) - SHOULDER[1];
      const a = (mx * w.cosS - my * w.sinS) * w.size;
      const span = (-mx * w.sinS - my * w.cosS) * w.size;
      reach(SHOULDER[0] + a, w.side * (w.root + span * w.sinP), -SHOULDER[1] + span * w.cosP);
    }
  }
  // The thickness of an edge-on wing pokes a little past its corners.
  const pad = wingSlab * L;
  const c0 = Math.floor((cx + minX - pad) / sw);
  const c1 = Math.ceil((cx + maxX + pad) / sw);
  const r0 = Math.floor((cy + minY - pad) / sy);
  const r1 = Math.ceil((cy + maxY + pad) / sy);
  const cols = c1 - c0 + 1;
  const rows = r1 - r0 + 1;

  if (!sprite || sprite.image.width < cols || sprite.image.height < rows) {
    const w = Math.max(cols, sprite?.image.width ?? 0) + 8;
    const h = Math.max(rows, sprite?.image.height ?? 0) + 8;
    sprite = { canvas: makeCanvas(w, h), image: new ImageData(w, h), drawn: [], cols: 0, rows: 0 };
    sprites.set(sh, sprite);
  }
  const { image } = sprite;
  const data = image.data;
  const stride = image.width;

  // First pass: one ray through the centre of every sub-cell the hull touches.
  const lw = cols + 2;
  if (labels.length < lw * (rows + 2)) labels = new Uint8Array(lw * (rows + 2) * 2);
  else labels.fill(0, 0, lw * (rows + 2));
  const outline = hull(corners);
  for (let r = 0; r < rows; r++) {
    const y = (r0 + r + 0.5) * sy;
    const top = (r0 + r) * sy - cy - pad;
    const [lo, hi] = hullSpan(outline, top, top + sy + pad * 2);
    if (lo > hi) continue;
    const from = Math.max(0, Math.floor((cx + lo - pad) / sw) - c0);
    const to = Math.min(cols - 1, Math.floor((cx + hi + pad) / sw) - c0);
    for (let c = from; c <= to; c++) labels[(r + 1) * lw + c + 1] = layer((c0 + c + 0.5) * sw, y);
  }

  // Second pass: a sub-cell whose neighbours all agree with it is solid (or empty) through;
  // only those along an outline or a colour edge take the extra samples for a soft edge.
  const votes = [0, 0, 0, 0];
  for (let r = 0; r < rows; r++) {
    let p = (r * stride) * 4;
    for (let c = 0; c < cols; c++, p += 4) {
      const at = (r + 1) * lw + c + 1;
      const center = labels[at];
      const edge =
        labels[at - lw - 1] !== center || labels[at - lw] !== center || labels[at - lw + 1] !== center ||
        labels[at - 1] !== center || labels[at + 1] !== center ||
        labels[at + lw - 1] !== center || labels[at + lw] !== center || labels[at + lw + 1] !== center;
      let top = center;
      let alpha = center ? 255 : 0;
      if (edge) {
        const x = (c0 + c) * sw;
        const y = (r0 + r) * sy;
        votes[0] = votes[1] = votes[2] = votes[3] = 0;
        votes[center]++;
        for (let k = 0; k < SUBSAMPLES.length; k += 2) votes[layer(x + SUBSAMPLES[k] * sw, y + SUBSAMPLES[k + 1] * sy)]++;
        const hits = votes[1] + votes[2] + votes[3];
        top = center || (votes[3] >= votes[1] && votes[3] >= votes[2] ? 3 : votes[2] >= votes[1] ? 2 : 1);
        alpha = Math.round((hits / 5) * 255);
      }
      const color = COLORS[top];
      data[p] = color[0];
      data[p + 1] = color[1];
      data[p + 2] = color[2];
      data[p + 3] = alpha;
    }
  }

  const sctx = sprite.canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  sctx.putImageData(image, 0, 0, 0, 0, cols, rows);
  sprite.cols = cols;
  sprite.rows = rows;
  // Where the image sits relative to the bird, so a cache hit lands it in the same place.
  now.push(c0 * sw - cx, r0 * sy - cy);
  sprite.drawn = now;
  blit(ctx, sprite, cx, cy, sw, sy);
}

/** Convex hull of flat [x, y, …] points, as a flat closed loop (monotone chain). */
function hull(pts: number[]) {
  const idx = Array.from({ length: pts.length / 2 }, (_, k) => k).sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const turn = (o: number, a: number, b: number) =>
    (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
  const chain = (order: number[]) => {
    const out: number[] = [];
    for (const p of order) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const loop = [...chain(idx), ...chain(idx.slice().reverse())];
  return loop.flatMap((k) => [pts[k * 2], pts[k * 2 + 1]]);
}

const extent = [0, 0];

/** The hull's left and right extent within the band y0 ≤ y ≤ y1 (left > right if it misses). */
function hullSpan(loop: number[], y0: number, y1: number) {
  extent[0] = Infinity;
  extent[1] = -Infinity;
  const n = loop.length / 2;
  for (let k = 0; k < n; k++) {
    const ax = loop[k * 2], ay = loop[k * 2 + 1];
    const bx = loop[((k + 1) % n) * 2], by = loop[((k + 1) % n) * 2 + 1];
    // Clip the edge to the band; a convex shape is widest somewhere on its boundary.
    const lo = Math.max(y0, Math.min(ay, by));
    const hi = Math.min(y1, Math.max(ay, by));
    if (lo > hi) continue;
    for (const y of [lo, hi]) {
      const x = ay === by ? (y === lo ? Math.min(ax, bx) : Math.max(ax, bx)) : ax + ((bx - ax) * (y - ay)) / (by - ay);
      extent[0] = Math.min(extent[0], x);
      extent[1] = Math.max(extent[1], x);
    }
  }
  return extent;
}

/** Draw a bird's image onto the sky, one sub-cell per pixel, kept crisp. */
function blit(ctx: CanvasRenderingContext2D, sprite: Sprite, cx: number, cy: number, sw: number, sy: number) {
  const { drawn, cols, rows } = sprite;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.canvas, 0, 0, cols, rows, cx + drawn[drawn.length - 2], cy + drawn[drawn.length - 1], cols * sw, rows * sy);
  ctx.imageSmoothingEnabled = smoothing;
}
