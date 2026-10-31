/**
 * How the bird flies: a small flight model with a mind on top. The World calls flyBird
 * every step; nothing here draws anything.
 *
 * The body obeys forces rather than heading for points. Lift acts along its back, so it has
 * to roll to turn; climbing spends speed, diving earns it back, drag bleeds it off, and
 * too slow its wings stop holding it up unless it flaps. Nothing here sets a path, so its
 * flight comes out as arcs, swoops and stalls.
 *
 * The mind only moves the controls: it flies one manoeuvre at a time, chosen by where it
 * is, how tired it is and what it has just done, as a short list of steps ("roll left and
 * hold it until you've come round", "dive with wings tucked until you're fast").
 */
import { angleDiff, clamp, rand, smoothstep, wind } from "./math";
import type { Shark, WorldEvent } from "./world";

/** A spot on the tree the bird can sit on, in px; `long` marks the long resting branch. */
export type Perch = { x: number; y: number; long?: boolean };

/** The parts of the World the bird needs to see. */
export interface Sky {
  width: number;
  height: number;
  time: number;
  events: WorldEvent[];
  perches: Perch[];
  pointer: { x: number; y: number; active: boolean };
}

export type V3 = [number, number, number];

/** One stretch of a manoeuvre: what to hold on the controls, and until when. */
interface Step {
  /** Heading rate to hold, rad/s, signed. */
  turn?: number;
  /** Heading to come round to, in the ground plane: 0 is right, π left, positive into the screen. */
  heading?: number;
  /** Fly toward this point in the sky, heading and climb both. */
  aim?: { x: number; y: number };
  /** Flight path to hold, rad: positive climbs. */
  climb?: number;
  /**
   * Tips a turn's circle toward the viewer, rad, so it climbs going one way round and
   * sinks coming back. A level turn runs through depth and looks flat on a flat screen; this
   * makes it a loop you can see.
   */
  tilt?: number;
  /** Speed it's happy at, in cruising speeds. */
  pace?: number;
  /** "auto" flaps in bursts to keep up its pace. */
  flap?: "auto" | "hard" | "none";
  /** How far its wings fold back, 0 to 1. */
  tuck?: number;
  /** Rising air under it, in cruising speeds. */
  lift?: number;
  /** Ends after this many seconds. */
  time?: number;
  /** Ends early when this says so, given the bird and its speed in cruising speeds. */
  until?: (b: BirdState, pace: number) => boolean;
  /** Already turning back from the edge of the sky, so don't start another. */
  turningBack?: boolean;
  /** Can't be interrupted. */
  locked?: boolean;
}

/** A cubic from where the bird was to the branch, flown exactly over `time` seconds. */
interface Approach {
  from: V3;
  to: V3;
  leave: V3;
  arrive: V3;
  time: number;
  age: number;
  scale: number;
}

/**
 * The bird's mind and body. x/y is the centre of its body, z its depth: positive is
 * into the screen. fwd and up are its body axes on screen, for drawing.
 */
export interface BirdState {
  mode: "parked" | "flying" | "landing" | "perched";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fwd: V3;
  up: V3;
  /** Where its lift points: always square to its velocity. Rolling is moving this. */
  bank: V3;
  /** 1 in open sky; smaller on the branch, as if the tree stands farther back. */
  scale: number;
  /** Wingbeat strength: 0 gliding, 1 flapping hard. */
  flap: number;
  flapping: boolean;
  /** 0 spread, 1 folded along the body. */
  tuck: number;
  /** 1 is the logo's exact pose, wings raised: how it leaves the logo and how it brakes to land. */
  logoPose: number;
  /** 1 rested → 0 exhausted. Flapping drains it fastest; resting refills it. */
  energy: number;
  /** What it's in the middle of, what it did before that, and the steps left. */
  move: string;
  lastMove: string;
  plan: Step[];
  /** Seconds into the current step, and how far it has turned in it, rad. */
  age: number;
  turned: number;
  /** Heading in the ground plane, kept through moments when it isn't really moving. */
  psi: number;
  approach: Approach | null;
  /** Index into the sky's perches, or -1. */
  perch: number;
  /** Perched: seconds left, which way it wants to face, and which way it's looking. */
  timer: number;
  face: 1 | -1;
  yaw: number;
}

