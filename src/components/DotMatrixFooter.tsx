import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import RollText from './ui/RollText';
import '@/styles/dot-matrix.css';

const ROWS = 14;
const REST_OPACITY = 0.15;
const GROUPS = 20;
const TRANSITION = 1;
const PATTERN_HOLD = 1;
const LENS_RADIUS = 200;

// The silhouette of the Birpe bird, reduced from the existing brand trace.
// Every 1 becomes a black dot; the original logo's blue layers are merged.
export const BIRPE_DOT_PATTERN = [
  '111111111.........',
  '11111111111.......',
  '.1111111111.......',
  '.11111111111..111.',
  '..1111111111111111',
  '...1111111111111..',
  '......111111111...',
  '........1111111...',
  '......111111111...',
  '.....111111111....',
  '....111111111.....',
  '.....111111.......',
];

// All patterns fit inside the 14-row display; '.' and '-' are unlit cells.
export const DOT_PATTERNS = [
  { name: 'bird', rows: BIRPE_DOT_PATTERN },
  { name: 'plus', rows: ['----1----', '----1----', '----1----', '111111111', '----1----', '----1----', '----1----'] },
  { name: 'diamond', rows: ['----1----', '---111---', '--11111--', '-1111111-', '--11111--', '---111---', '----1----'] },
  { name: 'check', rows: ['........1', '.......11', '......11.', '11...11..', '.11.11...', '..111....', '...1.....'] },
] as const;

const columnsForWidth = () => window.innerWidth >= 992 ? 52 : window.innerWidth >= 768 ? 24 : 22;

function patternAt(pattern: readonly string[], column: number, row: number, columns: number) {
  const x = column - (Math.floor(columns / 2) - Math.floor(pattern[0].length / 2));
  const y = row - (Math.floor(ROWS / 2) - Math.floor(pattern.length / 2));
  return pattern[y]?.[x] === '1';
}

function shuffledGroups(dots: HTMLDivElement[]) {
  const shuffled = [...dots];
  // Fisher–Yates keeps the dissolve evenly random without a biased sort.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Array.from({ length: GROUPS }, (_, group) =>
    shuffled.filter((_, index) => index % GROUPS === group));
}

