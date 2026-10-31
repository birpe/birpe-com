import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';

// The word builds in about three seconds; this keeps a paused fall from leaving the page blank and locked.
const REVEAL_FALLBACK_MS = 4000;

/** The loader releases the falling word, and the finished word releases everything else. Markup owns the word spans so React stays in control. */
export function useHeroIntro(scope: RefObject<HTMLElement | null>) {
  const [wordReady, setWordReady] = useState(false);
  const reveal = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const media = gsap.matchMedia();
    let hasPlayed = false;
    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      document.dispatchEvent(new CustomEvent('hero:built', { bubbles: true }));
    };

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
        root.inert = false;
      };

      // A live preference change reveals the finished layout instead of replaying it.
      if (hasPlayed) {
        gsap.killTweensOf(words);
        gsap.set([...pieces, ...words], { clearProps: 'opacity,visibility,transform,color' });
        done();
        announce();
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
        timeline.to(select('[data-hero-logo]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 0.1)
          .to(select('[data-hero-nav]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.6 }, 0.2)
          .to(select('[data-hero-button]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 0.35)
          .to(select('[data-hero-delayed]'), { autoAlpha: 1, duration: 0.4 }, 0.35);
      }

      let revealed = false;
      let fallback: number | undefined;
      reveal.current = () => {
        if (revealed) return;
        revealed = true;
        window.clearTimeout(fallback);
        root.dataset.introState = 'playing';
        root.inert = false;
        timeline.play();
        announce();
      };

      let released = false;
      const play = () => {
        if (released) return;
        released = true;
        hasPlayed = true;
        root.dataset.introState = 'falling';
        setWordReady(true);
        // The scroll lock blocks the browser's own jump to an anchor, so it happens here.
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
        // No fall to wait for: reduced motion skips it, and a page opened on an anchor has the word offscreen.
        if (context.conditions?.reduced || window.scrollY > 0) reveal.current();
        else fallback = window.setTimeout(reveal.current, REVEAL_FALLBACK_MS);
      };
      window.addEventListener('preloader:done', play);
      if (!document.documentElement.classList.contains('is-loading')) play();

      return () => {
        window.removeEventListener('preloader:done', play);
        window.clearTimeout(fallback);
        reveal.current = () => {};
        root.inert = false;
      };
    }, root);

    return () => {
      gsap.killTweensOf(root.querySelectorAll('[data-hero-word]'));
      media.revert();
    };
  }, [scope]);

  // The falling word calls these, so the tagline only ever shows beside the finished word.
  const showTagline = useCallback(() => {
    const root = scope.current;
    if (!root) return;
    reveal.current();
    const words = gsap.utils.toArray<HTMLElement>(root.querySelectorAll('[data-hero-word]'));
    const restColor = getComputedStyle(root).color;
    gsap.killTweensOf(words);
    gsap.set(words, { opacity: 0, color: '#0780FD' });
    words.forEach((word, index) => {
      gsap.to(word, {
        delay: index * 0.2,
        keyframes: [
          { opacity: 1, color: '#0780FD', duration: 0.05 },
          { color: '#3B9BFC', duration: 0.05 },
          { color: restColor, opacity: word.dataset.muted === 'true' ? 0.5 : 1, duration: 0.05 },
        ],
        // Hands the color back to CSS, so it follows later theme changes.
        onComplete: () => { gsap.set(word, { clearProps: 'color' }); },
      });
    });
  }, [scope]);

  const hideTagline = useCallback((duration: number) => {
    const words = scope.current?.querySelectorAll('[data-hero-word]');
    if (!words) return;
    gsap.killTweensOf(words);
    gsap.to(words, { opacity: 0, duration, ease: 'power1.inOut' });
  }, [scope]);

  return { wordReady, showTagline, hideTagline };
}