/** How small the bird draws on its perch, relative to the open sky. */
const PERCH_SCALE = 0.7;
/** Feet below body centre, in bird lengths (from the logo's side view). */
const FOOT_DROP = 0.3;
/** The most depth it uses, in bird lengths. */
const MAX_DEPTH = 2.4;
/** Drag in level flight, in g: how fast a glide bleeds off speed. */
const LEVEL_DRAG = 0.12;
/** The most thrust a wingbeat gives, in g. */
const THRUST = 0.62;
/** The most lift its wings give at cruising speed, in g; it grows with speed squared. */
const WING_LIFT = 2.6;
/** The lift flapping adds, in g, whatever its speed: how it gets off a branch. */
const FLAP_LIFT = 1.1;
/** The hardest it can pull, in g. */
const MAX_PULL = 3;
/** Speeds below this, in cruising speeds, count as a stall. */
const STALL = 0.55;

/** Cruising speed, px/s: quicker in a wider sky, so a pass across it doesn't drag. */
const cruiseSpeed = (W: number) => 90 + W * 0.09;
/** Gravity, px/s²: scaled so a 45° bank at cruising speed turns in 1.6 bird lengths on any screen. */
const gravity = (S: number, L: number) => (S * S) / (1.6 * L);

const pick = <T,>(...options: T[]) => options[Math.floor(Math.random() * options.length)];

function normalize(a: V3) {
  const n = Math.hypot(a[0], a[1], a[2]);
  if (n > 1e-9) {
    a[0] /= n;
    a[1] /= n;
    a[2] /= n;
  }
  return n;
}

/** Make a square to unit n and normalize it, in place; false if it lay along n. */
function square(a: V3, n: V3) {
  const d = a[0] * n[0] + a[1] * n[1] + a[2] * n[2];
  a[0] -= d * n[0];
  a[1] -= d * n[1];
  a[2] -= d * n[2];
  return normalize(a) > 1e-6;
}

/** A fresh bird at (x, y), flying level along `heading`. */
export function newBird(x: number, y: number, heading: number, W: number): BirdState {
  const face = Math.cos(heading) >= 0 ? 1 : -1;
  return {
    mode: "flying",
    x,
    y,
    z: 0,
    vx: face * cruiseSpeed(W),
    vy: 0,
    vz: 0,
    fwd: [face, 0, 0],
    up: [0, -1, 0],
    bank: [0, -1, 0],
    scale: 1,
    flap: 0.3,
    flapping: false,
    tuck: 0,
    logoPose: 0,
    energy: rand(0.75, 1),
    move: "",
    lastMove: "",
    plan: [],
    age: 0,
    turned: 0,
    psi: face === 1 ? 0 : Math.PI,
    approach: null,
    perch: -1,
    timer: 0,
    face,
    yaw: face === 1 ? 0 : -Math.PI,
  };
}

/** Keep the bird out of the sky, and out of the fish's way, until it's launched or released. */
export function parkBird(sh: Shark) {
  sh.bird!.mode = "parked";
  sh.speed = 0;
  sh.nodes.fill(-1e4);
}

/** A parked bird joins the sky from wherever it was seeded. */
export function releaseBird(sh: Shark) {
  const b = sh.bird!;
  if (b.mode !== "parked") return;
  b.mode = "flying";
  placeBirdNodes(sh);
}

/**
 * Start a parked bird from the logo: at (x, y), `length` px long, side-on in the logo's pose,
 * moving just enough to hold that heading. It beats hard to get going, then drops away
 * across the sky to pick up speed.
 */
export function launchBird(world: Sky, sh: Shark, x: number, y: number, length: number) {
  const b = sh.bird!;
  b.mode = "flying";
  b.x = x;
  b.y = y;
  b.z = 0;
  b.vx = cruiseSpeed(world.width) * 0.35;
  b.vy = 0;
  b.vz = 0;
  b.fwd = [1, 0, 0];
  b.up = [0, -1, 0];
  b.bank = [0, -1, 0];
  b.psi = 0;
  b.scale = length / sh.length;
  b.flap = 1;
  b.flapping = true;
  b.logoPose = 1;
  setPlan(b, "launch", [
    { heading: 0.1, climb: 0.08, flap: "hard", pace: 1.2, time: 0.4, locked: true },
    { heading: 0.1, climb: -0.42, flap: "hard", pace: 1.3, time: 1, locked: true },
    { heading: 0, climb: 0.22, pace: 1.1, time: 0.9, locked: true },
  ]);
  sh.phase = 0;
  sh.heading = 0;
  sh.speed = b.vx;
  placeBirdNodes(sh);
}

