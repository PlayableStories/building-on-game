import { describe, expect, it } from 'vitest';
import {
  causeWords,
  config,
  deck,
  pairLines,
  plot,
  situations,
  qualityLines,
  qualitySeverity,
} from '../content.ts';
import { createGame } from './game.ts';
import {
  ALL_CELLS,
  isOccupied,
  legalCells,
  orientationOf,
  orthogonalNeighbours,
  zoneOf,
} from './grid.ts';

const game = createGame(deck, config, { pairLines, qualityLines, qualitySeverity, causeWords }, plot, situations.map((s) => s.id));
const opening = game.reducer(game.initialState(1), { type: 'BEGIN' });

const FABRIC = plot.fabric.map((room) => room.cell);
const DOOR = plot.frontDoor.cell;

describe('the plot', () => {
  it('is 25 cells', () => {
    expect(ALL_CELLS).toHaveLength(25);
  });

  it('starts with the old rooms on B2, C2, B3, C3 (§5)', () => {
    expect(opening.fabric).toEqual(['B2', 'C2', 'B3', 'C3']);
    for (const cell of FABRIC) {
      expect(isOccupied(opening, cell)).toBe(true);
    }
  });

  it('starts with the front door on C1, on the street (§5)', () => {
    expect(opening.frontDoor).toBe('C1');
    expect(isOccupied(opening, 'C1')).toBe(true);
  });

  it('treats everything else as unoccupied', () => {
    const standing: string[] = [...FABRIC, DOOR];
    for (const cell of ALL_CELLS.filter((cell) => !standing.includes(cell))) {
      expect(isOccupied(opening, cell)).toBe(false);
    }
  });
});

describe('zones (§5)', () => {
  it('reads rows 1–3 as the house', () => {
    expect(zoneOf('A1', 4)).toBe('indoor');
    expect(zoneOf('C3', 4)).toBe('indoor');
  });

  it('reads rows 4–5 as the garden', () => {
    expect(zoneOf('C4', 4)).toBe('outdoor');
    expect(zoneOf('E5', 4)).toBe('outdoor');
  });

  it('is content, not geometry — moving the boundary moves the garden', () => {
    expect(zoneOf('C3', 3)).toBe('outdoor');
    expect(zoneOf('C4', 5)).toBe('indoor');
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

  it('cross the boundary between the house and the garden', () => {
    // The rule is about where a plan may go, not about what it can be next to.
    // A heat pump in the garden is still against the back of the house.
    expect(orthogonalNeighbours('B4')).toContain('B3');
  });
});

describe('orientation (§5)', () => {
  it('reads row 1 as north — the street elevation', () => {
    expect(orientationOf('C1')).toBe('north');
  });

  it('reads row 4 as north too — the strip the house keeps in shadow', () => {
    expect(orientationOf('C4')).toBe('north');
  });

  it('reads rows 3 and 5 as south, towards the sun', () => {
    expect(orientationOf('C3')).toBe('south');
    expect(orientationOf('C5')).toBe('south');
  });

  it('reads row 2 as neither, so nothing fires in the middle of the house', () => {
    expect(orientationOf('C2')).toBeNull();
  });
});

describe('legal cells (§5, §7)', () => {
  it('offers an indoor plan the old rooms and everything touching the house', () => {
    // The four old rooms are legal because placing on one demolishes it (§7.2);
    // the rest are the empty indoor cells touching something already standing.
    // C1 is missing on purpose: it is the front door.
    expect(legalCells(opening, 'indoor')).toEqual([
      'A2',
      'A3',
      'B1',
      'B2',
      'B3',
      'C2',
      'C3',
      'D1',
      'D2',
      'D3',
    ]);
  });

  it('offers an outdoor plan only the garden behind the house', () => {
    expect(legalCells(opening, 'outdoor')).toEqual(['B4', 'C4']);
  });

  it('never offers the front door to anything (§7)', () => {
    expect(legalCells(opening, 'indoor')).not.toContain(DOOR);
    expect(legalCells(opening, 'outdoor')).not.toContain(DOOR);
  });

  it('never offers a cell that already holds a placement (§7.3)', () => {
    const indoor = opening.hand.find(
      (id) => deck.find((plan) => plan.id === id)?.zone === 'indoor',
    );
    if (indoor === undefined) throw new Error('no indoor plan in the opening hand');

    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId: indoor });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'D2' });

    expect(placed.placements).toHaveLength(1);
    expect(legalCells(placed, 'indoor')).not.toContain('D2');
  });

  it('grows as the house grows', () => {
    const indoor = opening.hand.find(
      (id) => deck.find((plan) => plan.id === id)?.zone === 'indoor',
    );
    if (indoor === undefined) throw new Error('no indoor plan in the opening hand');

    expect(legalCells(opening, 'indoor')).not.toContain('E2');
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId: indoor });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'D2' });
    expect(legalCells(placed, 'indoor')).toContain('E2');
  });

  /**
   * §5 — the risk zoning introduces is a hand nobody can play. It cannot happen,
   * and this is the reason: demolishing a room replaces it with the placement
   * that demolished it, so the cells the old house stands on are occupied for
   * the whole game whatever the player does. Both zones therefore always touch
   * something, and both always have somewhere left to build.
   */
  it('never leaves either zone without a frontier, whatever is demolished', () => {
    let state = opening;

    // Take the whole old house down, one room at a time.
    for (const room of FABRIC) {
      const planId = state.hand.find(
        (id) => deck.find((plan) => plan.id === id)?.zone === 'indoor',
      );
      if (planId === undefined) throw new Error('no indoor plan to demolish with');

      state = game.reducer(state, { type: 'SELECT_PLAN', planId });
      state = game.reducer(state, { type: 'PLACE', cell: room });
      state = game.reducer(state, { type: 'CONFIRM_DEMOLITION' });
      if (state.observation !== null) state = game.reducer(state, { type: 'DISMISS' });

      expect(state.fabric).not.toContain(room);
      expect(legalCells(state, 'indoor').length).toBeGreaterThan(0);
      expect(legalCells(state, 'outdoor').length).toBeGreaterThan(0);
    }
  });
});
