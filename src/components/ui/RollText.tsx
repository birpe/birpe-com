import type { CSSProperties } from 'react';

/** Link and button text whose letters roll up in sequence when the parent is hovered. */
export default function RollText({ text }: { text: string }) {
  const line = [...text].map((char, index) => (
    <span key={index} className="roll-char" style={{ '--c': index } as CSSProperties}>{char}</span>
  ));
  return (
    <span className="roll">
      <span className="sr-only">{text}</span>
      <span className="roll-line" aria-hidden="true">{line}</span>
      <span className="roll-line" aria-hidden="true">{line}</span>
    </span>
  );
}
