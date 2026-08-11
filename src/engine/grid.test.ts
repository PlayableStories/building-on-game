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
import type { CellId, GameState } from '../types.ts';
import { createGame } from './game.ts';
import {
  ALL_CELLS,
  above,
  below,
  levelOf,
  isOccupied,
  legalCells,
  orientationOf,
  orthogonalNeighbours,
  isGarden,
} from './grid.ts';

const game = createGame(deck, config, { pairLines, qualityLines, qualitySeverity, causeWords }, plot, situations.map((s) => s.id));
const opening = game.reducer(game.initialState(1), { type: 'BEGIN' });

const FABRIC = plot.fabric.map((room) => room.cell);
const DOOR = plot.frontDoor.cell;
const STAIR = plot.stair.cell;
const LANDING = 'FB1';

/** Put one named plan in hand and select it, so a test can aim it anywhere. */
function rig(state: GameState, planId: string): GameState {
  return { ...state, hand: [planId], selectedPlanId: planId };
}

/** Place a named plan on a named cell, saying yes to any demolition it asks for. */
function put(state: GameState, planId: string, cell: CellId): GameState {
  const placed = game.reducer(rig(state, planId), { type: 'PLACE', cell });
  const settled =
    placed.pendingDemolition === null
      ? placed
      : game.reducer(placed, { type: 'CONFIRM_DEMOLITION' });
  return settled.observation === null
    ? settled
    : game.reducer(settled, { type: 'DISMISS' });
}

describe('the plot', () => {
  it('is three levels of 25 cells', () => {
    expect(ALL_CELLS).toHaveLength(75);
    expect(ALL_CELLS.filter((cell) => cell.startsWith('G'))).toHaveLength(25);
    expect(ALL_CELLS.filter((cell) => cell.startsWith('F'))).toHaveLength(25);
    expect(ALL_CELLS.filter((cell) => cell.startsWith('R'))).toHaveLength(25);
  });

  it('starts with the old rooms on B2, C2, B3, C3 (§5)', () => {
    expect(opening.fabric).toEqual(['GB2', 'GC2', 'GB3', 'GC3']);
    for (const cell of FABRIC) {
      expect(isOccupied(opening, cell)).toBe(true);
    }
  });

  it('starts with the front door on C1, on the street (§5)', () => {
    expect(opening.frontDoor).toBe('GC1');
    expect(isOccupied(opening, 'GC1')).toBe(true);
  });

  it('starts with the stair on the ground floor and its landing above it (§5)', () => {
    expect(opening.stair).toBe(STAIR);
    expect(opening.landing).toBe(LANDING);
    expect(isOccupied(opening, STAIR)).toBe(true);
    expect(isOccupied(opening, LANDING)).toBe(true);
  });

  it('treats everything else as unoccupied', () => {
    const standing: string[] = [...FABRIC, DOOR, STAIR, LANDING];
    for (const cell of ALL_CELLS.filter((cell) => !standing.includes(cell))) {
      expect(isOccupied(opening, cell)).toBe(false);
    }
  });
});

describe('the garden (§5)', () => {
  it('reads rows 1–3 as the building', () => {
    expect(isGarden('GA1', 4)).toBe(false);
    expect(isGarden('GC3', 4)).toBe(false);
  });

  it('reads rows 4–5 as the garden', () => {
    expect(isGarden('GC4', 4)).toBe(true);
    expect(isGarden('GE5', 4)).toBe(true);
  });

  it('is content, not geometry — moving the boundary moves the garden', () => {
    expect(isGarden('GC3', 3)).toBe(true);
    expect(isGarden('GC4', 5)).toBe(false);
  });
});

describe('levels (§5)', () => {
  it('stacks a cell over the same column and row', () => {
    expect(above('GB2')).toBe('FB2');
    expect(above('FB2')).toBe('RB2');
    expect(below('RB2')).toBe('FB2');
    expect(below('FB2')).toBe('GB2');
  });

  it('has nothing above the roof and nothing below the ground', () => {
    expect(above('RB2')).toBeNull();
    expect(below('GB2')).toBeNull();
  });

  it('reads the level off the cell', () => {
    expect(levelOf('GB2')).toBe('ground');
    expect(levelOf('FB2')).toBe('first');
    expect(levelOf('RB2')).toBe('roof');
  });

  it('keeps a row facing the same way at every height (§5)', () => {
    // A first-floor front bedroom faces the street exactly as the room under
    // it does, and a dormer on the front slope faces it hardest of all.
    expect(orientationOf('FC1')).toBe('north');
    expect(orientationOf('RC1')).toBe('north');
    expect(orientationOf('RC3')).toBe('south');
  });
});

describe('neighbours', () => {
  it('are orthogonal only — a diagonal is not a neighbour (§7.1)', () => {
    expect(orthogonalNeighbours('GC3').sort()).toEqual(['GB3', 'GC2', 'GC4', 'GD3']);
  });

  it('are clipped at the edges of the plot', () => {
    expect(orthogonalNeighbours('GA1').sort()).toEqual(['GA2', 'GB1']);
    expect(orthogonalNeighbours('GE5').sort()).toEqual(['GD5', 'GE4']);
  });

  it('cross the boundary between the house and the garden', () => {
    // The rule is about where a plan may go, not about what it can be next to.
    // A heat pump in the garden is still against the back of the house.
    expect(orthogonalNeighbours('GB4')).toContain('GB3');
  });
});

