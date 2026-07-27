/**
 * Building On — content.
 *
 * Fork surface 1 of 2 (GDD §16). Everything a participant would change lives
 * here: the household, the "why now" line, the deck, every adjacency line, the
 * consent flags, the report copy and the closing lines. The engine in
 * `src/engine/` never imports this file — it is handed what it needs as an
 * argument — so the whole game can be re-pointed at a community centre, a co-op
 * office, a high street or a hospice garden without opening engine code.
 *
 * M1 holds the config and the deck's identities. The writing arrives with the
 * milestones that use it: the household and the why-now line in M2, the
 * adjacency lines in M3, the report copy in M4, the consent flags in M5.
 */
import type { Config, HouseholdIntro, PlanIdentity } from './types.ts';

export const config: Config = {
  /**
   * §6 [Open] — eight gives two placements per tier, which is where adjacency
   * starts firing often enough to be the point. Six was the original figure.
   * Change this one number to playtest the other.
   */
  rounds: 8,

  /** §9.2 — one flag that changes the character of the whole game. Lands in M5. */
  conservation: false,
};

/* ------------------------------------------------------------------ *
 * The framing — §2
 * ------------------------------------------------------------------ */

/** §2 — the whole premise, in five words. */
export const premise = 'Someone left you a house.';

/**
 * §2 — one line, shown at the start, explaining why the work is happening at
 * all. It justifies the eight rounds, the fixed front door and the existing
 * fabric in a single sentence: the player is not building a dream house, they
 * are responding to something.
 */
export const whyNow = 'The roof failed in February. You can’t put it off any longer.';

/**
 * §2 [Open] — alternatives to test. Each changes what the player prioritises
 * without changing a rule. Swap one in above and play it twice.
 *
 *   'Your mother is moving in next spring.'
 *   'You both work from home now, and there is one desk.'
 *   'The lease on the flat ends in August.'
 */

/**
 * §2 — who this house is for. Two or three people, one sentence each.
 *
 * The household is never scored and never mentioned again during play. It comes
 * back only in the report (§10.4), where each person says one line about the
 * finished house. That is the motivation the game needs and the only one it can
 * afford: the player now has someone to satisfy, and the game never measures
 * whether they did.
 *
 * It is also the cleanest replay driver in the design. Same deck, different
 * household, entirely different house — so this is the first thing to change
 * when forking (§16, rung 1).
 */
export const household: HouseholdIntro[] = [
  {
    id: 'you',
    name: 'You',
    line: 'You work from home three days a week and have never had a door to close.',
  },
  {
    id: 'daughter',
    name: 'Your daughter, 14',
    line: 'She plays drums. She has been promised this will be better than the flat.',
  },
  {
    id: 'mother',
    name: 'Your mother',
    line: 'Moving in next spring. She manages one flight of stairs on a good day.',
  },
];

/**
 * The deck — §8.1, §8.3, §8.4.
 *
 * Twenty-four plans: five in each of the four tiers, plus four wildcards that
 * can turn up in any round. §8.1 asks for "16–18", but the document names these
 * twenty-four across §6's tier table and §8.4's stub list, and five per tier is
 * what keeps every tier able to fill a hand. Noted rather than trimmed.
 *
 * §8.7 — the systems are ordinary plans in the wildcard pool, not a second card
 * type attached to the house. A heat pump needs somewhere to stand, and it makes
 * noise.
 */
export const deck: PlanIdentity[] = [
  // §6 Threshold — rounds 1–2
  { id: 'porch', name: 'Porch', tier: 'threshold' },
  { id: 'hall', name: 'Hall', tier: 'threshold' },
  { id: 'boot-room', name: 'Boot room', tier: 'threshold' },
  { id: 'downstairs-wc', name: 'Downstairs WC', tier: 'threshold' },
  { id: 'bin-store', name: 'Bin store', tier: 'threshold' },

  // §6 Daily — rounds 3–4
  { id: 'kitchen', name: 'Kitchen', tier: 'daily' },
  { id: 'living-room', name: 'Living room', tier: 'daily' },
  { id: 'dining-room', name: 'Dining room', tier: 'daily' },
  { id: 'utility-room', name: 'Utility room', tier: 'daily' },
  { id: 'glass-extension', name: 'Glass-roofed extension', tier: 'daily' },

  // §6 Private — rounds 5–6
  { id: 'bedroom', name: 'Bedroom', tier: 'private' },
  { id: 'bathroom', name: 'Bathroom', tier: 'private' },
  { id: 'study', name: 'Study', tier: 'private' },
  { id: 'gym', name: 'Gym', tier: 'private' },
  { id: 'spare-room', name: 'Spare room', tier: 'private' },

  // §6 Outside — rounds 7–8
  { id: 'vegetable-garden', name: 'Vegetable garden', tier: 'outside' },
  { id: 'terrace', name: 'Terrace', tier: 'outside' },
  { id: 'shed', name: 'Shed', tier: 'outside' },
  { id: 'lawn', name: 'Lawn', tier: 'outside' },
  { id: 'home-farm', name: 'Home farm', tier: 'outside' },

  // §8.7 Wildcards — any round
  { id: 'heat-pump', name: 'Air-source heat pump', tier: 'wildcard' },
  { id: 'solar-array', name: 'Solar array', tier: 'wildcard' },
  { id: 'wall-insulation', name: 'Internal wall insulation', tier: 'wildcard' },
  { id: 'air-conditioning', name: 'Air conditioning unit', tier: 'wildcard' },
];
