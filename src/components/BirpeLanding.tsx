import { useEffect, useState, useRef } from "react";
import Cloudscape from "@/components/ui/Cloudscape";
import GlyphPortal from "@/components/ui/GlyphPortal";
import { LiquidGlassFilter, LiquidGlassLink } from "@/components/ui/LiquidGlass";
import StickerSlapFooter from "@/components/StickerSlapFooter";
import "@/styles/landing.css";

const settings = { word: "birpe ai", scrollLength: 2.4, interactive: true, annotations: false };
const family = '"Birpe Rounded", Arial, sans-serif';
let fontLoad: Promise<void> | undefined;

export default function BirpeLanding(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const bird = useRef<HTMLButtonElement>(null);
  const [face, setFace] = useState<string | null>(null);
  useEffect(() => {
    let settled = false;
    const finish = (value: string) => { if (!settled) { settled = true; setFace(value); } };
    // Load the local brand face before mounting the scroll-driven word artwork.
    fontLoad ??= new FontFace("Birpe Rounded", 'url("/assets/fonts/birpe-rounded.ttf")', { weight: "500" })
      .load().then((font) => { document.fonts.add(font); });
    const timeout = window.setTimeout(() => finish("Arial, sans-serif"), 1600);
    void fontLoad.then(() => finish(family), () => finish("Arial, sans-serif"));
    return () => { settled = true; clearTimeout(timeout); };
  }, []);
  return (
    <main onPointerMove={event=>{if(event.pointerType==='touch'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const node=bird.current;if(node){node.style.setProperty('--bird-x',`${(event.clientX/window.innerWidth-.5)*12}px`);node.style.setProperty('--bird-y',`${(event.clientY/window.innerHeight-.5)*10}px`);}}} data-demo-scroll data-slipstream-demo tabIndex={0} aria-label="Birpe AI. Scroll into a lighter day."
      id="top"
      style={{ width: "100%", height: "100svh", overflowX: "clip", overflowY: "auto", background: "#fff", containerType: "inline-size", fontFamily: "Arial, sans-serif", WebkitOverflowScrolling: "touch" }}>
      <h1 className="sr-only">Birpe AI — Your everyday AI agent</h1>
      <LiquidGlassFilter />
      {face ? <GlyphPortal word={s.word} fontFamily={face} fontWeight={500} style={{ fontFamily: "Arial, sans-serif", "--gp-field": "#1859d5", "--gp-ink": "#142033", "--gp-foreground": "#ffffff" }} backdrop={<Cloudscape colorBottom="#a8d9fb" colorMid="#e5f4ff" colorTop="#ffffff" speed={1.26} height="100%" />} background={<div className="birpe-field" />} scrollLength={s.scrollLength} interactive={s.interactive} annotations={s.annotations} enterLabel="Scroll here" enterInteractive={false} front={
          <div data-sublime-header><button ref={bird} className="bird-guide" aria-label="Give the bird a little lift" onClick={()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;bird.current?.animate([{translate:'0 0',rotate:'0deg'},{translate:'9px -15px',rotate:'-10deg'},{translate:'0 0',rotate:'0deg'}],{duration:600,easing:'ease-in-out'});}}><span className="header-bird"><img src="/assets/images/bird-logo.png" alt="" /></span></button><span data-sublime-category>Your everyday AI agent</span></div>
        }>
        <div data-slipstream-copy>
          <h2>Less on your mind. More room for life.</h2>
          <LiquidGlassLink className="try-example-link" href="#launching-soon">
            Coming soon <span aria-hidden="true">↓</span>
          </LiquidGlassLink>
          <div data-slipstream-features>
            <div data-slipstream-feature><h3><span data-slipstream-no>01</span>Find your focus</h3><p>Turn a crowded to-do list into a clear plan. Find the next step without the mental clutter.</p></div>
            <div data-slipstream-feature><h3><span data-slipstream-no>02</span>Make sense of more</h3><p>Get the useful details from long notes and information, without the overload.</p></div>
            <div data-slipstream-feature><h3><span data-slipstream-no>03</span>Take back your time</h3><p>Bring a little ease to everyday tasks. Save your energy for the things that matter.</p></div>
          </div>
        </div>
      </GlyphPortal> : <div role="status" style={{ height: "100%", display: "grid", placeItems: "center", color: "#555", fontSize: 12 }}>Loading type…</div>}
      {face && <section id="launching-soon" className="launch-section launch-static" aria-labelledby="launch-title"><span className="launch-bird"><img src="/assets/images/bird-logo.png" alt="" /></span><div className="launch-content"><h2 id="launch-title">Launching soon<br/><span>to help you more.</span></h2></div></section>}
      {face && <StickerSlapFooter />}
    </main>
  );
}
