/**
 * The deck and the draw — GDD §6.
 *
 * Each round the player is dealt three plans: two from the current tier, one
 * from any tier. The hand is not kept — a fresh three are drawn each round, and
 * a plan passed over comes back to the pool. Only a plan the player actually
 * places leaves it.
 */
import { TIERS, type Plan, type PlanIdentity, type Tier } from '../types.ts';
import type { Rng } from './rng.ts';

export const HAND_SIZE = 3;

/** How many of the three come from the current tier — §6. */
export const TIER_CARDS = 2;

/**
 * §6 — the deck is staged, so the house is built roughly in the order a house is
 * built. At the default eight rounds this is exactly the GDD's table: rounds 1–2
 * threshold, 3–4 daily, 5–6 private, 7–8 outside.
 *
 * It is written proportionally rather than as a lookup because §6 leaves the
 * round count open and asks for 6 to be playtested against 8. At six rounds the
 * split lands as threshold, threshold, daily, private, private, outside — which
 * is part of what that playtest is for.
 */
export function tierForRound(round: number, rounds: number): Tier {
  const index = Math.floor(((round - 1) * TIERS.length) / rounds);
  const clamped = Math.min(Math.max(index, 0), TIERS.length - 1);
  return TIERS[clamped] as Tier;
}

/** Remove one item at random and return it. Mutates `from`. */
function takeRandom<T>(from: T[], rng: Rng): T | undefined {
  if (from.length === 0) return undefined;
  const index = Math.floor(rng() * from.length);
  return from.splice(index, 1)[0];
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/**
 * Deal a hand of three from the plans still in the pool.
 *
 * Two are taken from the round's tier and one from anything left, including the
 * wildcard pool — §6's design note: the wildcard is what stops the game feeling
 * on-rails, and it is how a heat pump or the garden turns up early, where it is
 * tempting and awkward.
 *
 * The three are shuffled before being returned so the wildcard is not always the
 * card on the right. Note that the third card may itself be from the current
 * tier: "one from any tier" means any.
 *
 * If a tier is ever too thin to supply two — which cannot happen with the deck as
 * written, and is checked by `npm run validate` — the hand is topped up from the
 * rest of the pool rather than dealt short.
 */
export function drawHand(
  deck: readonly PlanIdentity[],
  pool: readonly Plan['id'][],
  round: number,
  rounds: number,
  rng: Rng,
): Plan['id'][] {
  const tier = tierForRound(round, rounds);
  const byId = new Map(deck.map((plan) => [plan.id, plan]));

  const available = pool.filter((id) => byId.has(id));
  const fromTier = available.filter((id) => byId.get(id)?.tier === tier);
  const rest = available.filter((id) => byId.get(id)?.tier !== tier);

  const hand: Plan['id'][] = [];

  for (let i = 0; i < TIER_CARDS; i++) {
    const drawn = takeRandom(fromTier, rng);
    if (drawn !== undefined) hand.push(drawn);
  }

  // Whatever is left of both piles is fair game for the remaining card(s).
  const remainder = [...fromTier, ...rest];
  while (hand.length < HAND_SIZE) {
    const drawn = takeRandom(remainder, rng);
    if (drawn === undefined) break;
    hand.push(drawn);
  }

  return shuffle(hand, rng);
}