/** Where the bird can land, in px. If its branch has gone, it takes off. */
export function setPerches(world: Sky, points: Perch[]) {
  world.perches = points;
}

/** The sky changed size by (kx, ky): keep the bird at the same place in it, and rethink. */
export function refitBirds(sh: Shark, kx: number, ky: number) {
  const b = sh.bird;
  if (!b) return;
  b.x *= kx;
  b.y *= ky;
  if (b.mode === "landing") {
    b.mode = "flying";
    b.approach = null;
    b.perch = -1;
  }
  if (b.mode === "flying" && !b.plan[0]?.locked) b.plan = [];
}

function setPlan(b: BirdState, move: string, plan: Step[]) {
  if (move !== b.move) b.lastMove = b.move;
  b.move = move;
  b.plan = plan;
  b.age = 0;
  b.turned = 0;
}

/** Which way round to turn for room: back toward the picture plane, or either way when it's close to it. */
function turnSign(b: BirdState, L: number) {
  const hx = Math.cos(b.psi);
  if (Math.abs(b.z) < L * 0.4) return pick(1, -1);
  // A positive turn moves the heading toward +z while it's flying right, and -z flying left.
  return (hx >= 0 ? 1 : -1) * (b.z > 0 ? -1 : 1);
}

/** Heading level across the screen, tilted a little through depth so no two passes line up. */
const acrossHeading = (toRight: boolean) => (toRight ? 0 : Math.PI) + rand(-0.32, 0.32);

const speedAt = (b: BirdState) => Math.hypot(b.vx, b.vy, b.vz);
/** The heading rate for turning back at this speed: tighter in a narrow sky, which has less room to do it in. */
const hardTurn = (speed: number, W: number) => Math.max(1.5, speed / (W * 0.16));

/** Pointing back into the sky from the edge. */
const inward = (b: BirdState, W: number) => (W / 2 - b.x) * Math.cos(b.psi) > 0 && Math.abs(Math.cos(b.psi)) > 0.55;

/** Come back from the edge of the sky: over the top if it has the speed and the room, otherwise a hard carve. */
function turnBack(world: Sky, sh: Shark, pace: number) {
  const b = sh.bird!;
  const L = sh.length;
  const W = world.width;
  const sign = turnSign(b, L);
  const home = (x: BirdState) => inward(x, W);
  if (pace > 0.95 && b.y > Math.max(L * 0.4, world.height * 0.06) + L * 2 && b.move !== "wingover" && b.lastMove !== "wingover" && Math.random() < 0.4) {
    setPlan(b, "wingover", [
      { climb: 0.8, flap: "none", time: 1.2, until: (_, p) => p < 0.72, turningBack: true },
      { turn: sign * 2.6, climb: 0.1, flap: "auto", pace: 0.8, time: 3, until: home, turningBack: true },
      { climb: -0.5, flap: "none", tuck: 0.45, time: 1.2, until: (_, p) => p > 1.2 },
      { climb: 0, time: 0.6 },
    ]);
  } else {
    setPlan(b, "carve back", [
      { turn: sign * hardTurn(speedAt(b), W), tilt: pick(0.4, -0.4), pace: 1.05, time: 4, until: home, turningBack: true },
    ]);
  }
}

