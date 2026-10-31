import { useLayoutEffect, useState, type RefObject } from 'react';
import { gsap } from 'gsap';

/** One loader-driven entrance timeline. Markup owns the word spans so React stays in control. */
export function useHeroIntro(scope: RefObject<HTMLElement | null>) {
  const [introDone, setIntroDone] = useState(false);
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const media = gsap.matchMedia();
    let hasPlayed = false;

    media.add({
      motion: '(prefers-reduced-motion: no-preference)',
      reduced: '(prefers-reduced-motion: reduce)',
    }, (context) => {
      const select = gsap.utils.selector(root);
      const pieces = select('[data-intro]');
      const words = select('[data-hero-word]') as HTMLElement[];
      const text = select('[data-hero-text]');
      const restColor = getComputedStyle(root).color;
      const mutedOpacity = (_: number, word: HTMLElement) => word.dataset.muted === 'true' ? 0.5 : 1;
      const done = () => {
        // Hands the words back to CSS, so they follow later theme changes.
        gsap.set(words, { clearProps: 'color' });
        root.dataset.introState = 'done';
        setIntroDone(true);
        root.inert = false;
      };

      // A live preference change reveals the finished layout instead of replaying it.
      if (hasPlayed) {
        gsap.set([...pieces, ...words], { clearProps: 'opacity,visibility,transform,color' });
        done();
        return;
      }

      root.dataset.introState = 'waiting';
      root.inert = true;
      gsap.set(pieces, { autoAlpha: 0 });
      const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' }, onComplete: done });

      if (context.conditions?.reduced) {
        timeline.to(pieces, { autoAlpha: 1, duration: 0 })
          .to(words, { opacity: mutedOpacity, color: restColor, duration: 0 }, 0);
      } else {
        gsap.set(words, { opacity: 0, color: '#0780FD' });
        gsap.set(select('[data-hero-logo], [data-hero-nav], [data-hero-button]'), { y: '1.5rem', scale: 0.9 });

        timeline.set(text, { autoAlpha: 1 }, 0);
        root.querySelectorAll('[data-hero-text]').forEach((line) => {
          line.querySelectorAll<HTMLElement>('[data-hero-word]').forEach((word, index) => {
            timeline.to(word, {
              keyframes: [
                { opacity: 1, color: '#0780FD', duration: 0.05 },
                { color: '#3B9BFC', duration: 0.05 },
                { color: restColor, opacity: word.dataset.muted === 'true' ? 0.5 : 1, duration: 0.05 },
              ],
            }, index * 0.2);
          });
        });

        timeline.to(select('[data-hero-logo]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 0.1)
          .to(select('[data-hero-nav]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.6 }, 0.2)
          .to(select('[data-hero-button]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 0.35)
          .to(select('[data-hero-delayed]'), { autoAlpha: 1, duration: 0.4 }, 0.35);
      }

      let released = false;
      const play = () => {
        if (released) return;
        released = true;
        hasPlayed = true;
        root.dataset.introState = 'playing';
        root.inert = false;
        timeline.play();
      };
      window.addEventListener('preloader:done', play);
      if (!document.documentElement.classList.contains('is-loading')) play();

      return () => {
        window.removeEventListener('preloader:done', play);
        root.inert = false;
      };
    }, root);

    return () => media.revert();
  }, [scope]);
  return introDone;
}
