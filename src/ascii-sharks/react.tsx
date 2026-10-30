import { useEffect, useRef } from "react";
import { OceanEngine } from "./engine";
import type { LogoIntro } from "./logo-flight";
import type { OceanTheme } from "./renderer";
import type { SharkSpec } from "./world";

/** Glyphs come from the canvas's font-family, so give it (or a parent) a monospace font. */
export function AsciiOcean({ className, sharks, theme, speed, logoIntro }: { className?: string; sharks?: SharkSpec[]; theme?: OceanTheme; speed?: number; logoIntro?: LogoIntro }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new OceanEngine(canvas, sharks, theme, speed, logoIntro);
    return () => engine.destroy();
    // The roster, theme, speed and intro are fixed for the life of the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`ascii-ocean ${className ?? ""}`} />;
}