/** Its next manoeuvre, weighed by where it is, how it feels and what it just did. */
function nextMove(world: Sky, sh: Shark) {
  const b = sh.bird!;
  const { width: W, height: H, perches, pointer } = world;
  const L = sh.length;
  const S = cruiseSpeed(W);
  const low = b.y / H;
  const hx = Math.cos(b.psi);
  const room = (hx >= 0 ? W - b.x : b.x) / S;
  const moves: [string, number][] = [
    ["traverse", 3.5],
    ["meander", 2],
    ["carve", 3],
    ["bound", room > 3 ? 1.2 : 0],
    ["soar", low > 0.3 ? 2.5 : 0.6],
    ["swoop", low < 0.5 && room > 1.5 ? 2.8 : 0],
    ["climb out", low > 0.55 ? 3 : 0],
    ["look", pointer.active ? 1.2 : 0],
    ["rest", perches.length && b.energy < 0.3 ? 40 : perches.length && b.energy < 0.8 ? 1.4 : 0],
  ];
  let total = 0;
  for (const m of moves) {
    // Never the same thing twice, and less likely to go back to what it did before that.
    if (m[0] === b.move) m[1] = 0;
    else if (m[0] === b.lastMove) m[1] *= 0.35;
    total += m[1];
  }
  let at = Math.random() * total;
  let choice = "traverse";
  for (const [name, weight] of moves) {
    at -= weight;
    if (weight > 0 && at <= 0) {
      choice = name;
      break;
    }
  }

  const toRight = (W / 2 - b.x) * hx > 0 ? hx >= 0 : b.x < W / 2;
  const sign = turnSign(b, L);
  switch (choice) {
    case "traverse": {
      // Off to some other part of the sky: rarely level, and rarely all the way across.
      const x = clamp(b.x + (Math.random() < 0.75 ? 1 : -1) * (hx >= 0 ? 1 : -1) * rand(W * 0.25, W * 0.6), W * 0.1, W * 0.9);
      const y = H * rand(0.1, 0.72);
      setPlan(b, choice, [{ aim: { x, y }, pace: rand(0.9, 1.15), time: 1 + (1.5 * Math.hypot(x - b.x, y - b.y)) / S, until: (a) => Math.hypot(a.x - x, a.y - y) < L }]);
      break;
    }
    case "meander": {
      const legs: Step[] = [];
      let side = sign;
      for (let n = Math.floor(rand(3, 6)); n > 0; n--) {
        legs.push({ turn: side * rand(0.5, 1), climb: side * rand(0.1, 0.3), pace: 1, time: rand(0.8, 1.5) });
        side = -side as 1 | -1;
      }
      setPlan(b, choice, legs);
      break;
    }
    case "carve": {
      // Most of a circle or just a change of mind, tipping into it or sinking out of it.
      const angle = pick(rand(1.2, 2.4), rand(3.6, 5.5));
      setPlan(b, choice, [{ turn: sign * rand(0.9, 1.5), tilt: pick(1, -1) * rand(0.3, 0.55), pace: 1.05, time: 8, until: (x) => x.turned >= angle }]);
      break;
    }
    case "bound": {
      // Like a finch: a few beats up, then wings shut and a dip, over and over.
      const hops: Step[] = [];
      for (let n = Math.floor(rand(3, 6)); n > 0; n--) {
        hops.push({ climb: 0.3, flap: "hard", pace: 1.2, time: 0.62, heading: toRight ? 0 : Math.PI });
        hops.push({ climb: -0.24, flap: "none", tuck: 0.8, time: 0.62, heading: toRight ? 0 : Math.PI });
      }
      setPlan(b, choice, hops);
      break;
    }
    case "soar": {
      // Round and round on rising air, not a wingbeat, as wide as the sky lets it.
      const radius = Math.min(W * 0.26, L * MAX_DEPTH * 0.85);
      setPlan(b, choice, [{ turn: (sign * S * 0.95) / radius, tilt: 0.36, pace: 0.95, flap: "none", lift: 0.14, time: rand(5, 11), until: (x) => x.y < H * 0.14 }]);
      break;
    }
    case "swoop":
      setPlan(b, choice, [
        { climb: -0.72, flap: "none", tuck: 0.85, turn: sign * rand(0, 0.3), time: 2.2, until: (_, p) => p > 1.65 },
        { climb: 0.62, flap: "none", time: 2, until: (_, p) => p < 1 },
        { climb: 0.02, pace: 1, time: 0.7 },
      ]);
      break;
    case "climb out":
      setPlan(b, choice, [
        { heading: acrossHeading(toRight), climb: 0.42, flap: "hard", pace: 1.1, time: 2, until: (x) => x.y < H * 0.3 },
        { climb: 0.05, pace: 1, time: 0.8 },
      ]);
      break;
    case "look":
      setPlan(b, choice, [{ aim: { x: pointer.x, y: pointer.y - L * 0.9 }, pace: 1.05, time: 3.5, until: (x) => Math.hypot(x.x - pointer.x, x.y - pointer.y + L * 0.9) < L * 0.9 }]);
      break;
    case "rest":
      planLanding(world, sh);
      break;
  }
}

