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
import type {
  Config,
  HouseholdIntro,
  PairLine,
  PlanAdjacency,
  Quality,
  QualityLine,
} from './types.ts';

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
export const deck: PlanAdjacency[] = [
  /* ---- §6 Threshold — rounds 1–2 --------------------------------- */
  {
    id: 'porch',
    name: 'Porch',
    tier: 'threshold',
    emits: ['footfall'],
    sensitive: [],
    orientation: {
      north: 'Facing the street, which is where a door is usually pleased to be.',
      south: 'A front door onto the garden. You will use the other one.',
    },
  },
  {
    id: 'hall',
    name: 'Hall',
    tier: 'threshold',
    emits: ['footfall'],
    sensitive: [],
  },
  {
    // §8.3, worked. The GDD gives `emits: damp, clutter`, but §8.5 fixes the
    // vocabulary at nine and clutter is not one of them. Clutter here is work —
    // its own care line says so: "It only works if you keep it emptied."
    id: 'boot-room',
    name: 'Boot room',
    tier: 'threshold',
    emits: ['damp', 'work'],
    sensitive: [],
  },
  {
    id: 'downstairs-wc',
    name: 'Downstairs WC',
    tier: 'threshold',
    emits: ['smell'],
    sensitive: [],
  },
  {
    id: 'bin-store',
    name: 'Bin store',
    tier: 'threshold',
    emits: ['smell', 'work'],
    sensitive: ['heat'],
  },

  /* ---- §6 Daily — rounds 3–4 ------------------------------------- */
  {
    // §8.3, worked.
    id: 'kitchen',
    name: 'Kitchen',
    tier: 'daily',
    emits: ['heat', 'smell', 'footfall'],
    sensitive: ['damp', 'noise'],
    orientation: {
      south: 'It will be warm in the afternoon, and you will eat there.',
    },
  },
  {
    id: 'living-room',
    name: 'Living room',
    tier: 'daily',
    emits: ['noise', 'footfall', 'shade'],
    sensitive: ['noise'],
    orientation: {
      south: 'Light in the afternoon, and the room everyone drifts into.',
    },
  },
  {
    id: 'dining-room',
    name: 'Dining room',
    tier: 'daily',
    emits: ['footfall', 'shade'],
    sensitive: ['smell'],
  },
  {
    id: 'utility-room',
    name: 'Utility room',
    tier: 'daily',
    emits: ['damp', 'noise', 'heat'],
    sensitive: [],
  },
  {
    // §8.3, worked.
    id: 'glass-extension',
    name: 'Glass-roofed extension',
    tier: 'daily',
    emits: ['light', 'heat', 'shade'],
    sensitive: [],
    orientation: {
      south:
        'Light all afternoon. Unusable in July without shade you haven’t drawn yet.',
      north: 'The light is even and cold. You will heat this room more than any other.',
    },
  },

  /* ---- §6 Private — rounds 5–6 ----------------------------------- */
  {
    id: 'bedroom',
    name: 'Bedroom',
    tier: 'private',
    emits: ['quiet', 'shade'],
    sensitive: ['noise', 'footfall', 'smell', 'light'],
    orientation: {
      north: 'It faces the street. You will hear the mornings before you want them.',
    },
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    tier: 'private',
    emits: ['damp', 'shade'],
    sensitive: ['footfall'],
  },
  {
    // §8.3, worked.
    id: 'study',
    name: 'Study',
    tier: 'private',
    emits: ['quiet', 'shade'],
    sensitive: ['noise', 'footfall', 'smell'],
  },
  {
    id: 'gym',
    name: 'Gym',
    tier: 'private',
    emits: ['noise', 'work', 'shade'],
    sensitive: ['heat'],
  },
  {
    id: 'spare-room',
    name: 'Spare room',
    tier: 'private',
    emits: ['shade'],
    sensitive: ['noise'],
  },

  /* ---- §6 Outside — rounds 7–8 ----------------------------------- */
  {
    id: 'vegetable-garden',
    name: 'Vegetable garden',
    tier: 'outside',
    emits: ['work'],
    sensitive: ['shade'],
    orientation: {
      north: 'The sun is behind it most of the day. Everything will be slow.',
      south: 'Sun from lunchtime onwards. This is where it wants to be.',
    },
  },
  {
    id: 'terrace',
    name: 'Terrace',
    tier: 'outside',
    emits: [],
    sensitive: ['noise', 'smell', 'shade'],
    orientation: {
      north: 'It faces the street. You will sit there less than you imagine.',
      south: 'The afternoon lands here. This is the one you will use.',
    },
  },
  {
    id: 'shed',
    name: 'Shed',
    tier: 'outside',
    emits: ['shade'],
    sensitive: [],
  },
  {
    id: 'lawn',
    name: 'Lawn',
    tier: 'outside',
    emits: ['work'],
    sensitive: ['shade'],
    orientation: {
      north: 'It will be green, and damp, and it will never quite dry out.',
    },
  },
  {
    // §8.3, worked.
    id: 'home-farm',
    name: 'Home farm',
    tier: 'outside',
    emits: ['smell', 'work'],
    sensitive: ['shade'],
    orientation: {
      north: 'Too little sun. It will be a hobby rather than a crop.',
    },
  },

  /* ---- §8.7 Wildcards — any round -------------------------------- */
  {
    // §8.3, worked. The noise is low and constant, which is the whole point.
    id: 'heat-pump',
    name: 'Air-source heat pump',
    tier: 'wildcard',
    emits: ['noise'],
    sensitive: [],
  },
  {
    id: 'solar-array',
    name: 'Solar array',
    tier: 'wildcard',
    emits: [],
    sensitive: ['shade'],
    orientation: {
      // §8.7, verbatim.
      north: 'A lovely gesture. Very little electricity.',
    },
  },
  {
    id: 'wall-insulation',
    name: 'Internal wall insulation',
    tier: 'wildcard',
    emits: ['heat'],
    sensitive: [],
  },
  {
    id: 'air-conditioning',
    name: 'Air conditioning unit',
    tier: 'wildcard',
    emits: ['noise', 'heat'],
    sensitive: [],
  },
];

