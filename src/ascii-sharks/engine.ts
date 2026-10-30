import { AsciiRenderer, type OceanTheme } from "./renderer";
import { World, type SharkSpec } from "./world";

/** Longest sim step; a frame's time is split into equal substeps no longer than this. */
const STEP = 1 / 60;

/**
 * Wires World + AsciiRenderer to a canvas: per-frame substepped loop, resize,
 * pointer input, pausing off-screen, and prefers-reduced-motion.
 */
export class OceanEngine {
  private world: World;
  private renderer: AsciiRenderer;
  private raf = 0;
  private last = 0;
  private visible = true;
  private reducedMotion: MediaQueryList;
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private disposed = false;
  private size = { width: 0, height: 0, dpr: 0 };

  /** `speed` scales simulated time: 0.5 runs the whole ocean at half pace. */
  constructor(private canvas: HTMLCanvasElement, sharks?: SharkSpec[], theme?: OceanTheme, private speed = 1) {
    this.world = new World(sharks);
    this.renderer = new AsciiRenderer(canvas, theme);
    this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      // Several changes can arrive at once; the last is the current one.
      this.visible = entries[entries.length - 1].isIntersecting;
      this.schedule();
    });
    this.intersectionObserver.observe(canvas);

    this.reducedMotion.addEventListener("change", this.onMotionPreference);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("blur", this.onPointerLeave);

    this.resize();
    // Canvas text can't trigger a webfont load; once the mono face is in, redraw.
    document.fonts?.load(`600 16px ${getComputedStyle(canvas).fontFamily}`).then(() => {
      if (!this.disposed && this.reducedMotion.matches) this.drawStill();
    });
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedMotion.removeEventListener("change", this.onMotionPreference);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    document.documentElement.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("blur", this.onPointerLeave);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The observer also fires when it starts watching; nothing has changed, so keep the picture.
    const { size } = this;
    if (rect.width === size.width && rect.height === size.height && dpr === size.dpr) return;
    this.size = { width: rect.width, height: rect.height, dpr };
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
    this.world.setPerches(this.renderer.perches);
    // Sizing a canvas blanks it, and the observer runs after this frame's animation callback:
    // draw now, or the sky shows black until the next frame.
    if (this.reducedMotion.matches) this.drawStill();
    else this.renderer.render(this.world, 0);
  }

  /** Whether the hero has faded the sky out while it scrolls into the word. */
  private faded() {
    return getComputedStyle(this.canvas.parentElement ?? this.canvas).opacity === "0";
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible || this.reducedMotion.matches) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    // The first frame's timestamp can predate schedule()'s performance.now().
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000)) * this.speed;
    this.last = now;
    if (dt > 0 && !this.faded()) {
      // Advance by exactly the frame's time so motion stays even at 90/120 Hz,
      // where a fixed 60 Hz step would leave some frames unmoved.
      const steps = Math.ceil(dt / STEP);
      for (let i = 0; i < steps; i++) this.world.step(dt / steps);
      this.renderer.render(this.world, dt);
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Reduced motion: let the ecosystem settle, then show a single frame. */
  private drawStill() {
    if (this.world.time < 4) {
      for (let i = 0; i < 240; i++) this.world.step(STEP);
    }
    this.renderer.render(this.world, STEP);
  }

  private onMotionPreference = () => {
    if (this.reducedMotion.matches) {
      cancelAnimationFrame(this.raf);
      this.drawStill();
    } else {
      this.schedule();
    }
  };

  private toLocal(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    return { x, y, inside };
  }

  private onPointerMove = (e: PointerEvent) => {
    const { x, y, inside } = this.toLocal(e);
    const p = this.world.pointer;
    p.x = x;
    p.y = y;
    p.active = inside && e.pointerType !== "touch";
  };

  private onPointerDown = (e: PointerEvent) => {
    const { x, y, inside } = this.toLocal(e);
    if (inside && !this.reducedMotion.matches) this.world.splash(x, y);
  };

  private onPointerLeave = () => {
    this.world.pointer.active = false;
  };
}
