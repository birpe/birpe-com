# Birpe

Birpe is a React, TypeScript, and Tailwind CSS site. The page opens with a preloader, then a hero built around the falling-block Birpe word, then a two-column section grid, feature cards with a local task preview, a looping how-it-works list, four sticky steps, an FAQ, a waitlist sign-up, and a dot-matrix footer card. The structure follows [fourmula.ai](https://fourmula.ai/) in Birpe's own colors.

The previous source, page HTML, and README are backed up in `_archive/homepage-before-reset-2026-10-31.tar.gz`. Existing components and assets remain available for reuse; `public/assets/images/ring/` is no longer used by the page.

## Commands

- `npm install`
- `npm run dev` — start the local site at http://localhost:3000
- `npm run build` — type-check and create the production build
- `npm run preview` — serve the production build
- `npm run deploy` — build and publish `dist/` and the Worker to birpe.com on Cloudflare (see `wrangler.jsonc`)

## Homepage sizing

The active homepage follows the pasted reference's viewport-based scaling and typography. The root font size is `calc(Kvw * var(--user-zoom))`, with K = 16 ÷ design width × 100: approximately 0.9259 for 1728px desktop, 1.8779 for 852px tablet (up to 991px), and 4.1026 for 390px phone (up to 767px). Extra coefficient precision avoids rounding at the reference widths. The layout grows proportionally on wide screens; there is no 1728px cap.

`src/styles/global.css` defines all 15 styles from the section-by-section reference: Display 120px, H1 88px, H2.5 64px, H3 52px, H4 36px, Title 3 24px, Body 3 20px, Tag and Body 1 18px, Button 17px, Body 2 and Title 1 16px, Title 2 14px, Small 1 12px, and Small 2 10px at the desktop design width. Leading, weights, and tracking follow the supplied table. Tablet changes Display and H1; phone applies the supplied smaller scale. SF Pro Display uses local font lookup with Arial as the reference fallback.

The desktop section grid has a 28.5rem left column and 2rem gutters. Major sections use 10rem spacing. The hero stays at `100svh` and places small metadata in the bottom corners. The falling-block word fills the hero, with the tagline beneath it. The local task composer lives in the feature section. Feature cards use .5rem outer padding/gaps, 5rem desktop inner padding, and 36rem text stacks. They pair an interactive composer with an illustrative task brief; the carousel artwork is not repeated in later sections. Below 992px, section grids and feature cards stack and use 2rem card padding so tablet headings do not collapse into a narrow column. The first step counts the intro’s 6rem bottom padding toward its 7.5rem separation, avoiding a doubled gap. The how-it-works section’s bottom padding supplies the following section’s 10rem separation. The keyboard-accessible native FAQ follows the reference’s spacing and type roles. The footer card has 3rem corners, 2rem padding, and a height of `min(100svh - 1rem, 60rem)`.

`src/lib/viewportZoom.ts` implements the reference's custom zoom: Ctrl/Cmd plus or minus changes `--user-zoom` by 0.1, and Ctrl/Cmd 0 resets it. The range is 0.5–5.0. This supersedes the earlier native-zoom-only compromise because a pure viewport root counteracts native browser zoom. Geometry consumers refresh when the custom zoom changes. At 200% and above, grids stack and controls wrap so enlarged content stays reachable.

The preloader, hero, example cards, and footer use rem dimensions. The footer measures its available container width and CSS dot size before selecting a column count; its pointer lens spans 12.5rem. Intentional exceptions are 1px borders, pixel media queries/input-mode checks, percentages, safe-area insets, viewport-height constraints, and SVG grid coordinates. DOM and pointer measurements remain in browser CSS pixels. Archived and unused screens and the separate `birpe-com` project are outside this sizing system.

## Waitlist

The sign-up form posts to `worker/index.ts`, which stores emails in the `birpe-waitlist` D1 database. It only runs on Cloudflare, so test it with `wrangler dev` rather than `npm run dev`.

- `npx wrangler d1 migrations apply birpe-waitlist --local` — set up the local test database
- `npx wrangler d1 migrations apply birpe-waitlist --remote` — set up the live database (run before the first deploy)
- `npx wrangler d1 execute birpe-waitlist --remote --command "SELECT * FROM waitlist ORDER BY created_at" --json > waitlist.json` — export sign-ups

## Preloader

`src/components/Preloader.tsx` owns the GSAP blur entrance and exit, checkpoint counter, and four-image slideshow. `src/styles/preloader.css` contains the layout and eight-step spinner. The image cards in `public/assets/images/preloader/` are sample Birpe task illustrations; replace them or change the `IMAGES` array to use final product imagery.

The first visit plays for about 5.3 seconds after the window load event. Later visits play at five times the speed and show “Synced.” The browser stores the completed-visit flag under `birpe:preloader:seen`; remove that key from local storage to preview the full sequence again. Reduced-motion users get a short fade without the blur, slideshow, or spinner animation.

Listen for `preloader:done` on `document` or `window` to start home-screen animations. The event is dispatched once on `document` and bubbles to `window` after the overlay fades out; scrolling unlocks one second later (0.2 seconds on return visits). Unmounting the component also cleans up its animations, timers, and scroll lock.

## Hero intro

`src/components/BirpeHero.tsx` owns the hero markup and interactive local preview. `src/lib/useHeroIntro.ts` pre-hides its pieces in a layout effect, then starts a single paused GSAP timeline on `preloader:done`. A CSS waiting state also prevents a flash before the hook runs. Words are rendered as React spans, without rewriting HTML.

The timeline flashes the tagline's words through `#0780FD` and `#3B9BFC` into the text color, with 0.2 seconds between words, and they settle at 50% opacity. The logo rises 1.5rem from 90% scale at 0.1 seconds over 0.5 seconds, navigation does the same at 0.2 over 0.6 seconds, and the header button rises at 0.35 seconds. The corner metadata fades in at 0.35 seconds. Hero entrances use `power2.out`. The word starts falling when the timeline finishes.

The intro runs once per mount, cleans up its listener and animations, and shows the finished layout for reduced-motion preferences, including changes during the entrance. The examples populate the composer and display predefined suggestions locally. The attachment control only shows the selected filename; nothing is uploaded and no AI service is connected.

## Header controls

The Menu pill opens an overlay of page links, which closes on Escape, an outside click, or choosing a link. The moon button switches the night theme through the `--fg`, `--bg`, `--surface`, and `--panel` tokens in `global.css`; the choice is stored under `birpe:theme` and applied in `index.html` before first paint. The pill also shows scroll progress. `src/components/ui/RollText.tsx` gives links and buttons their rolling-letter hover.

## Page motion

The homepage uses native browser scrolling (`scroll-behavior: auto`). `usePageMotion` registers GSAP's ScrollTrigger and waits for `preloader:done` before starting page effects. It also handles content mounted after the loader and cleans up its own triggers on unmount.

- Add `data-reveal` to a motion wrapper for a single opacity/translate entrance when it reaches 88% of the viewport height. The trigger stays within the page's scroll range so the last element can reveal on short pages. Completed entrances release their inline animation styles and their ScrollTrigger.
- Use `motion-marquee-track`, `motion-hero-row`, or `motion-column` on tracks containing two identical groups inside an overflow-hidden container. Put spacing inside each group, rather than between the two groups, to keep the loop seamless. Mark the duplicate group `aria-hidden="true"` and keep interactive content out of it.
- Set `--motion-duration` (for example, `40s`) or `--motion-direction: reverse` on a looping track to adjust it. Loops use CSS transforms, start after the loader, and apply `will-change` only to those tracks.
- Reduced-motion preferences disable both scroll entrances and looping animations, including preference changes while the page is open.

The four task illustrations appear in the task preview. The loader also previews these assets during its temporary entrance sequence. For future photography, use compressed AVIF/WebP assets with explicit dimensions and lazy loading below the fold; keep initial-screen and loader images eager.


## Birpe word

`TetrisSkyline` fills the hero with the word "birpe", drawn on a 27-by-9 board. `src/lib/tetris.ts` tiles the letters with true tetrominoes, plus a single block for the dot on the i, in an order where no piece has to pass through one that has landed. The page's h1, “Your personal agent”, sits in the board's bottom two rows, left of the p's descender, and scales with the board through container units; below 992px it follows the word at nearly the word's width. Its words flash in through the hero intro and settle at 50% opacity.

After the intro finishes, each piece enters above the board turned and off to one side, drops one whole row every 0.03 seconds, shifts and turns into place on the way down, and flashes as it locks. Falls overlap so the word completes in about three seconds on every device. It holds for six seconds, fades, and rebuilds. Playback pauses offscreen and while the document is hidden. A four-second CSS fallback shows the word if the intro signal never arrives, and reduced motion shows the finished word immediately, including when the preference changes while the page is open. The board cannot receive focus and does not intercept pointer input.

`src/lib/motion.ts` defines the six shared easing curves (`out-expo`, `rise`, `soft`, `snappy`, `pop`, and `standard`) and registers their matching CSS variables and GSAP functions. Hero entrances use the reference’s `power2.out`, page reveals use `out-expo`; hero hover transitions and skyline fades use `soft`. Native scrolling and preloader timing remain unchanged; no scrolling library is required.

Run deterministic grid fixtures with Node 22.6 or later:

```sh
node --experimental-strip-types --test tests/tetris.test.mjs
```

The fixtures check that the pieces rebuild the exact word, are true tetrominoes apart from the i's dot, and can each fall straight in without crossing a landed piece.

## Dot-matrix footer

`src/components/DotMatrixFooter.tsx` contains the complete grid, pattern definitions, transition timeline, and mouse lens. It renders plain HTML divs; there is no canvas or WebGL. There are 14 rows, with 52 columns at widths of 992px and above (728 dots), 24 columns on tablets (336 dots), and 22 on phones (308 dots). Desktop/tablet dots and gaps are 1rem; phones use .5rem. The size can shrink to fit the padded footer's available width or height without losing columns or distorting circles.

`DOT_PATTERNS` defines four centered icons: the existing 18-by-12 Birpe bird, the supplied plus and diamond, and a check mark. All fit within the 14-row field. Unlit dots stay at 15% opacity. The GSAP timeline cycles cloud → icon → one-second hold, then cloud → the next icon. Each transition uses 20 Fisher–Yates shuffled groups, staggered by roughly .05 seconds with slight jitter. Groups animate for one second with `steps(2)`; the timeline waits for the final group before switching states, so transitions do not overlap. Each complete loop refreshes cloud noise. `data-phase` and `data-pattern` expose the current state for inspection.

The mouse lens has a 200 CSS-pixel radius and a minimum dot scale of .25, using reusable .2-second `power2.out` tweens. Positions are cached on resize and the field origin updates on scroll; pointer work is limited to one animation frame. The window listener also allows the lens to affect dots when the mouse is just outside the grid. Playback waits for the loader, pauses offscreen or in hidden tabs, and shows a static bird for reduced motion. Listeners, observers, frames, and GSAP animations are cleaned up on unmount or breakpoint changes.

## Project structure

```text
src/
  components/
    BirpeLanding.tsx       Preloader, page, and dot-matrix footer
    BirpeHero.tsx          Header, hero, feature preview, how-it-works, steps, and FAQ
    TetrisSkyline.tsx      The falling-block Birpe word in the hero
    DotMatrixFooter.tsx    Footer card, measured dot field, dissolve animation, and cursor lens
    Preloader.tsx          Custom GSAP loading sequence
    StickerSlapFooter.tsx  Self-contained animated footer with draggable stickers
    ui/
      Cloudscape.tsx       Animated WebGL cloud background
      GlyphPortal.tsx      Scroll-driven word transition
      LiquidGlass.tsx      Shared glass controls
      RollText.tsx         Rolling-letter hover text
      liquid-glass-logo-reveal.tsx  WebGL glass bird intro shown while the brand font loads
  lib/
    utils.ts               Shared class-name helper
    usePageMotion.ts       Loader-gated ScrollTrigger entrances
    useHeroIntro.ts        Loader-to-hero entrance timeline
    motion.ts             Shared CSS and GSAP easing definitions
    tetris.ts             Birpe letter shapes and falling-piece order
  styles/
    preloader.css          Loading overlay, layout, and stepped spinner
    hero.css               Reference section grid, typography layout, and task preview
    dot-matrix.css         Responsive black-on-white dot field
    global.css             Reset and native scrolling
    motion.css             Transform-only looping tracks
    landing.css            Landing page layout and responsive rules
  main.tsx                 React entry point
public/
  assets/
    fonts/                 Local brand fonts
    images/                Logo and favicon artwork
```

The Glyph Portal keeps its original MIT attribution in its source file. The page is a brand presentation and is not connected to an AI service yet.
