# Birpe

Birpe is a React, TypeScript, and Tailwind CSS landing page.

## Commands

- `npm install`
- `npm run dev` — start the local site at http://localhost:3000
- `npm run build` — type-check and create the production build
- `npm run preview` — serve the production build
- `npm run deploy` — build and publish `dist/` to birpe.com on Cloudflare (see `wrangler.jsonc`)

## Project structure

```text
src/
  components/
    BirpeLanding.tsx       Page composition and content
    StickerSlapFooter.tsx  Self-contained animated footer with draggable stickers
    ui/
      Cloudscape.tsx       Animated WebGL cloud background
      GlyphPortal.tsx      Scroll-driven word transition
      LiquidGlass.tsx      Shared glass controls
      liquid-glass-logo-reveal.tsx  WebGL glass bird intro shown while the brand font loads
  lib/
    utils.ts               Shared class-name helper
  styles/
    global.css             Reset, liquid glass, and cloud backdrop styles
    landing.css            Landing page layout and responsive rules
  main.tsx                 React entry point
public/
  assets/
    fonts/                 Local brand fonts
    images/                Logo and favicon artwork
```

The Glyph Portal keeps its original MIT attribution in its source file. The page is a brand presentation and is not connected to an AI service yet.
