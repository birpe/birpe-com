import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNS, ROWS, wordPieces } from '../src/lib/tetris.ts';

const key = ([x, y]) => `${x},${y}`;

/** The same text for a shape in any position; rotations and mirrors are compared separately. */
function normalize(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => key([x - minX, y - minY])).sort().join(' ');
}
const TETROMINOES = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
].flatMap((shape) => {
  const turns = [shape];
  for (let i = 0; i < 3; i++) turns.push(turns[i].map(([x, y]) => [-y, x]));
  return turns.map(normalize);
});

test('the pieces rebuild the word exactly, on the board, without overlapping', () => {
  const cells = wordPieces().flat();
  assert.equal(new Set(cells.map(key)).size, cells.length);
  assert.ok(cells.every(([x, y]) => x >= 0 && x < COLUMNS && y >= 0 && y < ROWS));
  const drawn = Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLUMNS }, (_, x) =>
    cells.some(([cx, cy]) => cx === x && cy === ROWS - 1 - row) ? '#' : '.').join(''));
  assert.deepEqual(drawn, [
    '#..........................',
    '#......#...................',
    '######...####.######.######',
    '#....#.#.#....#....#.#....#',
    '#....#.#.#....#....#.######',
    '#....#.#.#....#....#.#.....',
    '######.#.#....######.#####.',
    '..............#............',
    '..............#............',
  ]);
});
test('every piece is a true tetromino, apart from the single block for the i\'s dot', () => {
  const pieces = wordPieces();
  assert.equal(pieces.filter((piece) => piece.length === 1).length, 1);
  for (const piece of pieces.filter(({ length }) => length > 1)) {
    assert.equal(piece.length, 4);
    assert.ok(TETROMINOES.includes(normalize(piece)), normalize(piece));
  }
});
test('each piece falls straight in without crossing one that has landed', () => {
  const landed = [];
  for (const piece of wordPieces()) {
    for (const [x, y] of piece) assert.ok(!landed.some(([lx, ly]) => lx === x && ly > y));
    landed.push(...piece);
  }
});
