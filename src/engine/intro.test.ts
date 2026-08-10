import { describe, expect, it } from 'vitest';
import {
  causeWords,
  config,
  deck,
  pairLines,
  plot,
  premise,
  qualityLines,
  qualitySeverity,
  rules,
  situations,
  whyNow,
} from '../content.ts';
import { createGame } from './game.ts';

const game = createGame(
  deck,
  config,
  { pairLines, qualityLines, qualitySeverity, causeWords },
  plot,
  situations.map((situation) => situation.id),
);

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
    expect(game.reducer(selected, { type: 'PLACE', cell: 'GC1' })).toBe(selected);
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

describe('the situation (§2)', () => {
  it('draws exactly one, and it is one of the six', () => {
    const state = game.initialState(1);
    expect(situations.map((situation) => situation.id)).toContain(state.situationId);
  });

  it('is the same for the same seed, so a game is reproducible from one number', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(game.initialState(seed).situationId).toBe(
        game.initialState(seed).situationId,
      );
    }
  });

  it('is not the same one every time', () => {
    // §2's whole argument for replacing the fixed household: if the draw were
    // stuck, this would be the old three-people problem with fewer people.
    const drawn = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      drawn.add(game.initialState(seed).situationId);
    }
    expect(drawn.size).toBe(situations.length);
  });

  it('survives a restart, and is drawn again from the new seed', () => {
    const first = game.initialState(1);
    const restarted = game.reducer(first, { type: 'RESTART', seed: 99 });
    expect(restarted.situationId).toBe(game.initialState(99).situationId);
  });
});

describe('the framing and the rules as content (§2, §13, §16)', () => {
  it('gives every situation an id and a line', () => {
    expect(situations.length).toBeGreaterThanOrEqual(2);
    for (const situation of situations) {
      expect(situation.id.length).toBeGreaterThan(0);
      expect(situation.line.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate situation ids, or the draw could not name one', () => {
    const ids = situations.map((situation) => situation.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says why the work is happening at all', () => {
    expect(premise.length).toBeGreaterThan(0);
    expect(whyNow.length).toBeGreaterThan(0);
  });

  it('says what the game is, and that the old rooms can go (§13)', () => {
    expect(rules.objective.length).toBeGreaterThan(0);
    expect(rules.points.length).toBeGreaterThan(0);

    // The two things playtesting found a first-time player did not know.
    const all = [rules.objective, ...rules.points].join(' ').toLowerCase();
    expect(all).toMatch(/taken down|take down|demolish/);
    expect(all).toMatch(/no way to lose|no score/);
  });
});
