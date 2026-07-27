import { describe, expect, it } from 'vitest';
import { config, deck } from '../content.ts';
import { TIERS } from '../types.ts';
import { drawHand, HAND_SIZE, TIER_CARDS, tierForRound } from './deck.ts';
import { createRng } from './rng.ts';

const allIds = deck.map((plan) => plan.id);
const byId = new Map(deck.map((plan) => [plan.id, plan]));

describe('the deck (§8.1)', () => {
  it('has no duplicate ids', () => {
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('has enough in every tier to fill a hand, so a draw can never come up short', () => {
    for (const tier of TIERS) {
      const count = deck.filter((plan) => plan.tier === tier).length;
      expect(count).toBeGreaterThanOrEqual(HAND_SIZE);
    }
  });
});

describe('tierForRound (§6)', () => {
  it('reproduces the GDD table at eight rounds', () => {
    const tiers = [1, 2, 3, 4, 5, 6, 7, 8].map((round) => tierForRound(round, 8));
    expect(tiers).toEqual([
      'threshold',
      'threshold',
      'daily',
      'daily',
      'private',
      'private',
      'outside',
      'outside',
    ]);
  });

  it('still covers all four tiers at six rounds, the §6 [Open] alternative', () => {
    const tiers = [1, 2, 3, 4, 5, 6].map((round) => tierForRound(round, 6));
    expect(new Set(tiers)).toEqual(new Set(TIERS));
  });
});

describe('drawHand (§6)', () => {
  it('deals three, with at least two from the tier for that round', () => {
    // Every seed, every round — the rule holds or the draw is wrong.
    for (let seed = 1; seed <= 200; seed++) {
      for (let round = 1; round <= config.rounds; round++) {
        const hand = drawHand(deck, allIds, round, config.rounds, createRng(seed));
        expect(hand).toHaveLength(HAND_SIZE);

        const tier = tierForRound(round, config.rounds);
        const fromTier = hand.filter((id) => byId.get(id)?.tier === tier).length;
        expect(fromTier).toBeGreaterThanOrEqual(TIER_CARDS);
      }
    }
  });

  it('never deals the same plan twice in one hand', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const hand = drawHand(deck, allIds, 3, config.rounds, createRng(seed));
      expect(new Set(hand).size).toBe(hand.length);
    }
  });

  it('only ever deals what is still in the pool', () => {
    const pool = allIds.filter((id) => byId.get(id)?.tier !== 'wildcard');
    for (let seed = 1; seed <= 100; seed++) {
      const hand = drawHand(deck, pool, 5, config.rounds, createRng(seed));
      for (const id of hand) expect(pool).toContain(id);
    }
  });

  it('lets a wildcard turn up in any round (§6)', () => {
    // The point of the third card: systems and the garden can arrive early,
    // where they are tempting and awkward.
    const seenEarly = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const id of drawHand(deck, allIds, 1, config.rounds, createRng(seed))) {
        if (byId.get(id)?.tier === 'wildcard') seenEarly.add(id);
      }
    }
    expect(seenEarly.size).toBeGreaterThan(0);
  });

  it('is reproducible from a seed', () => {
    const a = drawHand(deck, allIds, 4, config.rounds, createRng(99));
    const b = drawHand(deck, allIds, 4, config.rounds, createRng(99));
    expect(a).toEqual(b);
  });
});
