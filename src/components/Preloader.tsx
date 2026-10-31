import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import '@/styles/preloader.css';

const SEEN_KEY = 'birpe:preloader:seen';
const CHECKPOINTS = [0, 17, 35, 58, 76, 89, 100];
const IMAGES = ['refund', 'booking', 'bills', 'call'].map(
  (name) => `/assets/images/preloader/${name}.svg`,
);
const BAR_OPACITIES = [1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];

export default function Preloader() {
  const panel = useRef<HTMLElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const [complete, setComplete] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const overlay = panel.current!;
    const counter = number.current!;
    const indicator = progress.current!;
    const previousOverflow = root.style.overflow;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let returning = false;
    try {
      returning = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // Private browsing may disable storage; the first-visit sequence still works.
    }

    const speed = returning ? 0.2 : 1;
    let disposed = false;
    let flip: number | undefined;
    let context: gsap.Context | undefined;

    // Scrolling stays locked while the word builds, because everything below it is still hidden.
    const unlock = () => {
      root.style.overflow = previousOverflow;
      setComplete(true);
    };

    root.classList.add('is-loading');
    root.style.overflow = 'hidden';
    if (returning) {
      counter.textContent = 'Ready';
      indicator.setAttribute('aria-valuenow', '100');
      indicator.setAttribute('aria-valuetext', 'Ready');
    }

    const finish = () => {
      if (disposed) return;
      window.clearInterval(flip);
      root.classList.remove('is-loading');
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        // The loader doesn't depend on storage being available.
      }
      overlay.hidden = true;
      // Registered first: with no fall to wait for, the hero answers during this dispatch.
      window.addEventListener('hero:built', unlock, { once: true });
      document.dispatchEvent(new CustomEvent('preloader:done', { bubbles: true }));
    };

    const start = () => {
      if (disposed) return;
      context = gsap.context(() => {
        const elements = Array.from(overlay.children);
        const images = Array.from(overlay.querySelectorAll<HTMLImageElement>('.preloader__images img'));
        let activeImage = 0;

        if (!reducedMotion) {
          flip = window.setInterval(() => {
            activeImage = (activeImage + 1) % images.length;
            images.forEach((image, index) => {
              image.style.zIndex = index === activeImage ? '2' : '1';
            });
          }, 500 * speed);
        }

        const timeline = gsap.timeline({ onComplete: finish });

        if (reducedMotion) {
          counter.textContent = returning ? 'Ready' : '100';
          indicator.setAttribute('aria-valuenow', '100');
          timeline.set(elements, { autoAlpha: 1, filter: 'none' })
            .to(overlay, { opacity: 0, duration: 0.2, delay: 0.3 });
          return;
        }

        timeline.fromTo(elements,
          { autoAlpha: 0, filter: 'blur(1.25rem)' },
          { autoAlpha: 1, filter: 'blur(0rem)', duration: 1 * speed, stagger: 0.05 * speed, ease: 'power2.out' },
        );
        const exitAt = timeline.duration() + 2.5 * speed;

        if (!returning) {
          const count = { value: 0 };
          CHECKPOINTS.slice(1).forEach((checkpoint, index) => {
            timeline.to(count, {
              value: checkpoint,
              duration: (2.5 / (CHECKPOINTS.length - 1)) * speed,
              ease: 'power2.out',
              onUpdate: () => {
                const value = String(Math.round(count.value));
                counter.textContent = value;
                indicator.setAttribute('aria-valuenow', value);
              },
            }, 0.5 * speed + index * (2.5 / (CHECKPOINTS.length - 1)) * speed);
          });
        }

        timeline.to(elements, {
          autoAlpha: 0,
          filter: 'blur(1.25rem)',
          duration: 1 * speed,
          stagger: 0.05 * speed,
          ease: 'power2.in',
        }, exitAt).to(overlay, { opacity: 0, duration: 0.6 * speed, ease: 'power2.in' });
      }, overlay);
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener('load', start);
      window.removeEventListener('hero:built', unlock);
      window.clearInterval(flip);
      context?.revert();
      root.classList.remove('is-loading');
      root.style.overflow = previousOverflow;
    };
  }, []);

  if (complete) return null;

  return (
    <section ref={panel} className="preloader" aria-label="Loading Birpe">
      <div className="preloader__brand u-h4 u-fg-100" aria-label="Birpe">
        <img src="/assets/images/bird-logo.png" alt="" width="44" height="44" />
        <span>birpe</span>
      </div>

      <div className="preloader__images" aria-hidden="true">
        {IMAGES.map((src, index) => (
          <img key={src} src={src} alt="" width="512" height="768"
            fetchPriority="high" style={{ zIndex: index === 0 ? 2 : 1 }} />
        ))}
      </div>

      <div ref={progress} className="preloader__progress" role="progressbar"
        aria-label="Loading Birpe" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
        <svg className="preloader__spinner" viewBox="0 0 56 56" fill="currentColor" aria-hidden="true">
          {BAR_OPACITIES.map((opacity, index) => (
            <rect key={index} x="23" y="1" width="10" height="12" rx="2.3"
              opacity={opacity} transform={`rotate(${-index * 45} 28 28)`} />
          ))}
        </svg>
        <span ref={number} className="preloader__number u-h1 u-fg-100" aria-hidden="true">0</span>
      </div>
    </section>
  );
}
