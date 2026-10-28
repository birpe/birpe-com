# Birpe

Birpe is a React, TypeScript, and Tailwind CSS landing page.

## Commands

- `npm install`
- `npm run dev` — start the local site at http://localhost:3000
- `npm run build` — type-check and create the production build
- `npm run preview` — serve the production build

## Project structure

```text
src/
  components/
    AnimatedBird.tsx       Transparent, browser-aware video playback
    BirpeLanding.tsx       Page composition and content
    ui/
      Cloudscape.tsx       Animated WebGL cloud background
      GlyphPortal.tsx      Scroll-driven word transition
      LiquidGlass.tsx      Shared glass controls
  lib/
    utils.ts               Shared class-name helper
  styles/
    global.css             Shared styles and reusable component rules
    landing.css            Landing page layout and responsive rules
  main.tsx                 React entry point
public/
  assets/
    fonts/                 Local brand fonts
    images/                Logos and fallback artwork
    videos/                Transparent WebM and Safari video variants
```

The Glyph Portal keeps its original MIT attribution in its source file. The page is a brand presentation and is not connected to an AI service yet.