/* ------------------------------------------------------------------ *
 * What ends up next to what — §8.6, §8.7
 * ------------------------------------------------------------------ */

/**
 * §8.6 step 1 — the best writing in the game, for the handful of pairings that
 * deserve it. Matched in either direction.
 *
 * Two of these are not plan-to-plan. `'*'` means beside anything at all, and
 * `'fabric'` means against the walls of the old house. Both are asked for by
 * name in §8.7.
 *
 * The insulation and solar lines are where preservation and decarbonisation
 * genuinely conflict. The game states what happens and does not editorialise.
 */
export const pairLines: PairLine[] = [
  // §8.7, verbatim.
  {
    a: 'heat-pump',
    b: 'bedroom',
    line: 'Quiet enough now. Less so at five in the morning in January.',
  },
  {
    a: 'heat-pump',
    b: 'terrace',
    line: 'The one place you sit outside is the one place that hums.',
  },
  {
    a: 'air-conditioning',
    b: '*',
    line: 'Cool this summer, and every summer after, at a price that rises.',
  },
  {
    a: 'wall-insulation',
    b: 'fabric',
    line: 'Warmer. And a damp risk you will be managing for a decade.',
  },
  {
    a: 'home-farm',
    b: 'kitchen',
    line: 'A short walk with wet hands. This is the version that gets used.',
  },
  {
    a: 'home-farm',
    b: 'bedroom',
    line: 'Compost, and something starting at six in the morning.',
  },

  // Written for this build, in the same voice.
  {
    a: 'kitchen',
    b: 'bin-store',
    line: 'Convenient in February. Less so in July, with the window open.',
  },
  {
    a: 'bathroom',
    b: 'kitchen',
    line: 'One wall, two rooms, and both of them wanting the same drains.',
  },
  {
    a: 'downstairs-wc',
    b: 'dining-room',
    line: 'A door everyone will pretend not to notice.',
  },
  {
    a: 'vegetable-garden',
    b: 'kitchen',
    line: 'Close enough to cut something while the pan is already hot.',
  },
  {
    a: 'study',
    b: 'hall',
    line: 'The door closes. The house walks past it all day.',
  },
];

/**
 * §8.6 step 2 — the generic line when an emitted quality meets a neighbour
 * sensitive to it. Both directions count: what the new plan does to what is
 * already there, and what is already there does to it.
 */
export const qualityLines: QualityLine[] = [
  {
    quality: 'noise',
    line: 'It carries through the wall. Not constantly — just at the wrong times.',
  },
  {
    quality: 'smell',
    line: 'You will know what was cooked, and for how long, some hours later.',
  },
  {
    quality: 'damp',
    line: 'Warm air meeting a cold wall. Someone will be wiping it down by March.',
  },
  {
    quality: 'heat',
    line: 'That side of the house runs warm. Welcome in February, less so in August.',
  },
  {
    quality: 'light',
    line: 'It gets the light, which is not always what you want from that room.',
  },
  {
    quality: 'footfall',
    line: 'People pass through. It is not a room anyone closes a door on.',
  },
  {
    quality: 'shade',
    line: 'It sits in the shadow of the building for half the day.',
  },
];

/**
 * §8.6 — strongest first. When several quality matches fire on one placement,
 * this decides which one is worth saying, and the other lines stay silent.
 *
 * The order is a judgement about what a household actually notices. Noise and
 * smell are the things people complain about; light and footfall are the things
 * they adjust to. Reorder this and the game emphasises something else, without
 * a line of engine code changing.
 */
export const qualitySeverity: Quality[] = [
  'noise',
  'smell',
  'damp',
  'shade',
  'heat',
  'light',
  'footfall',
  'work',
  'quiet',
];
