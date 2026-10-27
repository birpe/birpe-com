import type { GlyphStrokes } from "./GlyphPortal";

/**
 * Pen centerlines for Birpe Rounded (weight 500), traced over the glyph
 * outlines at font-size 100: baseline y = 0, x from each glyph's origin.
 * `main` is written in letter order (a bare M is a pen lift); `lift` strokes
 * (the i-dot) follow once every main stroke is down, like the footer script.
 * A round brush of BIRPE_STROKE_RADIUS along these covers every glyph pixel.
 */
export const BIRPE_STROKES: GlyphStrokes = {
  b: { main: "M11.4 -70L11.4 -3.6M14.83 -37.85A20.4 23.3 0 1 1 14.83 -14.55" },
  i: { main: "M11.1 -48.5L11.1 -4.1", lift: "M11.1 -65.2L11.1 -62.8" },
  r: { main: "M11.4 -47.7L11.4 -4.1M15 -31C16.5 -40 21 -47.5 28.5 -49.4L34.6 -49" },
  p: { main: "M11.4 -48L11.4 15.9M14.74 -37.38A20.45 22.95 0 1 1 14.74 -14.42" },
  e: { main: "M9 -28L48.77 -28A20.2 23.27 0 1 0 44.12 -11.02L48 -8.6" },
};

/** Stems are 8 units and bowls about 7.7, so this leaves a margin either side. */
export const BIRPE_STROKE_RADIUS = 6;
