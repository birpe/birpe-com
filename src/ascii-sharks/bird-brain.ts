/**
 * How the birds behave: their decisions, flight, collision avoidance and perching.
 * The World calls flyBird for each bird every step; nothing here draws anything.
 */
import { clamp, rand, smoothstep, wind } from "./math";
import type { Shark, WorldEvent } from "./world";

/** A spot on the tree a bird can sit on, in px; `long` marks the long resting branch. */
export type Perch = { x: number; y: number; long?: boolean };

/** The parts of the World a bird needs to see. */
export interface Sky {
  width: number;
  height: number;
  time: number;
  sharks: Shark[];
  events: WorldEvent[];
  perches: Perch[];
  /** Per perch: the id of the bird sitting on (or flying to) it, or 0. */
  perchTaken: number[];
}

/**
 * A bird's mind and body. x/y is the centre of its body.
 *
 * It decides for itself: make long passes across its band of sky, glide in a lazy loop, or,
 * when its energy runs low (or it just fancies it), fly to the tree and rest on a branch
 * until it's fresh again. It watches the other bird and steers clear before they meet.
 */
export interface BirdState {
  mode: "patrol" | "soar" | "approach" | "perched" | "takeoff";
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Patrol waypoint, or the centre of a soaring loop. */
  tx: number;
  ty: number;
  /** Seconds left in the current plan: a patrol leg, a loop, a rest, a takeoff. */
  timer: number;
  /** 1 rested → 0 exhausted. Flying drains it, hard flapping faster; resting refills it. */
  energy: number;
  /** Its own band of sky, in px. */
  home: { x0: number; x1: number; y0: number; y1: number };
  /** Which way round the current soaring loop it flies. */
  loop: 1 | -1;
  /** Index into the sky's perches, or -1. */
  perch: number;
  /** 1 in open sky; smaller near the tree, as if the tree stands farther back. */
  scale: number;
  /** Wingbeat strength: 0 gliding, 1 flapping hard. */
  flap: number;
  /** 0 flying, 1 flaring to land (the logo pose, held), 2 perched with wings folded. */
  pose: 0 | 1 | 2;
  /** Which way it faces while perched. */
  face: 1 | -1;
  /** Depth in front of (−) or behind (+) the picture plane, px, and its rate; birds turn through it. */
  z: number;
  vz: number;
  /** Its body axes in screen space (x right, y down, z into the screen): where the beak points, and its back. */
  fwd: V3;
  up: V3;
  /** Perched: which way it looks about the vertical, 0 right to −π left, through facing the viewer. */
  yaw: number;
  /** The side a wide turn in progress swings out toward, held so the bird sweeps round one way. */
  turnVia: V3 | null;
}

export type V3 = [number, number, number];

/** How small a bird draws on its perch, relative to the open sky. */
const PERCH_SCALE = 0.7;
/** Feet below body centre, in bird lengths (from the logo's side view). */
const FOOT_DROP = 0.3;
/** A bird's tightest turn, as a radius in bird lengths, so it arcs instead of pivoting. */
const TURN_RADIUS = 1;
/** How fast it can roll its body, rad/s. */
const ROLL_RATE = 2.5;
/** Past this angle off its heading, rad, it swings out through depth rather than pitching round. */
const WIDE_TURN = 1.2;
/** Half-size of a soaring loop in bird lengths: long across the screen, deep, barely tilted. */
const LOOP_X = 2.2;
const LOOP_Y = 0.35;
const LOOP_Z = 1.3;
/** How far ahead round the loop a soaring bird aims, rad. */
const LOOP_LEAD = 0.8;
/** How far it can stray through depth, in bird lengths. */
const MAX_DEPTH = 2.2;
/** Gravity, px/s²; a bird banks so its lift balances this against the pull of its turn. */
const G = 380;

/** Cruising speed, px/s: quicker in a wider sky, so a pass across it doesn't drag. */
const cruiseSpeed = (W: number) => 70 + W * 0.065;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Scale to unit length in place; returns the length it had. */
function normalize(a: V3) {
  const n = Math.hypot(a[0], a[1], a[2]);
  if (n > 1e-9) {
    a[0] /= n;
    a[1] /= n;
    a[2] /= n;
  }
  return n;
}

