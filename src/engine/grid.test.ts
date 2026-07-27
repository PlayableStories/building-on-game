import { describe, expect, it } from 'vitest';
import { config, deck } from '../content.ts';
import { createGame } from './game.ts';
import {
  ALL_CELLS,
  FABRIC_CELLS,
  isOccupied,
  legalCells,
  orientationOf,
  orthogonalNeighbours,
} from './grid.ts';

const game = createGame(deck, config);
const opening = game.initialState(1);

describe('the plot', () => {
  it('is 25 cells', () => {
    expect(ALL_CELLS).toHaveLength(25);
  });

  it('starts with the inherited house on B2, C2, B3, C3 (§5)', () => {
    expect(opening.fabric).toEqual(['B2', 'C2', 'B3', 'C3']);
    for (const cell of FABRIC_CELLS) {
      expect(isOccupied(opening, cell)).toBe(true);
    }
  });

  it('starts with the front door on B2 (§5)', () => {
    expect(opening.frontDoor).toBe('B2');
  });

  it('treats everything else as unoccupied', () => {
    const empty = ALL_CELLS.filter((cell) => !FABRIC_CELLS.includes(cell));
    for (const cell of empty) {
      expect(isOccupied(opening, cell)).toBe(false);
    }
  });
});

describe('neighbours', () => {
  it('are orthogonal only — a diagonal is not a neighbour (§7.1)', () => {
    expect(orthogonalNeighbours('C3').sort()).toEqual(['B3', 'C2', 'C4', 'D3']);
  });

  it('are clipped at the edges of the plot', () => {
    expect(orthogonalNeighbours('A1').sort()).toEqual(['A2', 'B1']);
    expect(orthogonalNeighbours('E5').sort()).toEqual(['D5', 'E4']);
  });
});

describe('orientation (§5)', () => {
  it('reads rows 1–2 as north, the street', () => {
    expect(orientationOf('C1')).toBe('north');
    expect(orientationOf('C2')).toBe('north');
  });

  it('reads rows 4–5 as south, the garden', () => {
    expect(orientationOf('C4')).toBe('south');
    expect(orientationOf('C5')).toBe('south');
  });

  it('reads row 3 as neither, so nothing fires there', () => {
    expect(orientationOf('C3')).toBeNull();
  });
});

describe('legal cells (§7)', () => {
  it('is the fabric plus everything orthogonally touching it, and nothing else', () => {
    // The four fabric cells are legal because placing on one demolishes it
    // (§7.2); the other eight are the empty cells touching the old house.
    expect(legalCells(opening)).toEqual([
      'A2',
      'A3',
      'B1',
      'B2',
      'B3',
      'B4',
      'C1',
      'C2',
      'C3',
      'C4',
      'D2',
      'D3',
    ]);
  });

  it('never offers a cell that already holds a placement (§7.3)', () => {
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'C1' });

    expect(placed.placements).toHaveLength(1);
    expect(legalCells(placed)).not.toContain('C1');
  });

  it('grows as the house grows', () => {
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    // B4 is legal at the opening; placing there should make B5 legal, which it
    // was not before.
    expect(legalCells(opening)).not.toContain('B5');
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'B4' });
    expect(legalCells(placed)).toContain('B5');
  });
});