/** Head for a branch, the long one by choice; the last part is flown as one smooth curve. */
function planLanding(world: Sky, sh: Shark) {
  const b = sh.bird!;
  const weights = world.perches.map((p) => (p.long ? 3 : 1));
  let at = Math.random() * weights.reduce((a, w) => a + w, 0);
  let perch = world.perches.length - 1;
  for (let n = 0; n < weights.length; n++) {
    at -= weights[n];
    if (at <= 0) {
      perch = n;
      break;
    }
  }
  b.perch = perch;
  const p = world.perches[perch];
  setPlan(b, "rest", [{ aim: { x: p.x, y: p.y }, pace: 1, time: 7 }]);
}

/** Close enough, and pointing the right way: fly the last of it on a curve that ends at the branch. */
function maybeStartApproach(world: Sky, sh: Shark, S: number) {
  const b = sh.bird!;
  const p = world.perches[b.perch];
  if (!p) {
    b.perch = -1;
    b.plan = [];
    return;
  }
  const L = sh.length;
  const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
  const footY = p.y - FOOT_DROP * L * PERCH_SCALE;
  const dx = p.x - b.x;
  const dy = footY - b.y;
  const d = Math.hypot(dx, dy, b.z);
  const facing = (b.vx * dx + b.vy * dy - b.vz * b.z) / (speed * (d || 1));
  if (d > Math.max(L * 3.2, S * 1.5) || facing < 0.55) return;
  const time = clamp((2.1 * d) / (speed + S * 0.1), 1, 4);
  const side = dx >= 0 ? 1 : -1;
  b.approach = {
    from: [b.x, b.y, b.z],
    to: [p.x, footY, 0],
    leave: [b.vx, b.vy, b.vz],
    arrive: [side * S * 0.14, S * 0.05, 0],
    time,
    age: 0,
    scale: b.scale,
  };
  b.mode = "landing";
  b.plan = [];
}

/** A pointer-tap close by: if it's on a branch or just flying along, it's off. */
function noticeSplash(world: Sky, sh: Shark) {
  const b = sh.bird!;
  if (b.move === "startled" || b.plan[0]?.locked) return;
  for (const e of world.events) {
    if (e.kind !== "splash") continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    if (Math.hypot(dx, dy) > sh.length * 1.6) continue;
    if (b.mode === "perched") takeOff(world, sh);
    if (b.mode === "landing") {
      b.mode = "flying";
      b.approach = null;
      b.perch = -1;
    }
    const away = rand(-0.4, 0.4);
    setPlan(b, "startled", [
      { heading: dx >= 0 ? away : Math.PI - away, climb: 0.6, flap: "hard", pace: 1.5, time: 1.1 },
      { climb: 0, pace: 1.1, time: 0.8 },
    ]);
    return;
  }
}

/** Off the branch: drop forward into the air, beating hard. */
function takeOff(world: Sky, sh: Shark) {
  const b = sh.bird!;
  const S = cruiseSpeed(world.width);
  b.mode = "flying";
  b.perch = -1;
  world.events.push({ kind: "rustle", x: b.x, y: b.y });
  b.vx = b.fwd[0] * S * 0.45;
  b.vy = S * 0.08;
  b.vz = b.fwd[2] * S * 0.45;
  b.psi = Math.atan2(b.fwd[2], b.fwd[0]);
  b.bank = [0, -1, 0];
  b.flapping = true;
  setPlan(b, "take off", [
    { heading: b.face === 1 ? 0 : Math.PI, climb: 0.5, flap: "hard", pace: 1.1, time: 1.3 },
    { climb: 0.04, pace: 1, time: 0.6 },
  ]);
}