/** Remove a's part along unit n and normalize, in place; returns the length left before normalizing. */
function perp(a: V3, n: V3) {
  const d = dot(a, n);
  a[0] -= d * n[0];
  a[1] -= d * n[1];
  a[2] -= d * n[2];
  return normalize(a);
}

/** v turned by `angle` about the unit axis k, right-handed. */
function rotate(v: V3, k: V3, angle: number): V3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}

/** A fresh bird at (x, y), flying along `heading`. */
export function newBird(x: number, y: number, heading: number, W: number, H: number): BirdState {
  const face = Math.cos(heading) >= 0 ? 1 : -1;
  return {
    mode: "patrol",
    x,
    y,
    vx: Math.cos(heading) * 60,
    vy: 0,
    tx: x,
    ty: y,
    timer: 0,
    energy: rand(0.75, 1),
    home: { x0: 0, x1: W, y0: 0, y1: H },
    loop: 1,
    perch: -1,
    scale: 1,
    flap: 0.6,
    pose: 0,
    face,
    z: 0,
    vz: 0,
    fwd: [face, 0, 0],
    up: [0, -1, 0],
    yaw: face === 1 ? 0 : -Math.PI,
    turnVia: null,
  };
}

/** Where birds can land, in px. Birds sitting on a perch that's gone take off. */
export function setPerches(world: Sky, points: Perch[]) {
  world.perches = points;
  world.perchTaken = points.map(() => 0);
  for (const sh of world.sharks) {
    const b = sh.bird;
    if (!b || b.perch < 0) continue;
    if (b.perch >= points.length) {
      b.perch = -1;
      b.mode = "takeoff";
      b.timer = 1.2;
    } else {
      world.perchTaken[b.perch] = sh.id;
    }
  }
}

/**
 * Give each bird its own band of altitude across the whole width of the sky, with a little
 * overlap, so they have room for long passes and usually cross at different heights.
 */
function assignTerritories(world: Sky) {
  const { width: W, height: H } = world;
  const birds = world.sharks.filter((sh) => sh.bird);
  birds.forEach((sh, k) => {
    const span = (H * 0.54) / birds.length;
    sh.bird!.home = {
      x0: W * 0.06,
      x1: W * 0.94,
      y0: H * 0.08 + span * k - span * 0.12,
      y1: H * 0.08 + span * (k + 1) + span * 0.12,
    };
  });
}

/** A free perch, preferring the long branch; -1 when every spot is taken. */
function choosePerch(world: Sky) {
  const free = world.perches.map((p, k) => k).filter((k) => !world.perchTaken[k]);
  if (!free.length) return -1;
  const weights = free.map((k) => (world.perches[k].long ? 3 : 1));
  let pick = Math.random() * weights.reduce((a, w) => a + w, 0);
  for (let n = 0; n < free.length; n++) {
    pick -= weights[n];
    if (pick <= 0) return free[n];
  }
  return free[free.length - 1];
}

/**
 * The bird's decision, made whenever its current plan runs out. Tired birds go to
 * rest; otherwise it mostly makes long passes across its band of sky, sometimes glides a
 * lazy loop, and now and then drops in on the tree just to sit.
 */
function decide(world: Sky, sh: Shark) {
  assignTerritories(world);
  const b = sh.bird!;
  const h = b.home;
  const L = sh.length;
  const r = Math.random();
  const wantsRest = b.energy < 0.3 || (b.energy < 0.7 && r < 0.18);
  if (wantsRest) {
    const perch = choosePerch(world);
    if (perch >= 0) {
      b.perch = perch;
      world.perchTaken[perch] = sh.id;
      b.mode = "approach";
      return;
    }
  }
  const dir = b.vx >= 0 ? 1 : -1;
  const ahead = dir === 1 ? h.x1 - b.x : b.x - h.x0;
  const rx = loopWidth(b, L);
  if (r < 0.2 && ahead > rx * 2) {
    // A lazy loop just ahead of it, mostly gliding, joined from the way it's already going.
    b.mode = "soar";
    b.tx = b.x + dir * rx;
    b.ty = clamp(b.y, h.y0 + L * LOOP_Y, Math.max(h.y0 + L * LOOP_Y, h.y1 - L * LOOP_Y));
    b.loop = Math.random() < 0.5 ? 1 : -1;
    b.timer = rand(8, 13);
  } else {
    // A long pass: carry on the way it's heading while there's room, and only near the
    // edge of the sky turn back for the far side.
    b.mode = "patrol";
    const minRun = Math.min(h.x1 - h.x0, Math.max(L * 3, world.width * 0.3));
    const way = ahead >= minRun ? dir : -dir;
    const room = way === dir ? ahead : h.x1 - h.x0 - ahead;
    const run = rand(Math.min(minRun, room), room);
    b.tx = b.x + way * run;
    b.ty = clamp(b.y + rand(-0.3, 0.3) * run, h.y0, h.y1);
    b.timer = run / cruiseSpeed(world.width) + 3;
  }
}

