/**
 * The hero's opening: the header logo sits still for a second, dips, and a live bird lifts
 * out from behind it. The bird is built from the logo and starts exactly under it, so all
 * you see is the bird coming away.
 *
 * Timed off the sky's own frames rather than a timer, so it plays when someone can see it,
 * not while the tab is in the background.
 */
import type { World } from "./world";

/** What the page hands over: its logo, and what to do as the bird leaves it. */
export interface LogoIntro {
  /** The logo's image; its parent is cropped tight to the bird's ink. */
  image: () => HTMLImageElement | null;
  /** Dip the logo and let it spring back, like a branch as a bird jumps. */
  onCrouch: () => void;
}

/** Seconds since the first frame of the sky. */
const CROUCH_AT = 0.85;
const LIFTOFF_AT = 1;
/** The sky holds its full frame rate until the bird is well clear. */
const DONE_AT = 3.2;
/** How long to wait on a slow logo image before the bird goes without it. */
const LOAD_PATIENCE = 4;

export class LogoFlight {
  private t = 0;
  private waited = 0;

  constructor(private intro: LogoIntro, private world: World, private canvas: HTMLCanvasElement) {}

  /** Move on by `dt` real seconds; false once it's over. */
  advance(dt: number) {
    const before = this.t;
    const image = this.intro.image();
    // Nothing to fly from until the logo has loaded; if it never does, the bird just goes.
    if (before < LIFTOFF_AT && !image?.naturalWidth) {
      this.waited += dt;
      if (image && !image.complete && this.waited < LOAD_PATIENCE) return true;
      this.world.releaseBirds();
      return false;
    }
    this.t += dt;
    if (before < CROUCH_AT && this.t >= CROUCH_AT) this.intro.onCrouch();
    if (before < LIFTOFF_AT && this.t >= LIFTOFF_AT) {
      const crop = image!.parentElement ?? image!;
      const sky = this.canvas.getBoundingClientRect();
      const ink = crop.getBoundingClientRect();
      const x = ink.x + ink.width / 2 - sky.x;
      const y = ink.y + ink.height / 2 - sky.y;
      this.world.launchBird(x, y, crop.offsetWidth);
      this.world.splash(x, y);
    }
    return this.t < DONE_AT;
  }

  /** The bird is still waiting to leave. */
  get pending() {
    return this.t < LIFTOFF_AT;
  }

  /** No show after all: the bird is simply in the sky. */
  skip() {
    this.world.releaseBirds();
  }
}