/** The controls and the forces: one step of actual flying. */
function fly(world: Sky, sh: Shark, dt: number) {
  const b = sh.bird!;
  const { width: W, height: H, time } = world;
  const L = sh.length;
  const S = cruiseSpeed(W);
  const G = gravity(S, L);

  let speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
  let pace = speed / S;
  const ground = Math.hypot(b.vx, b.vz);
  if (ground > S * 0.05) {
    const psi = Math.atan2(b.vz, b.vx);
    b.turned += Math.abs(angleDiff(b.psi, psi));
    b.psi = psi;
  }

  // What's the plan? Move along it, or think of something new.
  if (!b.plan.length) nextMove(world, sh);
  b.age += dt;
  while (b.plan.length) {
    const s = b.plan[0];
    if ((s.time !== undefined && b.age >= s.time) || s.until?.(b, pace)) {
      b.plan.shift();
      b.age = 0;
      b.turned = 0;
    } else break;
  }
  if (!b.plan.length) nextMove(world, sh);
  if (b.mode !== "flying") return;
  const step: Step = b.plan[0] ?? {};
  if (b.move === "rest" && b.perch >= 0) {
    maybeStartApproach(world, sh, S);
    if (b.mode !== "flying") return;
  }

  // Read the step off onto the controls.
  const gamma = Math.atan2(-b.vy, ground);
  let turn = step.turn ?? 0;
  let climb = (step.climb ?? 0) + (step.tilt ?? 0) * Math.sin(b.psi);
  let tuck = step.tuck ?? 0;
  let flapMode = step.flap ?? "auto";
  const pacing = step.pace ?? 1;
  if (step.aim) {
    const dx = step.aim.x - b.x;
    const dy = step.aim.y - b.y;
    const across = Math.hypot(dx, b.z);
    turn = clamp(angleDiff(b.psi, Math.atan2(-b.z, dx)) * 1.6, -1.7, 1.7);
    climb = clamp(Math.atan2(-dy, across || 1), -0.65, 0.7);
  } else if (step.heading !== undefined) {
    // Drift back toward the picture plane as it goes, so it doesn't end up flying at the viewer.
    const tilt = clamp(b.z / (L * MAX_DEPTH), -1, 1) * 0.45 * (Math.cos(step.heading) >= 0 ? -1 : 1);
    turn += clamp(angleDiff(b.psi, step.heading + tilt) * 1.3, -1.2, 1.2);
  }
  if (!step.locked) {
    // Never quite straight or level: air isn't still, and neither is a bird.
    turn += 0.16 * Math.sin(time * 0.37 + 1.3) + 0.1 * Math.sin(time * 0.93);
    climb += 0.045 * Math.sin(time * 0.53) + 0.03 * Math.sin(time * 1.31 + 2);
  }

  // Stay in the sky. These outrank the plan.
  const top = Math.max(L * 0.4, H * 0.06);
  const bottom = H * 0.8;
  if (!step.locked) {
    if (b.vy > 0 && b.y + (b.vy * b.vy) / (2 * 1.3 * G) + L * 0.3 > bottom) {
      climb = Math.max(climb, 0.5);
      tuck = 0;
    }
    if (b.vy < 0 && b.y - (b.vy * b.vy) / (2 * G) < top) climb = Math.min(climb, -0.05);
    if (b.y < top) climb = Math.min(climb, -0.25);
    if (!step.turningBack && !(b.move === "rest" && step.aim)) {
      // Far enough off to roll in and come round before it's past the edge.
      const ahead = b.x + b.vx * (0.45 + 1 / hardTurn(speed, W));
      const margin = L * 0.15;
      if ((ahead < margin && b.vx < 0) || (ahead > W - margin && b.vx > 0)) {
        turnBack(world, sh, pace);
        return;
      }
    }
  }
  const depth = L * MAX_DEPTH;
  const outward = b.z * b.vz > 0 ? smoothstep(depth * 0.4, depth * 0.85, Math.abs(b.z)) : 0;
  // Not while turning back: the two would cancel out, and it would fly on off the screen.
  if (!step.turningBack) turn += -Math.sign(b.z) * (Math.cos(b.psi) >= 0 ? 1 : -1) * 2.4 * outward;
  // Too slow to fly on the wing: nose down and beat its way out of it.
  if (pace < STALL) {
    climb = Math.min(climb, -0.15);
    flapMode = "hard";
    tuck = 0;
  }

  // Wings: thrust comes in bursts, then it coasts, the way a bird actually keeps up speed.
  if (flapMode === "hard") b.flapping = true;
  else if (flapMode === "none") b.flapping = false;
  else if (pace < pacing * 0.92 || (climb > 0.14 && pace < pacing * 1.1)) b.flapping = true;
  else if (pace > pacing * 1.06) b.flapping = false;
  b.flap += ((b.flapping ? 1 : 0) - b.flap) * Math.min(1, dt * (b.flapping ? 7 : 3.5));
  b.tuck += (tuck - b.tuck) * Math.min(1, dt * 5);
  b.logoPose = Math.max(0, b.logoPose - dt / 0.14);
  sh.phase += dt * (14 + 8 * b.flap);

  // Which way lift has to point to do all that.
  const v: V3 = [b.vx / speed, b.vy / speed, b.vz / speed];
  const normal: V3 = [0, -1, 0];
  if (!square(normal, v)) {
    normal[0] = b.bank[0];
    normal[1] = b.bank[1];
    normal[2] = b.bank[2];
  }
  const hx = ground > 1e-3 ? b.vx / ground : Math.cos(b.psi);
  const hz = ground > 1e-3 ? b.vz / ground : Math.sin(b.psi);
  const up = clamp(G * Math.cos(gamma) + 1.6 * (climb - gamma) * speed, 0.1 * G, 2.4 * G);
  const side = clamp(turn * Math.max(ground, S * 0.3), -2.2 * G, 2.2 * G);
  const wobble = 0.05 * Math.sin(time * 1.7 + 0.6) + 0.035 * Math.sin(time * 3.1);
  const want: V3 = [
    normal[0] * up - hz * (side + wobble * up),
    normal[1] * up,
    normal[2] * up + hx * (side + wobble * up),
  ];
  const pull = Math.min(Math.hypot(up, side), MAX_PULL * G, WING_LIFT * G * pace * pace + FLAP_LIFT * G * b.flap);
  normalize(want);

  // It rolls into that, and only then does the lift start to turn it.
  const roll = Math.min(1, dt * 5);
  b.bank[0] += (want[0] - b.bank[0]) * roll;
  b.bank[1] += (want[1] - b.bank[1]) * roll;
  b.bank[2] += (want[2] - b.bank[2]) * roll;
  if (!square(b.bank, v)) {
    b.bank[0] = normal[0];
    b.bank[1] = normal[1];
    b.bank[2] = normal[2];
  }

  // Its body noses along its flight, higher the slower it goes.
  const nose = (1 - b.logoPose) * clamp((1 - pace) * 0.7, 0, 0.55);
  const follow = Math.min(1, dt * 9);
  b.fwd[0] += (v[0] + b.bank[0] * nose - b.fwd[0]) * follow;
  b.fwd[1] += (v[1] + b.bank[1] * nose - b.fwd[1]) * follow;
  b.fwd[2] += (v[2] + b.bank[2] * nose - b.fwd[2]) * follow;
  normalize(b.fwd);
  b.up = [b.bank[0], b.bank[1], b.bank[2]];
  if (!square(b.up, b.fwd)) b.up = [0, -1, 0];

  // And the forces do the rest.
  const beat = 0.55 + 0.9 * Math.max(0, Math.sin(sh.phase));
  const thrust = THRUST * G * b.flap * beat;
  const drag = ((LEVEL_DRAG * G) / (S * S)) * speed * speed * (1 - 0.35 * b.tuck);
  b.vx += (b.bank[0] * pull + b.fwd[0] * thrust - v[0] * drag) * dt;
  b.vy += (b.bank[1] * pull + b.fwd[1] * thrust - v[1] * drag + G) * dt;
  b.vz += (b.bank[2] * pull + b.fwd[2] * thrust - v[2] * drag) * dt;
  speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
  pace = speed / S;
  b.x += (b.vx + wind(time) * S * 0.07) * dt;
  b.y += (b.vy - (step.lift ?? 0) * S) * dt;
  b.z += b.vz * dt;
  b.x = clamp(b.x, -L * 1.2, W + L * 1.2);
  b.y = clamp(b.y, 0, H - L * 0.2);
  b.z = clamp(b.z, -depth * 1.15, depth * 1.15);

  b.scale += (1 - b.scale) * Math.min(1, dt * 1.1);
  b.energy = Math.max(0, b.energy - dt * (0.008 + 0.02 * b.flap));
  sh.speed = speed;
  sh.heading = Math.atan2(b.vy, b.vx);
  sh.turn = 0;
}

