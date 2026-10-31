import { useRef } from 'react';
import Preloader from './Preloader';
import DotMatrixFooter from './DotMatrixFooter';
import BirpeHero from './BirpeHero';
import { usePageMotion } from '@/lib/usePageMotion';

export default function BirpeLanding() {
  const page = useRef<HTMLElement>(null);
  usePageMotion(page);

  return (
    <>
      <Preloader />
      <main ref={page} className="home-shell" aria-label="Birpe home">
        <BirpeHero />
        <DotMatrixFooter />
      </main>
    </>
  );
}
