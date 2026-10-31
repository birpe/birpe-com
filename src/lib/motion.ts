import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

/** One source for CSS and GSAP timing curves. */
export const motionCurves = {
  'out-expo': [0.16, 1, 0.3, 1],
  rise: [0.32, 0, 0.12, 1],
  soft: [0.33, 1, 0.68, 1],
  snappy: [0.215, 0.61, 0.355, 1],
  pop: [0.34, 1.4, 0.64, 1],
  standard: [0.4, 0, 0.2, 1],
} as const;

gsap.registerPlugin(CustomEase);
export const motionEase = Object.fromEntries(Object.entries(motionCurves).map(([name, points]) =>
  [name, CustomEase.create(`birpe-${name}`, points.join(','))],
)) as Record<keyof typeof motionCurves, (progress: number) => number>;

export function installMotionTokens() {
  for (const [name, points] of Object.entries(motionCurves)) {
    document.documentElement.style.setProperty(`--ease-${name}`, `cubic-bezier(${points.join(',')})`);
  }
}