/** The last of an approach: on rails down to the branch, braking with its wings up. */
function land(world: Sky, sh: Shark, dt: number) {
  const b = sh.bird!;
  const a = b.approach;
  const p = world.perches[b.perch];
  if (!a || !p) {
    b.mode = "flying";
    b.approach = null;
    b.perch = -1;
    b.plan = [];
    return;
  }
  a.age += dt;
  const s = Math.min(1, a.age / a.time);
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = 1 - h00;
  const h11 = s3 - s2;
  const d00 = 6 * s2 - 6 * s;
  const d10 = 3 * s2 - 4 * s + 1;
  const d11 = 3 * s2 - 2 * s;
  const at = (n: 0 | 1 | 2) => h00 * a.from[n] + h10 * a.time * a.leave[n] + h01 * a.to[n] + h11 * a.time * a.arrive[n];
  const rate = (n: 0 | 1 | 2) => (d00 * (a.from[n] - a.to[n])) / a.time + d10 * a.leave[n] + d11 * a.arrive[n];
  b.x = at(0);
  b.y = at(1);
  b.z = at(2);
  b.vx = rate(0);
  b.vy = rate(1);
  b.vz = rate(2);
  const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;

  // Flat out at first, then wings up to brake as the branch comes close.
  b.logoPose = smoothstep(0.55, 0.85, s);
  b.flap += (0.5 * (1 - smoothstep(0.35, 0.6, s)) - b.flap) * Math.min(1, dt * 4);
  b.tuck += (0 - b.tuck) * Math.min(1, dt * 5);
  b.scale = a.scale + (PERCH_SCALE - a.scale) * smoothstep(0, 1, s);
  sh.phase += dt * (14 + 8 * b.flap);

  const follow = Math.min(1, dt * 7);
  // The body rears up as it flares.
  const rear = b.logoPose * 0.35;
  const v: V3 = [b.vx / speed, b.vy / speed - rear, b.vz / speed];
  b.fwd[0] += (v[0] - b.fwd[0]) * follow;
  b.fwd[1] += (v[1] - b.fwd[1]) * follow;
  b.fwd[2] += (v[2] - b.fwd[2]) * follow;
  normalize(b.fwd);
  b.bank = [0, -1, 0];
  b.up = [0, -1, 0];
  if (!square(b.up, b.fwd)) b.up = [0, 0, -1];
  sh.speed = speed;
  sh.heading = Math.atan2(b.vy, b.vx);

  if (s >= 1) {
    b.mode = "perched";
    b.approach = null;
    b.x = a.to[0];
    b.y = a.to[1];
    b.z = 0;
    b.vx = b.vy = b.vz = 0;
    // Mostly face into the page, away from the corner.
    b.face = p.x > world.width * 0.5 ? -1 : 1;
    if (Math.random() < 0.3) b.face = b.face === 1 ? -1 : 1;
    b.yaw = -Math.abs(Math.atan2(b.fwd[2], b.fwd[0]));
    b.timer = rand(3, 8) + (p.long ? rand(4, 10) : 0);
    b.move = "perched";
    world.events.push({ kind: "rustle", x: p.x, y: p.y });
  }
}