/** Half the width of a soaring loop, kept within its band of sky. */
const loopWidth = (b: BirdState, L: number) => Math.min(L * LOOP_X, (b.home.x1 - b.home.x0) / 2);

/**
 * Fly one bird for dt, in three dimensions. It steers by swinging its heading at a
 * limited rate rather than braking, so it always sweeps round in a wide arc: turning back
 * on itself it swings through depth toward or away from the viewer, rising or falling a
 * little. It banks into every turn, climbs and dives steeply but never just drops, flaps
 * hard to climb and glides to descend, avoids the other bird ahead of time and drifts a
 * little with the wind. Landing shrinks it toward the tree's scale.
 */
export function flyBird(world: Sky, sh: Shark, dt: number) {
  const b = sh.bird!;
  const { width: W, height: H, time } = world;
  const L = sh.length;
  const S = cruiseSpeed(W);
  const breeze = wind(time);
  const cruiseTurn = S / (L * TURN_RADIUS);

  let wantVx = b.vx;
  let wantVy = b.vy;
  // Drift back toward the picture plane after swinging out through depth.
  let wantVz = -b.z * 0.6;
  let steep = 0.8;
  let turnRate = cruiseTurn;
  let flapTarget = 0.6;
  let scaleTarget = 1;
  let avoid = 1;
  b.pose = 0;

  if (b.mode === "patrol" || b.mode === "soar") {
    b.timer -= dt;
    // Close enough once inside its own turning circle, or it would just circle the waypoint.
    const arrived = L * TURN_RADIUS * 1.4;
    if (b.timer <= 0 || (b.mode === "patrol" && Math.hypot(b.tx - b.x, b.ty - b.y) < arrived)) decide(world, sh);
  }

  if (b.mode === "patrol") {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy) || 1;
    wantVx = (dx / d) * S;
    // Not ruler-straight: a slow rise and fall, and a slow drift through depth.
    wantVy = (dy / d + Math.sin(time * 0.8 + sh.id * 2.1) * 0.1) * S;
    wantVz += Math.sin(time * 0.5 + sh.id) * S * 0.12;
  } else if (b.mode === "soar") {
    // Aim a little ahead of where it is on the loop. The aim moves with the bird, so it
    // can never catch it and fall into circling the spot.
    const rx = loopWidth(b, L);
    const aim = Math.atan2(b.z / (L * LOOP_Z), (b.x - b.tx) / rx) + b.loop * LOOP_LEAD;
    const dx = b.tx + Math.cos(aim) * rx - b.x;
    const dy = b.ty + Math.sin(aim) * L * LOOP_Y - b.y;
    const dz = Math.sin(aim) * L * LOOP_Z - b.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    wantVx = (dx / d) * S * 0.85;
    wantVy = (dy / d) * S * 0.85;
    wantVz = (dz / d) * S * 0.85;
    // Mostly gliding, with a burst of wingbeats every few seconds.
    flapTarget = Math.sin(time * 0.9 + sh.id * 2.3) > 0.4 ? 0.85 : 0.1;
  }

  if (b.mode === "approach") {
    const p = world.perches[b.perch];
    if (!p) {
      b.perch = -1;
      decide(world, sh);
    } else {
      const tx = p.x;
      const ty = p.y - FOOT_DROP * L * b.scale;
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy, b.z);
      // Shrink toward the tree's scale as it closes in, so it fits on the branch.
      scaleTarget = PERCH_SCALE + (1 - PERCH_SCALE) * clamp(d / (Math.min(W, H) * 0.6), 0, 1);
      const pace = S * clamp(d / (L * 0.6), 0.25, 1);
      wantVx = (dx / (d || 1)) * pace;
      wantVy = (dy / (d || 1)) * pace;
      wantVz = (-b.z / (d || 1)) * pace;
      steep = 0.95;
      // Tighter and tighter turns as it homes in, so it doesn't circle the branch.
      turnRate = cruiseTurn + 5 * (1 - clamp(d / (L * 1.5), 0, 1));
      if (d < L * 0.9) {
        // Flare: wings up in the logo pose, braking into the landing.
        b.pose = 1;
        flapTarget = 0;
        avoid = 0;
      }
      if (d < 4) {
        b.mode = "perched";
        b.x = tx;
        b.y = ty;
        b.z = 0;
        b.vx = 0;
        b.vy = 0;
        b.vz = 0;
        b.turnVia = null;
        // Mostly face into the page, away from the corner.
        b.face = p.x > W * 0.5 ? -1 : 1;
        if (Math.random() < 0.3) b.face = b.face === 1 ? -1 : 1;
        // Settle from however it came in, then turn to face that way.
        b.yaw = -Math.abs(Math.atan2(b.fwd[2], b.fwd[0]));
        // Rest until fresh, then linger a little: longer on the long branch.
        b.timer = rand(3, 8) + (p.long ? rand(4, 10) : 0);
        world.events.push({ kind: "rustle", x: p.x, y: p.y });
      }
    }
  }

  if (b.mode === "perched") {
    const p = world.perches[b.perch];
    b.pose = 2;
    b.scale = PERCH_SCALE;
    b.energy = Math.min(1, b.energy + dt * 0.07);
    if (p) {
      b.x = p.x;
      b.y = p.y - FOOT_DROP * L * b.scale;
    }
    // Now and then it turns to look the other way, swinging round through the viewer.
    if (Math.random() < dt * 0.1) b.face = b.face === 1 ? -1 : 1;
    const yawTarget = b.face === 1 ? 0 : -Math.PI;
    b.yaw += clamp(yawTarget - b.yaw, -dt * 3.5, dt * 3.5);
    orient(b, [Math.cos(b.yaw), 0, Math.sin(b.yaw)], [0, 0, 0], dt, Math.min(1, dt * 8));
    if (b.energy > 0.95) b.timer -= dt;
    if (b.timer <= 0 || !p) {
      if (p) world.events.push({ kind: "rustle", x: p.x, y: p.y });
      if (b.perch >= 0) world.perchTaken[b.perch] = 0;
      b.perch = -1;
      b.mode = "takeoff";
      b.timer = 1.4;
      b.face = b.fwd[0] >= 0 ? 1 : -1;
      b.vx = b.fwd[0] * S * 0.35;
      b.vy = -S * 0.45;
      b.vz = b.fwd[2] * S * 0.35;
    }
    sh.heading = b.face === 1 ? 0 : Math.PI;
    sh.speed = 0;
    sh.phase += dt * 2;
    b.flap = 0;
    placeBirdNodes(sh);
    return;
  }

  if (b.mode === "takeoff") {
    b.timer -= dt;
    wantVx = b.face * S;
    wantVy = -S * 0.42;
    wantVz = -b.z;
    flapTarget = 1;
    scaleTarget = b.scale + 0.25;
    if (b.timer <= 0) decide(world, sh);
  }

  // See the other bird coming: find where the two will be closest over the next two
  // seconds and steer apart before then, one rising and one dropping.
  for (const o of world.sharks) {
    if (o === sh || !o.bird) continue;
    const ob = o.bird;
    const rx = b.x - ob.x;
    const ry = b.y - ob.y;
    const rz = b.z - ob.z;
    const rvx = b.vx - ob.vx;
    const rvy = b.vy - ob.vy;
    const rvz = b.vz - ob.vz;
    const rv2 = rvx * rvx + rvy * rvy + rvz * rvz;
    const tc = rv2 > 1e-3 ? clamp(-(rx * rvx + ry * rvy + rz * rvz) / rv2, 0, 2) : 0;
    const cx = rx + rvx * tc;
    const cy = ry + rvy * tc;
    const cz = rz + rvz * tc;
    const miss = Math.hypot(cx, cy, cz);
    const safe = (L * b.scale + o.length * ob.scale) * 0.75;
    if (miss < safe) {
      const urgency = (1 - miss / safe) * (1 - tc / 2.5) * avoid;
      const away = miss > 1e-3 ? 1 / miss : 0;
      const side = sh.id < o.id ? -1 : 1;
      wantVx += (miss > 1e-3 ? cx * away : side) * S * 1.6 * urgency;
      wantVy += ((miss > 1e-3 ? cy * away : 0) * 1.6 + side * 0.8) * S * urgency;
      wantVz += cz * away * S * 1.6 * urgency;
    }
  }

  // Never steeper than a strong climb or dive: birds bank and glide, they don't drop.
  const speedWant = Math.hypot(wantVx, wantVy, wantVz) || 1;
  wantVy = clamp(wantVy, -steep * speedWant, steep * speedWant);
  const before: V3 = [b.fwd[0], b.fwd[1], b.fwd[2]];
  if (b.pose === 1) {
    // Flaring: brake straight onto the branch.
    const ease = Math.min(1, dt * 2);
    b.vx += (wantVx - b.vx) * ease;
    b.vy += (wantVy - b.vy) * ease;
    b.vz += (wantVz - b.vz) * ease;
  } else {
    steer(b, wantVx, wantVy, wantVz, turnRate, Math.min(1, dt * (b.mode === "approach" ? 2 : 1.3)), dt, L);
  }
  // Belt and braces: whatever pushed it, a flying bird never sinks faster than its steepest dive.
  if (b.mode !== "approach") b.vy = Math.min(b.vy, steep * Math.hypot(b.vx, b.vy, b.vz));
  b.x += (b.vx + breeze * 14) * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.x = clamp(b.x, -L, W + L);
  b.y = clamp(b.y, L * 0.2, H - L * 0.2);
  b.z = clamp(b.z, -L * MAX_DEPTH, L * MAX_DEPTH);

  // The body follows its flight path, banking with the pull of the turn.
  const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
  if (speed > S * 0.15) {
    const f: V3 = [b.vx / speed, b.vy / speed, b.vz / speed];
    const k = speed / Math.max(dt, 1e-3);
    orient(b, f, [(f[0] - before[0]) * k, (f[1] - before[1]) * k, (f[2] - before[2]) * k], dt, 1);
  }

  // Flap hard to climb, glide to descend; flying wears it out.
  if (b.pose === 0 && b.mode !== "takeoff" && b.mode !== "soar") flapTarget = clamp(0.75 - (b.vy / speed) * 1.4, 0.2, 1);
  b.flap += (flapTarget - b.flap) * Math.min(1, dt * 2);
  b.energy = Math.max(0, b.energy - dt * (0.012 + 0.02 * b.flap));
  b.scale += (clamp(scaleTarget, PERCH_SCALE, 1) - b.scale) * Math.min(1, dt * 1.5);

  sh.speed = speed;
  sh.heading = Math.atan2(b.vy, b.vx);
  sh.turn = 0;
  // Wingbeat clock; quicker when flapping hard.
  sh.phase += dt * (12 + 10 * b.flap);
  placeBirdNodes(sh);
}

