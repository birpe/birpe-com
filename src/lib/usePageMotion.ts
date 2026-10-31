import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { motionEase } from './motion';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Native-scroll entrance effects and CSS loops, released by the preloader. */
export function usePageMotion(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const page = scope.current;
    if (!page) return;

    let started = false;
    let disposed = false;
    const media = gsap.matchMedia();

    const start = () => {
      if (started || disposed) return;
      started = true;
      page.dataset.motionReady = 'true';

      media.add('(prefers-reduced-motion: no-preference)', () => {
        const elements = gsap.utils.toArray<HTMLElement>('[data-reveal]', page);

        elements.forEach((element) => {
          gsap.from(element, {
            opacity: 0,
            y: '1.5rem',
            duration: 0.85,
            ease: motionEase['out-expo'],
            clearProps: 'opacity,transform',
            onComplete(this: gsap.core.Tween) {
              this.scrollTrigger?.kill(false);
            },
            scrollTrigger: {
              trigger: element,
              start: 'clamp(top 88%)',
              once: true,
            },
          });
        });

        const headings = gsap.utils.toArray<HTMLElement>('[data-reveal-words]', page);

        headings.forEach((heading) => {
          gsap.set(heading, { autoAlpha: 0 });
          ScrollTrigger.create({
            trigger: heading,
            start: 'clamp(top 88%)',
            // Stays active to the page end so an anchor jump past a heading still reveals it.
            end: 'max',
            once: true,
            onEnter() {
              // Reverting at the end hands each word back to its CSS color, including muted spans.
              const split = SplitText.create(heading, { type: 'words' });
              const words = split.words as HTMLElement[];
              const restColor = getComputedStyle(heading).color;
              gsap.set(words, { opacity: 0, color: '#0780FD' });
              gsap.set(heading, { clearProps: 'opacity,visibility' });
              const timeline = gsap.timeline({ onComplete: () => split.revert() });
              words.forEach((word, index) => {
                timeline.to(word, {
                  keyframes: [
                    { opacity: 1, color: '#0780FD', duration: 0.2, ease: 'power2.out' },
                    { color: '#3B9BFC', duration: 0.05, ease: 'none' },
                    // u-fg-50 resolves to a color() value GSAP can't tween, so muted words fade by opacity.
                    { color: restColor, opacity: word.closest('.u-fg-50') ? 0.5 : 1, duration: 0.1, ease: 'none' },
                  ],
                }, index * 0.1);
              });
            },
          });
        });

        // Each pinned step recedes as the next one slides over it.
        const steps = gsap.utils.toArray<HTMLElement>('[data-step]', page);

        steps.slice(0, -1).forEach((step, index) => {
          gsap.to(step.querySelector('[data-step-card]'), {
            scale: 0.94,
            ease: 'none',
            scrollTrigger: { trigger: steps[index + 1], start: 'top bottom', end: 'top top', scrub: true },
          });
        });

        // Font metrics can change trigger positions after the initial render.
        void document.fonts.ready.then(() => {
          if (!disposed && elements.length + headings.length > 0) ScrollTrigger.refresh();
        });
      }, page);
    };

    window.addEventListener('preloader:done', start);
    // Also supports mounting content after the loader has already finished.
    if (!document.documentElement.classList.contains('is-loading')) start();

    return () => {
      disposed = true;
      window.removeEventListener('preloader:done', start);
      media.revert();
      delete page.dataset.motionReady;
    };
  }, [scope]);
}