/** Sitting: wings folded, looking about now and then, until it's fresh. */
function rest(world: Sky, sh: Shark, dt: number) {
  const b = sh.bird!;
  const L = sh.length;
  const p = world.perches[b.perch];
  b.tuck += (1 - b.tuck) * Math.min(1, dt * 5);
  b.logoPose = Math.max(0, b.logoPose - dt / 0.35);
  b.flap = 0;
  b.scale += (PERCH_SCALE - b.scale) * Math.min(1, dt * 4);
  b.energy = Math.min(1, b.energy + dt * 0.07);
  if (p) {
    b.x = p.x;
    b.y = p.y - FOOT_DROP * L * b.scale;
  }
  if (Math.random() < dt * 0.1) b.face = b.face === 1 ? -1 : 1;
  const yawTarget = b.face === 1 ? 0 : -Math.PI;
  b.yaw += clamp(yawTarget - b.yaw, -dt * 3.5, dt * 3.5);
  b.fwd = [Math.cos(b.yaw), 0, Math.sin(b.yaw)];
  b.up = [0, -1, 0];
  b.timer -= dt;
  sh.heading = b.face === 1 ? 0 : Math.PI;
  sh.speed = 0;
  sh.phase += dt * 2;
  if (!p || (b.energy > 0.95 && b.timer <= 0)) {
    // Off into the open sky rather than the near edge of the screen.
    b.face = b.x > world.width * 0.5 ? -1 : 1;
    b.fwd = [b.face, 0, 0];
    takeOff(world, sh);
  }
}

/** Fly the bird for dt. */
export function flyBird(world: Sky, sh: Shark, dt: number) {
  const b = sh.bird!;
  if (b.mode === "parked") return;
  noticeSplash(world, sh);
  if (b.mode === "flying") fly(world, sh, dt);
  else if (b.mode === "landing") land(world, sh, dt);
  else rest(world, sh, dt);
  placeBirdNodes(sh);
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
