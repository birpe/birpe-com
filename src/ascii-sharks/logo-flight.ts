/**
 * The hero's opening: the header logo sits still for a second, crouches, breaks down into
 * the sky's pixel grid and flies off as the two birds. The birds are built from the logo,
 * so the pixel steps are all it takes to get from the sharp image to a live one.
 *
 * Timed off the sky's own frames rather than a timer, so a background tab can't lose the
 * logo before anyone sees the birds.
 */
import { makeCanvas } from "./logo-bird";
import type { AsciiRenderer } from "./renderer";
import type { World } from "./world";

/** What the page hands over: its logo, and what to do as the sky takes it on. */
export interface LogoIntro {
  /** The logo's image; its parent is cropped tight to the bird's ink. */
  image: () => HTMLImageElement | null;
  /** Dip the logo, like a bird about to jump. */
  onCrouch: () => void;
  /** Take the logo off the page: the sky is drawing it from this frame on. */
  onTakeover: () => void;
  /** The logo is staying after all: undo the crouch. */
  onCancel: () => void;
}

/** Seconds since the first frame of the sky. */
const CROUCH_AT = 0.85;
const TAKEOVER_AT = 1;
const LIFTOFF_AT = 1.18;
/** The sky holds its full frame rate until the birds are well clear. */
const DONE_AT = 3.4;
/** Sharp, half-size blocks, then blocks the size of a live bird's: one step each. */
const STEPS = 3;
/** How long to wait on a slow logo image before the birds go without it. */
const LOAD_PATIENCE = 4;

type Box = { x: number; y: number; w: number; h: number };

export class LogoFlight {
  private t = 0;
  private waited = 0;
  private sharp: ReturnType<typeof makeCanvas> | null = null;
  private blocks = makeCanvas(1, 1);
  private box: Box = { x: 0, y: 0, w: 1, h: 1 };
  private lift = { x: 0, y: 0, length: 1 };

  constructor(private intro: LogoIntro, private world: World, private renderer: AsciiRenderer, private canvas: HTMLCanvasElement) {}

  /** Move on by `dt` real seconds; false once it's over. */
  advance(dt: number) {
    const before = this.t;
    const image = this.intro.image();
    // Nothing to fly until the logo has loaded; if it never does, the birds just go.
    if (before < TAKEOVER_AT && !image?.naturalWidth) {
      this.waited += dt;
      if (image && !image.complete && this.waited < LOAD_PATIENCE) return true;
      this.skip();
      return false;
    }
    this.t += dt;
    if (before < CROUCH_AT && this.t >= CROUCH_AT) {
      this.prepare(image!);
      this.intro.onCrouch();
    }
    if (before < TAKEOVER_AT && this.t >= TAKEOVER_AT) this.takeover(image!);
    if (before < LIFTOFF_AT && this.t >= LIFTOFF_AT) {
      this.renderer.overlay = null;
      const { x, y, length } = this.lift;
      this.world.launchBirds(x, y, length);
      this.world.splash(x, y);
    }
    return this.t < DONE_AT;
  }

  /** The logo is still on the page. */
  get pending() {
    return this.t < TAKEOVER_AT;
  }

  /** The visitor scrolled before it began: no show, the birds are simply in the sky. */
  skip() {
    this.world.releaseBirds();
    this.intro.onTakeover();
  }

  /** Reduced motion was switched on part way: stop where it is, and leave a waiting logo in place. */
  cancel() {
    this.renderer.overlay = null;
    this.world.releaseBirds();
    if (this.pending) this.intro.onCancel();
  }

  /** Shrink the big logo image ahead of time, so the first frame on the sky doesn't hitch. */
  private prepare(image: HTMLImageElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.round(image.offsetWidth * dpr));
    const sharp = makeCanvas(size, size);
    const g = sharp.getContext("2d") as CanvasRenderingContext2D;
    g.imageSmoothingQuality = "high";
    g.drawImage(image, 0, 0, size, size);
    this.sharp = sharp;
  }

  private takeover(image: HTMLImageElement) {
    const crop = image.parentElement ?? image;
    const sky = this.canvas.getBoundingClientRect();
    const rect = image.getBoundingClientRect();
    const ink = crop.getBoundingClientRect();
    this.box = { x: rect.x - sky.x, y: rect.y - sky.y, w: rect.width, h: rect.height };
    this.lift = { x: ink.x + ink.width / 2 - sky.x, y: ink.y + ink.height / 2 - sky.y, length: crop.offsetWidth };
    this.renderer.overlay = this.paint;
    this.intro.onTakeover();
  }

  private paint = (ctx: CanvasRenderingContext2D) => {
    const { box, sharp } = this;
    if (!sharp) return;
    const step = Math.min(STEPS - 1, Math.floor(((this.t - TAKEOVER_AT) / (LIFTOFF_AT - TAKEOVER_AT)) * STEPS));
    if (step === 0) {
      ctx.drawImage(sharp, box.x, box.y, box.w, box.h);
      return;
    }
    // Blocks on the same grid a bird is painted on, so the last step lands exactly on it.
    const k = step / (STEPS - 1);
    const sw = (this.renderer.cellWidth / 2) * k;
    const sy = (this.renderer.cellHeight / 3) * k;
    const x0 = Math.floor(box.x / sw) * sw;
    const y0 = Math.floor(box.y / sy) * sy;
    const cols = Math.ceil((box.x + box.w - x0) / sw);
    const rows = Math.ceil((box.y + box.h - y0) / sy);
    const { blocks } = this;
    blocks.width = cols;
    blocks.height = rows;
    const g = blocks.getContext("2d") as CanvasRenderingContext2D;
    g.imageSmoothingQuality = "high";
    g.drawImage(sharp, (box.x - x0) / sw, (box.y - y0) / sy, box.w / sw, box.h / sy);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blocks, 0, 0, cols, rows, x0, y0, cols * sw, rows * sy);
    ctx.imageSmoothingEnabled = smoothing;
  };
}
