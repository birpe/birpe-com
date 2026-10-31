import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { COLUMNS, ROWS, wordPieces, type Piece } from '@/lib/tetris';
import styles from './TetrisSkyline.module.css';

const PIECES = wordPieces();
const ROW_SECONDS = 0.03;
// The next piece enters once this share of the current fall has played.
const OVERLAP = 0.55;
const LOCK_SECONDS = 0.08;
const HOLD_SECONDS = 6;
const FADE_SECONDS = 0.35;
// Rows above the landing spot where a piece is still turned, then still off to one side.
const TURNED_ABOVE = 6;
const SHIFTED_ABOVE = 4;

/** Whole-cell positions a piece passes through, from above the board down to its landing spot. */
function fallFrames(piece: Piece) {
  const [px, py] = piece[piece.length >> 1];
  const pivot = `${px + 0.5} ${ROWS - 1 - py + 0.5}`;
  const shift = Math.min(...piece.map(([x]) => x)) < COLUMNS / 2 ? 1 : -1;
  const distance = ROWS - Math.min(...piece.map(([, y]) => y)) + 2;
  return Array.from({ length: distance + 1 }, (_, step) => {
    const above = distance - step;
    return `translate(${above >= SHIFTED_ABOVE ? shift : 0} ${-above}) rotate(${above >= TURNED_ABOVE ? 90 : 0} ${pivot})`;
  });
}

export default function TetrisSkyline({ ready, onBuilt, onClearing }: { ready: boolean; onBuilt: () => void; onClearing: (seconds: number) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const board = useRef<SVGSVGElement>(null);

  // A layout effect, so the finished word never shows for a frame before the pieces lift off.
  useLayoutEffect(() => {
    if (!ready) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const pieces = gsap.utils.toArray<SVGGElement>(board.current!.children);
      const timeline = gsap.timeline({ paused: true, repeat: -1 });
      let start = 0, end = 0;
      pieces.forEach((element, index) => {
        const frames = fallFrames(PIECES[index]);
        gsap.set(element, { attr: { transform: frames[0] } });
        frames.forEach((transform, step) => timeline.set(element, { attr: { transform } }, start + step * ROW_SECONDS));
        const landed = start + (frames.length - 1) * ROW_SECONDS;
        timeline.set(element, { opacity: 0.5 }, landed).set(element, { opacity: 1 }, landed + LOCK_SECONDS);
        end = landed + LOCK_SECONDS;
        start += (frames.length - 1) * ROW_SECONDS * OVERLAP;
      });
      timeline.call(onBuilt, undefined, end).call(onClearing, [FADE_SECONDS], end + HOLD_SECONDS);
      timeline.to(board.current, { opacity: 0, duration: FADE_SECONDS, ease: 'power1.inOut' }, end + HOLD_SECONDS);
      let visible = false;
      const sync = () => { timeline.paused(!visible || document.hidden); };
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
      observer.observe(root.current!);
      document.addEventListener('visibilitychange', sync);
      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
      };
    });
    return () => media.revert();
  }, [ready, onBuilt, onClearing]);

  return (
    <div ref={root} className={styles.root} style={{ aspectRatio: `${COLUMNS} / ${ROWS}` }} aria-hidden="true" data-ready={ready}>
      <svg ref={board} className={styles.board} viewBox={`0 0 ${COLUMNS} ${ROWS}`} focusable="false">
        {PIECES.map((cells, index) => <g key={index}>
          {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x + 0.025} y={ROWS - 1 - y + 0.025} width="0.95" height="0.95" />)}
        </g>)}
      </svg>
    </div>
  );
}