/**
 * Swing the bird's velocity toward the wanted one: its heading turns at most `rate`
 * rad/s and its speed eases separately, so it sweeps round instead of stalling. In a wide
 * turn it holds one way round for the whole turn.
 */
function steer(b: BirdState, wx: number, wy: number, wz: number, rate: number, speedEase: number, dt: number, L: number) {
  const want = Math.hypot(wx, wy, wz);
  let speed = Math.hypot(b.vx, b.vy, b.vz);
  let v: V3 = speed > 1e-3 ? [b.vx / speed, b.vy / speed, b.vz / speed] : [b.fwd[0], b.fwd[1], b.fwd[2]];
  speed += (want - speed) * speedEase;
  if (want > 1e-3) {
    const w: V3 = [wx / want, wy / want, wz / want];
    const angle = Math.acos(clamp(dot(v, w), -1, 1));
    if (angle < 0.5) b.turnVia = null;
    else if (angle > WIDE_TURN && !b.turnVia) b.turnVia = pickTurn(b, w, L);
    let aim = w;
    if (b.turnVia) {
      // Aim to the side of the wanted heading, less and less as it comes round, so the
      // turn sweeps out one way and still always ends up on the wanted heading.
      const s = b.turnVia;
      const lean = smoothstep(0.5, WIDE_TURN, angle);
      const along = dot(s, w);
      aim = [w[0] + (s[0] - along * w[0]) * lean, w[1] + (s[1] - along * w[1]) * lean, w[2] + (s[2] - along * w[2]) * lean];
      normalize(aim);
    }
    const axis = cross(v, aim);
    normalize(axis);
    v = rotate(v, axis, Math.min(Math.acos(clamp(dot(v, aim), -1, 1)), rate * dt));
  }
  b.vx = v[0] * speed;
  b.vy = v[1] * speed;
  b.vz = v[2] * speed;
}

