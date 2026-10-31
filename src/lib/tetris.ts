export type Cell = readonly [number, number];
export type Piece = readonly Cell[];

// Lowercase to match the logo. Top row first; the last two rows hold the p's descender.
// Each letter a-e marks one tetromino, and alphabetical order is the order it falls in.
// The dot on the i is the one exception: a single block, because a larger one looks too heavy.
const LETTERS = [
  ['e.....', 'e.....', 'eedddd', 'a....c', 'a....c', 'a....c', 'abbbbc', '......', '......'],
  ['.', 'b', '.', 'a', 'a', 'a', 'a', '.', '.'],
  ['....', '....', 'bbbb', 'a...', 'a...', 'a...', 'a...', '....', '....'],
  ['......', '......', 'ddeeee', 'd....c', 'd....c', 'a....c', 'abbbbc', 'a.....', 'a.....'],
  ['......', '......', 'eeeedd', 'b....d', 'bccccd', 'b.....', 'baaaa.', '......', '......'],
];

export const ROWS = LETTERS[0].length;
export const COLUMNS = LETTERS.reduce((sum, letter) => sum + letter[0].length, LETTERS.length - 1);

/** Every tetromino of the word, letter by letter, with row 0 at the bottom of the board. */
export function wordPieces(): Piece[] {
  let offset = 0;
  return LETTERS.flatMap((letter) => {
    const pieces = new Map<string, Cell[]>();
    letter.forEach((row, index) => [...row].forEach((mark, x) => {
      if (mark === '.') return;
      pieces.set(mark, [...(pieces.get(mark) ?? []), [x + offset, ROWS - 1 - index]]);
    }));
    offset += letter[0].length + 1;
    return [...pieces.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, cells]) => cells);
  });
}
