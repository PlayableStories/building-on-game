import { describe, expect, it } from 'vitest';
import { config, deck, household, premise, whyNow } from '../content.ts';
import { createGame } from './game.ts';

const game = createGame(deck, config);

describe('the framing (§2)', () => {
  it('opens on the intro, before any placement is possible', () => {
    const state = game.initialState(1);
    expect(state.phase).toBe('intro');
    expect(state.placements).toEqual([]);
  });

  it('has the first hand already dealt, so beginning goes straight into round 1', () => {
    const state = game.initialState(1);
    expect(state.hand).toHaveLength(3);
    expect(state.round).toBe(1);
  });

  it('refuses to place anything while the framing is up', () => {
    const state = game.initialState(1);
    const planId = state.hand[0] as string;
    const selected = game.reducer(state, { type: 'SELECT_PLAN', planId });
    expect(selected.selectedPlanId).toBeNull();
    expect(game.reducer(selected, { type: 'PLACE', cell: 'C1' })).toBe(selected);
  });

  it('begins on dismissal, keeping the hand it had already dealt', () => {
    const state = game.initialState(1);
    const begun = game.reducer(state, { type: 'BEGIN' });
    expect(begun.phase).toBe('play');
    expect(begun.hand).toEqual(state.hand);
  });

  it('is shown once and never returned to (§2)', () => {
    const begun = game.reducer(game.initialState(1), { type: 'BEGIN' });
    // Nothing during play can put the framing back up.
    expect(game.reducer(begun, { type: 'BEGIN' })).toBe(begun);
  });
});

describe('the household as content (§2, §16)', () => {
  it('is two or three people, one line each', () => {
    expect(household.length).toBeGreaterThanOrEqual(2);
    expect(household.length).toBeLessThanOrEqual(3);
    for (const person of household) {
      expect(person.name.length).toBeGreaterThan(0);
      expect(person.line.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids, so the report can address each person once', () => {
    const ids = household.map((person) => person.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says why the work is happening at all', () => {
    expect(premise.length).toBeGreaterThan(0);
    expect(whyNow.length).toBeGreaterThan(0);
  });
});