export default function DotMatrixFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(columnsForWidth);

  useLayoutEffect(() => {
    const footer = footerRef.current!;
    const field = fieldRef.current!;
    const display = displayRef.current!;
    // Retain the reference column counts while spanning the footer's available width.
    const measure = () => {
      field.style.setProperty('--dot-available-width', `${display.clientWidth}px`);
      setColumns(columnsForWidth());
    };
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    observer.observe(display);
    // A breakpoint can change dot size without changing the container width.
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useLayoutEffect(() => {
    const field = fieldRef.current!;
    const dots = Array.from(field.querySelectorAll<HTMLDivElement>('.dot-matrix__dot'));
    const media = gsap.matchMedia();

    media.add('(prefers-reduced-motion: no-preference)', () => {
      let ready = !document.documentElement.classList.contains('is-loading');
      let inView = false;
      let frame = 0;
      let pointer: { x: number; y: number } | null = null;
      let origin = { left: 0, top: 0 };
      let positions: { x: number; y: number }[] = [];
      const scales = dots.map(() => 1);
      const centerX = Math.floor(columns / 2);
      const centerY = Math.floor(ROWS / 2);
      const cloudRadius = 12;
      const timeline = gsap.timeline({ paused: true, repeat: -1, repeatRefresh: true });

      function dissolve(getOpacity: (dot: HTMLDivElement) => number, at: number) {
        shuffledGroups(dots).forEach((group, index) => {
          timeline.to(group, {
            opacity: (_, dot: HTMLDivElement) => getOpacity(dot),
            duration: TRANSITION,
            ease: 'steps(2)',
          }, at + index * (TRANSITION / GROUPS) + Math.random() * TRANSITION / GROUPS / 4);
        });
      }

      // Wait for every staggered group to finish before starting the next state.
      // A whole cycle visits all four icons; repeatRefresh regenerates cloud noise.
      DOT_PATTERNS.forEach((pattern) => {
        const cloudStart = timeline.duration();
        timeline.set(field, { attr: { 'data-phase': 'cloud', 'data-pattern': pattern.name } }, cloudStart);
        dissolve((dot) => {
          const distance = Math.hypot(Number(dot.dataset.col) - centerX, Number(dot.dataset.row) - centerY);
          return gsap.utils.clamp(REST_OPACITY, 1,
            REST_OPACITY + Math.max(0, 1 - distance / cloudRadius) * 0.7 + (Math.random() - 0.5) * 0.35);
        }, cloudStart);

        const patternStart = timeline.duration();
        timeline.set(field, { attr: { 'data-phase': 'pattern' } }, patternStart);
        dissolve((dot) => patternAt(pattern.rows, Number(dot.dataset.col), Number(dot.dataset.row), columns) ? 1 : REST_OPACITY, patternStart);
        const patternDone = timeline.duration();
        timeline.set(field, { attr: { 'data-phase': 'pattern-hold' } }, patternDone)
          .to({}, { duration: PATTERN_HOLD }, patternDone);
      });

      // Local coordinates stay valid while scrolling and while dots are scaled.
      const updateOrigin = () => { origin = field.getBoundingClientRect(); };
      const cachePositions = () => {
        updateOrigin();
        positions = dots.map((dot) => ({
          x: dot.offsetLeft + dot.offsetWidth / 2,
          y: dot.offsetTop + dot.offsetHeight / 2,
        }));
      };
      const scaleTo = dots.map((dot) => ({
        x: gsap.quickTo(dot, 'scaleX', { duration: 0.2, ease: 'power2.out' }),
        y: gsap.quickTo(dot, 'scaleY', { duration: 0.2, ease: 'power2.out' }),
      }));
      const renderLens = () => {
        frame = 0;
        positions.forEach((position, index) => {
          const distance = pointer ? Math.hypot(position.x - pointer.x, position.y - pointer.y) : LENS_RADIUS;
          const scale = 1 - 0.75 * Math.max(0, 1 - distance / LENS_RADIUS);
          if (Math.abs(scales[index] - scale) > 0.005) {
            scales[index] = scale;
            scaleTo[index].x(scale);
            scaleTo[index].y(scale);
          }
        });
      };
      const requestLens = () => { if (!frame) frame = requestAnimationFrame(renderLens); };
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || !ready || !inView || document.hidden) return;
        pointer = { x: event.clientX - origin.left, y: event.clientY - origin.top };
        requestLens();
      };
      const resetLens = () => { pointer = null; requestLens(); };
      const updatePlayback = () => {
        timeline.paused(!ready || !inView || document.hidden);
        if (document.hidden || !inView) resetLens();
      };
      const onReady = () => { ready = true; updatePlayback(); };
      const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        updatePlayback();
      });
      const resize = new ResizeObserver(cachePositions);
      cachePositions();
      observer.observe(field);
      resize.observe(field);
      window.addEventListener('resize', cachePositions);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerleave', resetLens);
      window.addEventListener('scroll', updateOrigin, { passive: true });
      window.addEventListener('preloader:done', onReady);
      document.addEventListener('visibilitychange', updatePlayback);

      return () => {
        observer.disconnect();
        resize.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', cachePositions);
        window.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerleave', resetLens);
        window.removeEventListener('scroll', updateOrigin);
        window.removeEventListener('preloader:done', onReady);
        document.removeEventListener('visibilitychange', updatePlayback);
      };
    }, field);

    return () => media.revert();
  }, [columns]);

  return (
    <footer id="footer" ref={footerRef} className="dot-matrix-footer" aria-label="Birpe">
      <div className="footer-top">
        <div><a href="#top" className="footer-logo" aria-label="Birpe home"><img src="/assets/images/bird-logo.png" alt="" width="64" height="64" /><span className="u-h2-5">birpe</span></a><p className="footer-tagline u-body-3 u-fg-64">Life, a little lighter.</p></div>
        <nav className="footer-links" aria-label="Footer navigation">
          <div><a className="u-title" href="#what-birpe-does"><RollText text="What Birpe does" /></a><a className="u-title-s u-fg-50" href="#how-it-works"><RollText text="How it works" /></a><a className="u-title-s u-fg-50" href="#faqs"><RollText text="FAQs" /></a></div>
          <div><a className="u-title" href="#waitlist"><RollText text="Join the waitlist" /></a><a className="u-title-s u-fg-50" href="#try-a-task"><RollText text="Try a sample task" /></a></div>
        </nav>
      </div>
      <div className="footer-meta u-small-1 u-fg-64"><span>©2026 Birpe. All rights reserved.</span><a href="#top">Back to top ↑</a></div>
      <div ref={displayRef} className="footer-display">
      <div id="dotsField" ref={fieldRef} className="dot-matrix" role="img" aria-label="Birpe dot-matrix display"
        style={{ '--dot-columns': columns, '--dot-rows': ROWS } as CSSProperties}>
        {Array.from({ length: columns * ROWS }, (_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          return <div key={`${columns}-${index}`} className="dot-matrix__dot" aria-hidden="true"
            data-col={column} data-row={row} data-lit={patternAt(BIRPE_DOT_PATTERN, column, row, columns)} />;
        })}
      </div>
      </div>
    </footer>
  );
}
