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
 * built. At the default ten rounds this is exactly the GDD's table with the roof
 * on the end: 1–2 threshold, 3–4 daily, 5–6 private, 7–8 outside, 9–10 roof.
 *
 * It is written proportionally rather than as a lookup because §6 leaves the
 * round count open. That is what let the roof tier arrive without touching this
 * function: five tiers over ten rounds lands two apiece, exactly as four over
 * eight did. At eight rounds it still covers all five — 1–2 threshold, 3–4
 * daily, 5 private, 6–7 outside, 8 roof — and at six, one apiece.
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
 *
 * The third card will not take a later tier's last two, though. See `seedCorn`.
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

  // Whatever is left of both piles is fair game for the remaining card(s) —
  // except a tier's last two, which belong to the rounds that tier is for.
  const remainder = [...fromTier, ...rest];
  const reserved = seedCorn(byId, remainder, round, rounds);
  const spare = remainder.filter((id) => !reserved.has(id));

  while (hand.length < HAND_SIZE) {
    // Never deal short to protect the staging: if reserving has emptied the
    // spare pile, the reserve is spent rather than the hand cut to two.
    const from = spare.length > 0 ? spare : remainder;
    const drawn = takeRandom(from, rng);
    if (drawn === undefined) break;
    hand.push(drawn);
    if (from === remainder) {
      const index = spare.indexOf(drawn);
      if (index >= 0) spare.splice(index, 1);
    }
  }

  return shuffle(hand, rng);
}

/**
 * §6 — the plans a later round is going to need, and this one may not spend.
 *
 * The third card comes from any tier, which is what stops the game feeling
 * on-rails. Left unchecked it also eats the tiers it has not reached yet: the
 * last tier in the order is exposed to every round before it, and with the roof
 * tier added, 10 games in 400 reached round 10 with a single roof plan left to
 * deal. §6 promises two from the round's tier, and that promise was being kept
 * by luck rather than by the draw.
 *
 * So a tier still to come keeps its last `TIER_CARDS`. Only its last: this is a
 * floor under the staging, not a rule that hoards a tier until its turn, and a
 * roof plan can still turn up in round two where it is tempting and awkward.
 */
function seedCorn(
  byId: Map<Plan['id'], PlanIdentity>,
  remainder: readonly Plan['id'][],
  round: number,
  rounds: number,
): Set<Plan['id']> {
  /** How many rounds after this one each tier still has to fill. */
  const toCome = new Map<Tier, number>();
  for (let later = round + 1; later <= rounds; later++) {
    const tier = tierForRound(later, rounds);
    toCome.set(tier, (toCome.get(tier) ?? 0) + 1);
  }

  const left = new Map<Tier, Plan['id'][]>();
  for (const id of remainder) {
    const tier = byId.get(id)?.tier as Tier | undefined;
    if (tier === undefined || !toCome.has(tier)) continue;
    const already = left.get(tier) ?? [];
    already.push(id);
    left.set(tier, already);
  }

  const reserved = new Set<Plan['id']>();
  for (const [tier, ids] of left) {
    // Each of those rounds deals `TIER_CARDS`, and each one but the last also
    // takes a card out of the pool for good when the player places it. Two
    // rounds of a tier therefore need three cards, not two — which is exactly
    // the card the roof tier was a round short of.
    const needed = TIER_CARDS + ((toCome.get(tier) as number) - 1);
    if (ids.length <= needed) for (const id of ids) reserved.add(id);
  }
  return reserved;
}
