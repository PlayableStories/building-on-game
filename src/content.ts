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
  ClosingLine,
  Config,
  ConservationOverrides,
  Consent,
  HouseholdMember,
  PairLine,
  Plan,
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
export const household: HouseholdMember[] = [
  {
    id: 'you',
    name: 'You',
    line: 'You work from home three days a week and have never had a door to close.',

    /**
     * §10.4 — you, on whether you got the door you can close. A study is the
     * plan that was actually promised; a spare room is the compromise everyone
     * makes and nobody admits to.
     */
    reaction: (house) => {
      if (house.has('study')) {
        const near = house.distance('study', 'kitchen');
        if (near !== null && near <= 1) {
          return 'You have your door. It opens onto the kitchen, so you will hear every kettle, but it closes.';
        }
        return 'You have the door. Three days a week, you will shut it and nobody will think anything of it.';
      }
      if (house.has('spare-room')) {
        return 'No study. You will work in the spare room, and it will be a spare room again whenever anyone visits.';
      }
      return 'You still have no door to close. You will work at the table, as you always have, and mind it more now.';
    },
  },
  {
    id: 'daughter',
    name: 'Your daughter, 14',
    line: 'She plays drums. She has been promised this will be better than the flat.',

    /**
     * §10.4 — the drummer, on where her room ended up relative to everyone
     * else's. Distance is the whole reaction: the further the bedroom sits from
     * where people sit, the longer she gets to play.
     */
    reaction: (house) => {
      if (!house.has('bedroom')) {
        return 'There is no room that is hers. She has not said anything about it yet.';
      }
      const toLiving = house.distance('bedroom', 'living-room');
      const toStudy = house.distance('bedroom', 'study');
      const nearest = [toLiving, toStudy].filter((steps): steps is number => steps !== null);
      if (nearest.length === 0) {
        return 'Her room is off on its own. She has worked out that nobody can hear her from there, and she is right.';
      }
      const closest = Math.min(...nearest);
      if (closest <= 1) {
        return 'Her room shares a wall with where everyone sits. She has done the arithmetic on that already.';
      }
      if (closest === 2) {
        return 'Her room is far enough that it will be about volume rather than about whether at all.';
      }
      return 'Her room is at the other end of the house. She has stopped asking what time she has to stop.';
    },
  },
  {
    id: 'mother',
    name: 'Your mother',
    line: 'Moving in next spring. She manages one flight of stairs on a good day.',

    /**
     * §10.4 — your mother, on the distance from the front door to the bathroom.
     * If B2 came down there is no front door to measure from, and that is its
     * own answer (§7).
     */
    reaction: (house) => {
      const wc = house.has('downstairs-wc');
      if (house.frontDoor === null) {
        return wc
          ? 'She cannot see where the front door went, but there is a WC on this floor, and that is the part she asked about.'
          : 'She asked where the front door is. Nobody has answered her yet.';
      }
      const steps = house.fromFrontDoor('bathroom');
      if (steps === null) {
        return wc
          ? 'No bathroom, but there is a WC by the door. She says that will do for now, in the voice she uses.'
          : 'She has not mentioned the bathroom. She has noticed there isn’t one.';
      }
      if (steps <= 2) {
        return 'From the front door to the bathroom is a few steps. She will not have to plan the journey.';
      }
      if (wc) {
        return 'The bathroom is right across the house. The WC by the door is what she will actually use.';
      }
      return 'The bathroom is a long way from the front door. She has counted, and she will count again every time.';
    },
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
export const deck: Plan[] = [
  /* ---- §6 Threshold — rounds 1–2 --------------------------------- */
  {
    id: 'porch',
    name: 'Porch',
    tier: 'threshold',
    consent: 'permitted',
    have: 'Somewhere to stand while you find your keys, out of the rain.',
    cost: 'low',
    care: 'Gutters, a light that keeps failing, and a step that collects leaves.',
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
    consent: 'householder',
    have: 'A place to arrive, rather than walking straight into a room.',
    cost: 'moderate',
    care: 'The floor takes everything the outside brings in. It goes first.',
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
    consent: 'householder',
    have: 'Wet coats and muddy boots stop at the door.',
    cost: 'low',
    care: 'It only works if you keep it emptied. Most people don’t.',
    emits: ['damp', 'work'],
    sensitive: [],
  },
  {
    id: 'downstairs-wc',
    name: 'Downstairs WC',
    tier: 'threshold',
    consent: 'householder',
    have: 'Nobody has to go upstairs, which matters more than it sounds.',
    cost: 'moderate',
    care: 'A macerator or a long drain run. Whichever it is, it will block.',
    emits: ['smell'],
    sensitive: [],
  },
  {
    id: 'bin-store',
    name: 'Bin store',
    tier: 'threshold',
    consent: 'permitted',
    have: 'The bins are somewhere, rather than beside the back door.',
    cost: 'very-low',
    care: 'Rinsing it out, and a lid that stops closing by the second winter.',
    emits: ['smell', 'work'],
    sensitive: ['heat'],
  },

  /* ---- §6 Daily — rounds 3–4 ------------------------------------- */
  {
    // §8.3, worked.
    id: 'kitchen',
    name: 'Kitchen',
    tier: 'daily',
    consent: 'householder',
    have: 'The room everyone ends up in, whatever you intended.',
    cost: 'high',
    care: 'Extraction, drains, and the slow replacement of everything in it.',
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
    consent: 'householder',
    have: 'Somewhere to sit that is not the kitchen.',
    cost: 'moderate',
    care: 'The room you will redecorate, and the room you will argue about redecorating.',
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
    consent: 'householder',
    have: 'A table that stays laid, and meals that take longer.',
    cost: 'moderate',
    care: 'Used twice a week, heated seven days. You will notice that eventually.',
    emits: ['footfall', 'shade'],
    sensitive: ['smell'],
  },
  {
    id: 'utility-room',
    name: 'Utility room',
    tier: 'daily',
    consent: 'householder',
    have: 'The washing happens somewhere that is not the kitchen.',
    cost: 'moderate',
    care: 'Plumbing, a floor that has to survive a leak, and a door kept shut.',
    emits: ['damp', 'noise', 'heat'],
    sensitive: [],
  },
  {
    // §8.3, worked.
    id: 'glass-extension',
    name: 'Glass-roofed extension',
    tier: 'daily',
    consent: 'sensitive',
    have: 'A bright room that changes with the weather.',
    cost: 'high',
    care: 'Glass to clean, blinds to fit, and a room that is never quite the right temperature.',
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
    consent: 'householder',
    have: 'A room with a door, and a window you decide about.',
    cost: 'moderate',
    care: 'Nothing at all, for years. Then the window, the corner, and the floor.',
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
    consent: 'householder',
    have: 'A bath, and somewhere to be alone at seven in the morning.',
    cost: 'high',
    care: 'Sealant, extraction, and tiles that outlast the taste for them by twenty years.',
    emits: ['damp', 'shade'],
    sensitive: ['footfall'],
  },
  {
    // §8.3, worked.
    id: 'study',
    name: 'Study',
    tier: 'private',
    consent: 'permitted',
    have: 'A door you can close on the rest of the house.',
    cost: 'low',
    care: 'Only stays a study if the household agrees it is one.',
    emits: ['quiet', 'shade'],
    sensitive: ['noise', 'footfall', 'smell'],
  },
  {
    id: 'gym',
    name: 'Gym',
    tier: 'private',
    consent: 'permitted',
    have: 'No membership, and no excuse.',
    cost: 'low',
    care: 'It becomes storage inside two years unless somebody defends it.',
    emits: ['noise', 'work', 'shade'],
    sensitive: ['heat'],
  },
  {
    id: 'spare-room',
    name: 'Spare room',
    tier: 'private',
    consent: 'householder',
    have: 'Somewhere for people to stay, and for everything else to go.',
    cost: 'low',
    care: 'Whatever you meant it to be, it will be full of things by Christmas.',
    emits: ['shade'],
    sensitive: ['noise'],
  },

  /* ---- §6 Outside — rounds 7–8 ----------------------------------- */
  {
    id: 'vegetable-garden',
    name: 'Vegetable garden',
    tier: 'outside',
    consent: 'permitted',
    have: 'Something to pick in August, and beds to look at in February.',
    cost: 'very-low',
    care: 'Watering, netting, and the fortnight in summer when you go away.',
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
    consent: 'permitted',
    have: 'Somewhere to sit outside without standing on the grass.',
    cost: 'moderate',
    care: 'Weeds between the slabs, and a jet wash you will buy and use twice.',
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
    consent: 'permitted',
    have: 'The things that were in the hall are now in the shed.',
    cost: 'low',
    care: 'A felt roof with about ten years in it, and a lock worth the money.',
    emits: ['shade'],
    sensitive: [],
  },
  {
    id: 'lawn',
    name: 'Lawn',
    tier: 'outside',
    consent: 'permitted',
    have: 'Green, soft, and somewhere to put a chair.',
    cost: 'very-low',
    care: 'Cutting it, March to October, whether or not you feel like it.',
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
    consent: 'permitted',
    have: 'Food you grew, and a reason to be outside every day.',
    cost: 'very-low',
    care: 'Twenty minutes a day, every day, forever. This is the largest commitment on the plot.',
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
    consent: 'permitted',
    have: 'Heat without a gas bill, and a house that runs warm and slow.',
    cost: 'high',
    care: 'An annual service, radiators sized for it, and a hum you stop hearing after a month.',
    emits: ['noise'],
    sensitive: [],
  },
  {
    id: 'solar-array',
    name: 'Solar array',
    tier: 'wildcard',
    consent: 'permitted',
    have: 'Some of your electricity, on the days you need least of it.',
    cost: 'high',
    care: 'An inverter with fifteen years in it, and panels somebody has to climb up to.',
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
    consent: 'permitted',
    have: 'Rooms that hold their heat, in a house that never has.',
    cost: 'moderate',
    care: 'Every wall is thicker now, and every fixing has to find the one behind.',
    emits: ['heat'],
    sensitive: [],
  },
  {
    id: 'air-conditioning',
    name: 'Air conditioning unit',
    tier: 'wildcard',
    consent: 'householder',
    have: 'One room that is bearable in the week it matters.',
    cost: 'moderate',
    care: 'A filter, a service, and a running cost that lands in the hottest month.',
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

/* ------------------------------------------------------------------ *
 * The report — §10
 * ------------------------------------------------------------------ */

/**
 * §10.2 — what it cost, cheapest first. A phrase, never a number, and never
 * shown until the eighth plan lands.
 *
 * The bands are aggregated into a share of the most expensive house that could
 * have been built from the same number of plans, then this list is indexed by
 * it. Add a phrase and the scale gets finer; the engine does not care how many
 * there are.
 */
export const costPhrases: string[] = [
  'Modest. You would not have to explain it to anyone.',
  'Substantial, but the kind of number people say out loud.',
  'The kind of project you remortgage for.',
  'The kind of project you remortgage for, and then explain to the bank a second time.',
];

/**
 * §10.3 — one sentence naming what kind of house it turned out to be.
 *
 * Selected by what the plot is dominantly made of and by how much of the old
 * house is still standing. The most specific line that fits wins, so the
 * fallback at the end can sit in the same list. The first four are the GDD's own
 * examples; the rest fill in the profiles those four leave uncovered.
 *
 * There must always be a line with no conditions on it.
 */
export const closingLines: ClosingLine[] = [
  {
    line: 'A house that asks a lot of you in spring.',
    dominant: ['work'],
  },
  {
    line: 'A quiet house that will be cold in five years.',
    dominant: ['quiet'],
  },
  {
    line: 'You kept almost all of it, and it will keep asking you for things.',
    dominant: ['work'],
    fabric: 'all',
  },
  {
    line: 'There is very little of the old house left. It is warm, and it is yours.',
    dominant: ['heat'],
    fabric: 'none',
  },
  {
    line: 'A loud house. There will be somewhere to go when it is too much, or there will not.',
    dominant: ['noise'],
  },
  {
    line: 'A bright house, and one you will spend a fortnight a year keeping bright.',
    dominant: ['light'],
  },
  {
    line: 'A house you move through rather than sit in.',
    dominant: ['footfall'],
  },
  {
    line: 'A house with a damp corner in it. You will know which one by November.',
    dominant: ['damp'],
  },
  {
    line: 'A house that holds its heat, and holds it in the wrong month too.',
    dominant: ['heat'],
  },
  {
    line: 'You took all of the old house down. What stands there is entirely yours, and entirely new.',
    fabric: 'none',
  },
  {
    line: 'The old house is still standing, with the new one built around it.',
    fabric: 'all',
  },
  {
    /** The fallback. Fires when nothing more specific fits — there must be one. */
    line: 'A house that will take some living in before you know what it is.',
  },
];

/**
 * §7, §10.2 — added to the care column when any of the old house came down.
 * Demolition is the one irreversible decision in the game, and it belongs in the
 * column about what you will be looking after rather than in a section of its
 * own.
 */
export const demolitionCare =
  'Part of the old house is gone. What stands there now is new, and new is what you will be looking after.';

/* ------------------------------------------------------------------ *
 * Consent and preservation — §9
 * ------------------------------------------------------------------ */

/**
 * §9.3 — one obligation per flag, and they land inside "what you'll look after"
 * rather than in a section of their own.
 *
 * §9.1 — flags, never outcomes. Nothing here says an application succeeded or
 * failed, because nothing in the game rolls for it. Planning is not a cost paid
 * once; it is a relationship the household now has with the local authority, and
 * these lines are written as ongoing rather than as a hurdle cleared.
 */
export const consentCare: Record<Consent, string> = {
  permitted:
    'Some of this needed nobody’s permission. Keep the drawings anyway — a buyer’s solicitor will ask one day.',
  householder:
    'An application, a fee, and the neighbours consulted. Weeks of it, and a decision notice to keep somewhere safe.',
  sensitive:
    'A condition on the decision, or a request to change something. You will be agreeing details with an officer, and then living with what you agreed.',
  demolition:
    'A heavier process, and a longer one. What comes down has to be recorded, and what replaces it has to answer for it.',
};

/**
 * §14 — the flag as it appears on a plan in hand. Two or three words, because it
 * sits under the plan's name on a small block.
 *
 * §9.1 again: none of these is an outcome. "Application" is not "approval", and
 * "conditions likely" is not "refusal".
 */
export const consentLabels: Record<Consent, string> = {
  permitted: 'no application',
  householder: 'application',
  sensitive: 'conditions likely',
  demolition: 'demolition',
};

/**
 * §9.1 — the order the obligations are read in, and it is the order they arrive
 * in real life: the things nobody had to approve, then the application, then the
 * condition attached to it, then the demolition that made all of it heavier.
 */
export const consentOrder: Consent[] = [
  'permitted',
  'householder',
  'sensitive',
  'demolition',
];

/**
 * §9.2 — what `conservation: true` changes. Four deltas, and the same deck.
 *
 * This is the cheapest playtest in the game and the one most worth running: play
 * a house, then play the same house with this switched on in `config` above. The
 * plans are identical and the obligations are not, which is the whole argument
 * §9 is making.
 */
export const conservationOverrides: ConservationOverrides = {
  /** New openings in the north (street) elevation. */
  northOpening: {
    consent: 'sensitive',
    care: 'A new opening on the street, in a place where the street is the reason for the designation. Expect to agree the frame, the glazing bar and the reveal, and to keep agreeing them.',
  },

  /** Taking any of the old house down, here. */
  demolition: {
    consent: 'sensitive',
    care: 'You took down part of a building the area is designated for. That is recorded, and it is the first thing anyone reads about this house. What replaces it has to answer for it in materials, in proportion and in every application you make from now on — and the carbon that was already in those walls is spent, whatever you build.',
  },

  /** The two the GDD names by plan. */
  plans: {
    'heat-pump': {
      consent: 'householder',
    },
    'glass-extension': {
      care: 'The ridge has to sit below the eaves of the original house. Whatever you wanted the roof to do, it does it lower down.',
    },
  },
};