describe('orientation (§5)', () => {
  it('reads row 1 as north — the street elevation', () => {
    expect(orientationOf('GC1')).toBe('north');
  });

  it('reads row 4 as north too — the strip the house keeps in shadow', () => {
    expect(orientationOf('GC4')).toBe('north');
  });

  it('reads rows 3 and 5 as south, towards the sun', () => {
    expect(orientationOf('GC3')).toBe('south');
    expect(orientationOf('GC5')).toBe('south');
  });

  it('reads row 2 as neither, so nothing fires in the middle of the house', () => {
    expect(orientationOf('GC2')).toBeNull();
  });
});

describe('legal cells (§5, §7)', () => {
  it('offers a house plan the old rooms and everything touching the house', () => {
    // The four old rooms are legal because placing on one demolishes it (§7.2);
    // the rest are the empty ground-floor cells touching something standing.
    // C1 is missing on purpose: it is the front door.
    // GB1 is missing too, now: it is the stair.
    expect(legalCells(opening, 'house')).toEqual([
      'GA1',
      'GD1',
      'GA2',
      'GB2',
      'GC2',
      'GD2',
      'GA3',
      'GB3',
      'GC3',
      'GD3',
    ]);
  });

  it('offers a garden plan only the garden behind the house', () => {
    expect(legalCells(opening, 'garden')).toEqual(['GB4', 'GC4']);
  });

  it('never offers the front door, the stair or the landing to anything (§7)', () => {
    for (const where of ['house', 'garden', 'upstairs', 'roof'] as const) {
      expect(legalCells(opening, where)).not.toContain(DOOR);
      expect(legalCells(opening, where)).not.toContain(STAIR);
      expect(legalCells(opening, where)).not.toContain(LANDING);
    }
  });

  it('never offers a cell that already holds a placement (§7.3)', () => {
    const indoor = opening.hand.find(
      (id) => deck.find((plan) => plan.id === id)?.where === 'house',
    );
    if (indoor === undefined) throw new Error('no indoor plan in the opening hand');

    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId: indoor });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'GD2' });

    expect(placed.placements).toHaveLength(1);
    expect(legalCells(placed, 'house')).not.toContain('GD2');
  });

  it('grows as the house grows', () => {
    const indoor = opening.hand.find(
      (id) => deck.find((plan) => plan.id === id)?.where === 'house',
    );
    if (indoor === undefined) throw new Error('no indoor plan in the opening hand');

    expect(legalCells(opening, 'house')).not.toContain('GE2');
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId: indoor });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'GD2' });
    expect(legalCells(placed, 'house')).toContain('GE2');
  });

  /**
   * §5 — the risk zoning introduces is a hand nobody can play. It cannot happen,
   * and this is the reason: demolishing a room replaces it with the placement
   * that demolished it, so the cells the old house stands on are occupied for
   * the whole game whatever the player does. Both zones therefore always touch
   * something, and both always have somewhere left to build.
   */
  it('offers an upstairs plan only the first floor, and only over a room (§5)', () => {
    // FC1 sits over the front door and FB2 over the old kitchen; both touch the
    // landing. Everything else upstairs has nothing under it yet.
    expect(legalCells(opening, 'upstairs')).toEqual(['FC1', 'FB2']);
  });

  it('offers a roof plan the top of the old house, from round one (§5)', () => {
    // The house the player inherited already has a roof, so a rooflight over
    // the old kitchen is playable before anything at all has been built. This
    // is also why a roof hand can never be unplaceable.
    expect(legalCells(opening, 'roof')).toEqual([
      'RB1',
      'RC1',
      'RB2',
      'RC2',
      'RB3',
      'RC3',
    ]);
  });

  it('opens the first floor as the ground floor is built out (§5)', () => {
    // Nothing stands on A1, so there is nothing to sleep above it.
    expect(legalCells(opening, 'upstairs')).not.toContain('FA1');

    const built = put(opening, 'kitchen', 'GA1');
    expect(legalCells(built, 'upstairs')).toContain('FA1');
  });

  /**
   * §7.3 — the one genuinely new irreversible move. Roofing a column and row
   * seals the first floor beneath it: you roofed it, so you cannot build up
   * there now. The rules card has to say so, because it cannot be undone.
   */
  it('takes the first-floor cell out of play once it is roofed (§7.3)', () => {
    expect(legalCells(opening, 'upstairs')).toContain('FB2');

    const roofed = put(opening, 'solar-array', 'RB2');
    expect(legalCells(roofed, 'upstairs')).not.toContain('FB2');
    // …and only that one. The rest of the first floor is untouched.
    expect(legalCells(roofed, 'upstairs')).toContain('FC1');
  });

  it('never leaves either half of the ground floor without a frontier', () => {
    let state = opening;

    // Take the whole old house down, one room at a time.
    for (const room of FABRIC) {
      const planId = state.hand.find(
        (id) => deck.find((plan) => plan.id === id)?.where === 'house',
      );
      if (planId === undefined) throw new Error('no indoor plan to demolish with');

      state = game.reducer(state, { type: 'SELECT_PLAN', planId });
      state = game.reducer(state, { type: 'PLACE', cell: room });
      state = game.reducer(state, { type: 'CONFIRM_DEMOLITION' });
      if (state.observation !== null) state = game.reducer(state, { type: 'DISMISS' });

      expect(state.fabric).not.toContain(room);
      expect(legalCells(state, 'house').length).toBeGreaterThan(0);
      expect(legalCells(state, 'garden').length).toBeGreaterThan(0);
    }
  });
});