/**
 * Which way a bird swings out on a wide turn toward heading `w`: round through depth,
 * toward or away from the viewer (back toward the picture plane if it has strayed far),
 * rising if it's low in its band of sky and falling if it's high. It never pitches up and over.
 */
function pickTurn(b: BirdState, w: V3, L: number): V3 {
  const climb = rand(0.3, 0.9);
  const rise = b.y > (b.home.y0 + b.home.y1) / 2 ? 1 : -1;
  const depth = b.z > L * 0.3 ? -1 : b.z < -L * 0.3 ? 1 : Math.random() < 0.65 ? -1 : 1;
  const via: V3 = [0, -rise * Math.sin(climb), depth * Math.cos(climb)];
  if (perp(via, w) < 1e-6) return [1, 0, 0];
  return via;
}

/**
 * Point the body along `f` (blending `follow` of the way there), carry its back along,
 * then roll it toward where its lift should point: straight up in level flight, leaning
 * into the pull `accel` of a turn. Through a loop it ends up inverted and rolls upright.
 */
function orient(b: BirdState, f: V3, accel: V3, dt: number, follow: number) {
  const F = b.fwd;
  F[0] += (f[0] - F[0]) * follow;
  F[1] += (f[1] - F[1]) * follow;
  F[2] += (f[2] - F[2]) * follow;
  if (normalize(F) < 1e-6) b.fwd = [f[0], f[1], f[2]];
  const U = b.up;
  if (perp(U, b.fwd) < 1e-6) {
    b.up = [0, -1, 0];
    if (perp(b.up, b.fwd) < 1e-6) {
      b.up = [0, 0, -1];
      perp(b.up, b.fwd);
    }
  }
  const a = Math.hypot(accel[0], accel[1], accel[2]);
  const k = a > G * 1.6 ? (G * 1.6) / a : 1;
  const lift: V3 = [accel[0] * k, accel[1] * k - G, accel[2] * k];
  // Flying straight up or down with nothing pulling it round, there's no way to lean: hold.
  const lean = perp(lift, b.fwd);
  if (lean < G * 0.05) return;
  const angle = Math.atan2(dot(cross(b.up, lift), b.fwd), dot(b.up, lift));
  const turn = clamp(angle * Math.min(1, dt * 5), -ROLL_RATE * dt, ROLL_RATE * dt) * Math.min(1, lean / (G * 0.3));
  b.up = rotate(b.up, b.fwd, turn);
}

/** Lay the sim spine along the bird so fish keep their distance from it. */
function placeBirdNodes(sh: Shark) {
  const b = sh.bird!;
  const L = sh.length * b.scale;
  const fx = Math.cos(sh.heading);
  const fy = Math.sin(sh.heading);
  const count = sh.nodes.length / 2;
  const seg = L / (count - 1);
  for (let k = 0; k < count; k++) {
    sh.nodes[k * 2] = b.x + fx * (L * 0.45 - seg * k);
    sh.nodes[k * 2 + 1] = b.y + fy * (L * 0.45 - seg * k);
  }
}
