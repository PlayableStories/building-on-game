import { describe, expect, it } from 'vitest';
import { config, deck } from '../content.ts';
import type { GameState } from '../types.ts';
import { tierForRound } from './deck.ts';
import { createGame } from './game.ts';
import { legalCells } from './grid.ts';

const game = createGame(deck, config);
const byId = new Map(deck.map((plan) => [plan.id, plan]));

/** Play a whole game, always taking the first plan and the first legal cell. */
function playThrough(seed: number): { final: GameState; steps: GameState[] } {
  const steps: GameState[] = [];
  let state = game.initialState(seed);

  while (state.phase === 'play') {
    steps.push(state);
    const planId = state.hand[0];
    if (planId === undefined) throw new Error('dealt an empty hand');
    const selected = game.reducer(state, { type: 'SELECT_PLAN', planId });
    const cell = legalCells(selected)[0];
    if (cell === undefined) throw new Error('no legal cell');
    state = game.reducer(selected, { type: 'PLACE', cell });
  }

  return { final: state, steps };
}

describe('the core loop (§6, §15)', () => {
  it('ends after exactly the configured number of placements', () => {
    const { final } = playThrough(7);
    expect(final.placements).toHaveLength(config.rounds);
    expect(final.phase).toBe('report');
  });

  it('never runs out of legal cells across many seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(playThrough(seed).final.placements).toHaveLength(config.rounds);
    }
  });

  it('deals a fresh hand every round, weighted to the tier (§6)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const state of playThrough(seed).steps) {
        expect(state.hand).toHaveLength(3);
        const tier = tierForRound(state.round, config.rounds);
        const fromTier = state.hand.filter((id) => byId.get(id)?.tier === tier);
        expect(fromTier.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('never deals a plan again once it has been placed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const placed = new Set<string>();
      for (const state of playThrough(seed).steps) {
        for (const id of state.hand) expect(placed.has(id)).toBe(false);
        const justPlaced = state.hand[0];
        if (justPlaced !== undefined) placed.add(justPlaced);
      }
    }
  });

  it('returns a passed-over plan to the pool — only what is placed is gone (§6)', () => {
    const opening = game.initialState(11);
    const kept = opening.hand[0] as string;
    const passedOver = opening.hand[1] as string;

    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId: kept });
    const next = game.reducer(selected, { type: 'PLACE', cell: 'C1' });

    expect(next.pool).not.toContain(kept);
    expect(next.pool).toContain(passedOver);
  });
});

describe('selection', () => {
  it('clears after a placement', () => {
    const opening = game.initialState(3);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    expect(selected.selectedPlanId).toBe(planId);

    const placed = game.reducer(selected, { type: 'PLACE', cell: 'C1' });
    expect(placed.selectedPlanId).toBeNull();
  });

  it('toggles off when the same plan is clicked twice', () => {
    const opening = game.initialState(3);
    const planId = opening.hand[0] as string;
    const once = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const twice = game.reducer(once, { type: 'SELECT_PLAN', planId });
    expect(twice.selectedPlanId).toBeNull();
  });

  it('ignores a plan that is not in the hand', () => {
    const opening = game.initialState(3);
    const notDealt = deck.find((plan) => !opening.hand.includes(plan.id));
    const after = game.reducer(opening, {
      type: 'SELECT_PLAN',
      planId: notDealt?.id ?? 'nonsense',
    });
    expect(after.selectedPlanId).toBeNull();
  });
});

describe('placement (§7)', () => {
  it('does nothing without a selected plan', () => {
    const opening = game.initialState(5);
    expect(game.reducer(opening, { type: 'PLACE', cell: 'C1' })).toBe(opening);
  });

  it('refuses an illegal cell', () => {
    const opening = game.initialState(5);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    // E5 is the far corner — nothing touches it at the opening.
    expect(game.reducer(selected, { type: 'PLACE', cell: 'E5' })).toBe(selected);
  });

  it('records a placement onto fabric as a demolition (§7.2)', () => {
    const opening = game.initialState(5);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'C3' });

    expect(placed.placements[0]?.demolished).toBe(true);
    expect(placed.fabric).not.toContain('C3');
  });

  it('removes the front door when B2 is demolished (§7)', () => {
    const opening = game.initialState(5);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'B2' });

    expect(placed.frontDoor).toBeNull();
  });

  it('leaves the front door alone otherwise', () => {
    const opening = game.initialState(5);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'C1' });

    expect(placed.frontDoor).toBe('B2');
    expect(placed.placements[0]?.demolished).toBe(false);
  });
});

describe('restart (§15)', () => {
  it('puts the plot back to the house that was inherited', () => {
    const { final } = playThrough(2);
    const again = game.reducer(final, { type: 'RESTART', seed: 4 });

    expect(again.phase).toBe('play');
    expect(again.round).toBe(1);
    expect(again.placements).toEqual([]);
    expect(again.fabric).toEqual(['B2', 'C2', 'B3', 'C3']);
    expect(again.frontDoor).toBe('B2');
    expect(again.pool).toHaveLength(deck.length);
  });
});
