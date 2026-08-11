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
  it('reproduces the GDD table, with the roof on the end, at ten rounds', () => {
    const tiers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((round) =>
      tierForRound(round, 10),
    );
    expect(tiers).toEqual([
      'threshold',
      'threshold',
      'daily',
      'daily',
      'private',
      'private',
      'outside',
      'outside',
      'roof',
      'roof',
    ]);
  });

  /**
   * §6 leaves the round count open, and being proportional is what let the roof
   * tier arrive without touching `tierForRound` at all. The two counts that were
   * playtested still cover every tier — eight simply gives one of them a single
   * round instead of two.
   */
  it('still covers every tier at eight rounds and at six', () => {
    for (const rounds of [8, 6]) {
      const tiers = Array.from({ length: rounds }, (_, i) =>
        tierForRound(i + 1, rounds),
      );
      expect(new Set(tiers)).toEqual(new Set(TIERS));
    }
  });
});

/**
 * §6 — a tier still to come keeps enough cards for the rounds it has left.
 *
 * The third card of a hand comes from any tier, which is what stops the game
 * feeling on-rails and is also what nearly broke the roof tier: it is last in
 * the order, so every one of the nine rounds before it can take a card off it.
 * Ten games in four hundred reached round 10 with a single roof plan to deal.
 */
describe('the staging floor (§6)', () => {
  const roof = deck.filter((plan) => plan.tier === 'roof').map((plan) => plan.id);

  it('will not spend a later tier down past what its rounds need', () => {
    // Three roof plans left, and two rounds of roof still to come. Those two
    // rounds need two cards each and one of them will be placed in between, so
    // all three are spoken for and round 1 may not have any of them.
    const pool = [...deck.filter((plan) => plan.tier !== 'roof').map((p) => p.id), ...roof.slice(0, 3)];
    for (let seed = 1; seed <= 200; seed++) {
      const hand = drawHand(deck, pool, 1, 10, createRng(seed));
      expect(hand.filter((id) => roof.includes(id))).toEqual([]);
    }
  });

  it('still lets one turn up early while the tier can spare it', () => {
    // The whole deck, so the roof has five and can spare two. If reserving had
    // become hoarding, this would never fire.
    let early = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const hand = drawHand(deck, allIds, 1, 10, createRng(seed));
      if (hand.some((id) => roof.includes(id))) early++;
    }
    expect(early).toBeGreaterThan(0);
  });

  it('deals three rather than protecting the reserve, if it ever comes to that', () => {
    // A pool of nothing but a reserved tier. The floor is a preference, and the
    // hand still has to be a hand.
    const hand = drawHand(deck, roof, 1, 10, createRng(7));
    expect(hand).toHaveLength(HAND_SIZE);
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
