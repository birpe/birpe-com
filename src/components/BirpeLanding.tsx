import { useCallback, useEffect, useState, useRef } from "react";
import { BIRPE_THEME, type SharkSpec } from "@/ascii-sharks";
import { AsciiOcean } from "@/ascii-sharks/react";
import Aurora from "@/components/ui/aurora";
import GlyphPortal from "@/components/ui/GlyphPortal";
import { LiquidGlassFilter, LiquidGlassLink } from "@/components/ui/LiquidGlass";
import { GlassIconReveal } from "@/components/ui/liquid-glass-logo-reveal";
import StickerSlapFooter from "@/components/StickerSlapFooter";
import "@/styles/landing.css";

/** Two small Birpe logo birds, sized to suit the corner tree; the first is a little larger. */
const oceanSharks: SharkSpec[] = [
  { kind: "bird", size: 0.36 },
  { kind: "bird", size: 0.3 },
];

const settings = { word: "birpe", scrollLength: 2.4, interactive: true, annotations: false };
const family = '"Birpe Rounded", Arial, sans-serif';
/** Keep the intro loader visible long enough to read the motion, even when the font is cached. */
const MIN_LOADER_MS = 3500;
let fontLoad: Promise<void> | undefined;

export default function BirpeLanding(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const bird = useRef<HTMLButtonElement>(null);
  const reduceMotion = useRef(false);
  const [face, setFace] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reduceMotion.current = mq.matches; };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const onMainPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || reduceMotion.current) return;
    const node = bird.current;
    if (!node) return;
    node.style.setProperty("--bird-x", `${(event.clientX / window.innerWidth - 0.5) * 12}px`);
    node.style.setProperty("--bird-y", `${(event.clientY / window.innerHeight - 0.5) * 10}px`);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    // Load the local brand face before mounting the scroll-driven word artwork.
    fontLoad ??= new FontFace("Birpe Rounded", 'url("/assets/fonts/birpe-rounded.ttf")', { weight: "500" })
      .load().then((font) => { document.fonts.add(font); });

    const faceReady = new Promise<string>((resolve) => {
      let settled = false;
      const finish = (value: string) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      timers.push(window.setTimeout(() => finish("Arial, sans-serif"), 1600));
      void fontLoad!.then(() => finish(family), () => finish("Arial, sans-serif"));
    });

    const minLoader = new Promise<void>((resolve) => {
      timers.push(window.setTimeout(resolve, MIN_LOADER_MS));
    });

    void Promise.all([faceReady, minLoader]).then(([value]) => {
      if (!cancelled) setFace(value);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <main onPointerMove={onMainPointerMove} data-demo-scroll data-slipstream-demo tabIndex={0} aria-label="Birpe. Scroll into a lighter day."
      style={{ width: "100%", height: "100svh", overflowX: "clip", overflowY: "auto", background: "#fff", containerType: "inline-size", fontFamily: "Arial, sans-serif", WebkitOverflowScrolling: "touch", scrollPaddingBottom: "env(safe-area-inset-bottom)" }}>
      <div id="top" />
      <h1 className="sr-only">Birpe — Your everyday AI agent</h1>
      <LiquidGlassFilter />
      {face ? <GlyphPortal word={s.word} fontFamily={face} fontWeight={500} style={{ fontFamily: "Arial, sans-serif", "--gp-field": "#1859d5", "--gp-ink": "#142033", "--gp-foreground": "#ffffff" }} backdrop={<AsciiOcean className="hero-ocean" sharks={oceanSharks} theme={BIRPE_THEME} speed={0.55} />} background={<Aurora className="birpe-field" intensity={0.55} duration={18} />} scrollLength={s.scrollLength} interactive={s.interactive} annotations={s.annotations} enterLabel="Scroll here" enterInteractive={false} front={
          <div data-sublime-header><button ref={bird} className="bird-guide" aria-label="Give the bird a little lift" onClick={()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;bird.current?.animate([{translate:'0 0',rotate:'0deg'},{translate:'9px -15px',rotate:'-10deg'},{translate:'0 0',rotate:'0deg'}],{duration:600,easing:'ease-in-out'});}}><span className="header-bird"><img src="/assets/images/bird-logo.png" alt="" /></span></button><span data-sublime-category>Your everyday AI agent</span></div>
        }>
        <div data-slipstream-copy>
          <h2>Less on your mind. More room for life.</h2>
          <LiquidGlassLink className="try-example-link" href="#footer">
            Coming soon <span aria-hidden="true">↓</span>
          </LiquidGlassLink>
          <div data-slipstream-features>
            <div data-slipstream-feature><h3><span data-slipstream-no>01</span>Find your focus</h3><p>Turn a crowded to-do list into a clear plan. Find the next step without the mental clutter.</p></div>
            <div data-slipstream-feature><h3><span data-slipstream-no>02</span>Make sense of more</h3><p>Get the useful details from long notes and information, without the overload.</p></div>
            <div data-slipstream-feature><h3><span data-slipstream-no>03</span>Take back your time</h3><p>Bring a little ease to everyday tasks. Save your energy for the things that matter.</p></div>
          </div>
        </div>
      </GlyphPortal> : (
        <GlassIconReveal
          logo="/assets/images/bird-logo.png"
          label="Loading"
          look="light"
          background="#ffffff"
          originalColors
          loop={false}
          className="h-full w-full"
          role="status"
        />
      )}
      {face && <StickerSlapFooter />}
    </main>
  );
}
