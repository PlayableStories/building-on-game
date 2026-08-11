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
  InterfaceCopy,
  PairLine,
  Plan,
  PlotContent,
  Quality,
  QualityLine,
  Rules,
  Situation,
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
 * The plot — §5
 * ------------------------------------------------------------------ */

/**
 * §5 — what was already standing when the player arrived, and where the house
 * stops and the garden starts.
 *
 * The old rooms are named. That matters more than it looks: a cell labelled
 * "Inherited" reads as scenery, and playtesters did not work out that it could
 * be built on at all. A cell labelled "Old scullery" is obviously a room, and an
 * obviously replaceable one — the label is doing the teaching that the rules
 * card should not have to do twice.
 *
 * The front door is the exception. It is inherited, it is never a legal
 * placement, and it cannot come down. Every other decision in the game is the
 * player's; this one came with the house, and it is what makes the plot a house
 * they were left rather than ground they were given.
 *
 * A fork points this at a different building. The engine reads cells and a row
 * number and never learns what a scullery is.
 */
export const plot: PlotContent = {
  frontDoor: { cell: 'GC1', name: 'Front door' },

  /**
   * §5 — the stair, beside the front door where a London terrace puts it, and
   * the landing directly above it. Neither can come down: they are how the
   * first floor is reachable at all.
   */
  stair: { cell: 'GB1', name: 'Stairs' },

  fabric: [
    { cell: 'GB2', name: 'Old kitchen' },
    { cell: 'GC2', name: 'Old sitting room' },
    { cell: 'GB3', name: 'Old scullery' },
    { cell: 'GC3', name: 'Old back room' },
  ],

  /** Rows 1–3 are the house. Rows 4–5 are the garden. */
  gardenFromRow: 4,
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
 * §13, §14 — what the game is, for someone who has never played it.
 *
 * Playtesting found two things a first-time player did not know, and both are
 * the game's fault rather than theirs. They did not know what they were being
 * asked to *do* — a no-fail game has no failure to teach through, so it has to
 * say. And they did not know the old rooms could be taken down at all, which is
 * the single most interesting decision in the design going unnoticed.
 *
 * So: the objective in one sentence, then only the rules that cannot be worked
 * out from the board. Shown before round 1 and available from the header for
 * the rest of the game, because a rule you can only read once is a rule you
 * have to remember rather than one you can check.
 */
export const rules: Rules = {
  objective:
    'Eight rounds. Turn the house you were left into one that works for the situation you are in. There is no score, and no way to lose.',

  points: [
    'Each round you are dealt three plans. Choose one — the other two are gone.',
    'It has to touch something already built, and you can never move it afterwards.',
    'Every plan belongs somewhere: in the house, in the garden, upstairs or on the roof. Only the squares it can go in will light up.',
    'Upstairs only goes over a room. What you put on the ground decides what you can sleep above.',
    'The roof sits on top of whatever is highest — and roofing a square seals the first floor under it, for good.',
    'The old rooms can be taken down. Put a plan on one and it goes, for good.',
    'The front door and the stairs are not yours to change. They came with the house.',
    'What you build next to what is the whole game. The house will tell you when it notices something.',
  ],
};

/**
 * §16 — every other word the interface says.
 *
 * The M12 audit found these hard-coded across seven components, which quietly
 * broke the promise §16 makes: a participant pointing the game at a hospice
 * garden has no street, is not "building on" anything, and does not "take down"
 * a wall. None of it was reachable without opening a `.tsx` file.
 *
 * Unglamorous, and it is the difference between a fork and a rewrite.
 */
export const ui: InterfaceCopy = {
  title: 'Building On',
  begin: 'Begin',

  rules: {
    open: 'How this works',
    heading: 'How this works',
    close: 'Back to the house',
  },

  prompt: {
    choose: 'Choose one of three. The other two are gone.',
    // §5 — naming where it goes here, because it is the rule a player is
    // most likely to be caught out by in the middle of a round.
    place: {
      house:
        'It goes on the ground floor, touching what is already built. You cannot move it later.',
      garden:
        'It goes in the garden, touching what is already there. You cannot move it later.',
      upstairs:
        'It goes on the first floor, over a room that is already there. You cannot move it later.',
      roof:
        'It goes on the roof, on top of whatever you have built. You cannot move it later.',
    },
  },

  plot: {
    street: 'The street',
    garden: 'The garden',
    sun: '· sun from the south',
    inherited: 'inherited',
    empty: 'empty',
    fixed: 'cannot be taken down',
    /** §5 — the heading over each grid, and the accessible name for it. */
    levels: {
      roof: 'The roof',
      first: 'First floor',
      ground: 'Ground floor',
    },
    levelPicker: 'Which level of the house you are looking at',
    /** §5 — the cell the stair arrives at, named like any other inherited cell. */
    landing: 'Landing',
  },

  observation: {
    dismiss: 'Click, space or enter',
  },

  demolition: {
    line: (standing, cell, plan) =>
      `The ${standing.toLowerCase()} at ${cell} is part of the house you were left. ` +
      `Putting the ${plan.toLowerCase()} there takes it down.`,
    note: 'This cannot be undone.',
    confirm: 'Take it down',
    cancel: 'Put it somewhere else',
  },

  report: {
    finished: 'The house is finished.',
    have: 'What you’ll have',
    // §10.2's own phrase is "what you'll look after". Beside "what you'll have"
    // on the same row, this does the same job in fewer words.
    care: 'What it asks',
    cost: 'Cost',
    obligations: 'Also',
    again: 'Build again',
  },
};

/**
 * §2, §10.4 — why this house has to change. One per game, drawn by the seed.
 *
 * The prototype opened with a fixed three-person household — you, a daughter
 * who played drums, a mother with bad knees. Playtesting killed it: all three
 * were forgotten by round three, and the specifics were doing none of the work.
 * What replaces them is one circumstance per game, out of six that most people
 * have either been in or watched happen to someone. It is remembered because
 * there is only one of it, and it is a far better replay driver than three
 * fixed people ever were — the same deck answered against a different situation
 * is a different house.
 *
 * The situation is never scored, and never mentioned during play. It comes back
 * once, in the report, and what it says is a reaction rather than a verdict:
 * nothing here says the house is good or bad, only what it will be like to live
 * in it in these circumstances.
 *
 * This is the first thing to change when forking (§16, rung 1). Six situations
 * a community centre actually faces will re-point the whole game on their own.
 */
export const situations: Situation[] = [
  {
    id: 'door',
    line: 'You work from home now, and there has never been a door you could close.',

    /**
     * A study is the thing that was actually promised. A spare room is the
     * compromise everybody makes and nobody admits to making.
     */
    reaction: (house) => {
      if (house.has('study')) {
        const noisy = ['kitchen', 'living-room', 'utility-room']
          .map((id) => house.distance('study', id))
          .filter((steps): steps is number => steps !== null);
        if (noisy.length > 0 && Math.min(...noisy) <= 1) {
          return 'You have the door. It opens onto the busiest part of the house, so you will hear everything — but it closes, and that turns out to be most of it.';
        }
        return 'You have the door, and it is far enough from everything that closing it means something. You will use it every day and stop noticing you have it.';
      }
      if (house.has('spare-room')) {
        return 'No study. You will work in the spare room, and it will be a spare room again the moment anybody comes to stay.';
      }
      return 'You still have nowhere to close a door on. You will work at the table, as you always have, and mind it more now that the house was rebuilt around you not minding it.';
    },
  },
  {
    id: 'stairs',
    line: 'Someone is moving in who manages one flight of stairs on a good day.',

    /**
     * Distance from the front door, in steps. This is the situation that turns
     * the whole plot into a question about where things are relative to the one
     * cell the player never chose.
     */
    reaction: (house) => {
      const wc = house.has('downstairs-wc');
      const steps = house.fromFrontDoor('bathroom');
      if (steps === null) {
        return wc
          ? 'No bathroom, but there is a WC by the door. That will do, and everybody has agreed it will do, and nobody quite believes it.'
          : 'There is no bathroom on this floor and no WC either. Every day here will begin with the stairs.';
      }
      if (steps <= 2) {
        return 'From the front door to the bathroom is a few steps on the flat. Nobody will have to plan the journey, which is the entire thing they were worried about.';
      }
      if (wc) {
        return 'The bathroom is right across the house, so the WC by the door is what actually gets used. It works. It is not what anyone pictured.';
      }
      return 'The bathroom is at the far end from the door. The distance has been counted once already, and it will be counted again every single day.';
    },
  },
  {
    id: 'loud',
    line: 'Somebody in this house needs to be able to make a noise, and there is nowhere to do it.',

    /**
     * Distance between where the noise is and where people sit. Nothing here
     * says loud is bad; it says how far apart the two things ended up.
     */
    reaction: (house) => {
      const loud = ['bedroom', 'gym', 'shed'].filter((id) => house.has(id));
      if (loud.length === 0) {
        return 'Nothing here is anybody’s in particular. The noise will happen in the middle of the house, at everyone, as it always has.';
      }
      const quiet = ['living-room', 'study', 'dining-room'].filter((id) => house.has(id));
      const gaps = loud.flatMap((a) =>
        quiet.map((b) => house.distance(a, b)).filter((steps): steps is number => steps !== null),
      );
      if (gaps.length === 0) {
        return 'There is a room for it, and nothing settled anywhere near enough to complain. Nobody has said out loud how well that has worked out.';
      }
      const closest = Math.min(...gaps);
      if (closest <= 1) {
        return 'It shares a wall with where everyone sits. The arithmetic on that has already been done, by both sides, separately.';
      }
      if (closest === 2) {
        return 'Far enough that the argument will be about volume rather than about whether at all. That is a better argument to be having.';
      }
      return 'It is at the other end of the house from where anyone sits. The question of what time to stop has quietly stopped being asked.';
    },
  },
  {
    id: 'baby',
    line: 'There will be a baby in this house by the spring.',

    /**
     * Two things matter and neither is the nursery: where the washing happens,
     * and how far the bedroom is from the bathroom at four in the morning.
     */
    reaction: (house) => {
      const utility = house.has('utility-room');
      const night = house.distance('bedroom', 'bathroom');
      if (night !== null && night <= 1) {
        return utility
          ? 'The bathroom is next to where you sleep and the washing has a room of its own. Whoever planned this had been through it before.'
          : 'The bathroom is next to where you sleep, which is the part that matters at four in the morning. The washing will have to happen in the kitchen, at the worst possible hour.';
      }
      if (night !== null) {
        return 'The bathroom is a walk from the bedroom. For about a year that walk will happen in the dark, several times a night, and it will feel much longer than it is.';
      }
      return utility
        ? 'No bedroom and no bathroom yet, but the washing has somewhere to go — and for the first year there is a startling amount of washing.'
        : 'The house is not ready and the spring is coming anyway. It will be done in the wrong order, at speed, like everybody else does it.';
    },
  },
  {
    id: 'cooks',
    line: 'Two of you cook. One of you tidies. This has been the arrangement for years.',

    /** Everything hangs off the kitchen and what ended up beside it. */
    reaction: (house) => {
      if (!house.has('kitchen')) {
        return 'There is still no kitchen. Whatever else this house turned into, the argument you were trying to settle is exactly where it was.';
      }
      const dining = house.distance('kitchen', 'dining-room');
      const utility = house.distance('kitchen', 'utility-room');
      if (utility !== null && utility <= 1) {
        return 'The kitchen has somewhere to put everything that is not cooking. The tidying stops being a second job, which is what was actually being asked for.';
      }
      if (dining !== null && dining <= 1) {
        return 'The kitchen opens straight onto the table. Meals will be easy and the mess will be visible from where everyone sits, which settles nothing.';
      }
      return 'The kitchen is on its own. Whoever is cooking will be on their own in it too, and the tidying will still happen afterwards, by the same person.';
    },
  },
  {
    id: 'visitors',
    line: 'You are here on your own, and people come to stay.',

    /** A house for one, that has to become a house for four twice a year. */
    reaction: (house) => {
      const spare = house.has('spare-room');
      const bathroom = house.has('bathroom');
      const wc = house.has('downstairs-wc');
      if (spare && (bathroom || wc)) {
        return 'There is a room for people and somewhere for them to wash. Twice a year this house will be full, and the rest of the time it will be yours, which is the correct proportion.';
      }
      if (spare) {
        return 'There is a room for people to stay in, and one bathroom’s worth of nothing to go with it. They will come anyway, and it will be fine, and it will be a bit close.';
      }
      if (house.has('living-room') || house.has('dining-room')) {
        return 'No spare room. People will stay on the sofa, the way they always have, and leave a day earlier than they meant to.';
      }
      // Deliberately "a visitor" rather than "anyone": the house may well have a
      // bedroom, and it is yours. That is the whole answer to this situation.
      return 'Nowhere for a visitor to sleep, and nowhere to sit that is not the kitchen. This house has been built for exactly one person, and it will get exactly one.';
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
 *
 * §9.1 — the consent flags were written from judgement, and PLANNING-DATA.md
 * checks them against 308,015 real London decisions. Where a card carries a
 * figure in a comment below, that is the evidence for its flag. Three moved;
 * the rest were confirmed.
 *
 * The plain rooms — hall, boot room, WC, kitchen, living room, dining room,
 * utility, bedroom, bathroom, spare room — are all `householder` and share one
 * piece of evidence rather than ten copies of it. In practice every one of them
 * is a rear extension, and a rear extension is the single most common thing
 * anyone does to a London house: 140,559 decisions, 27.0% of them conditioned
 * against a 24.0% baseline. An application, usually granted, sometimes with
 * something attached. That is exactly what `householder` claims.
 *
 * What the data does *not* reach: the `care` line on each plan below. Those are
 * maintenance claims — gutters, a felt roof with ten years in it, a filter and
 * a service — and a record of planning decisions has nothing to say about any
 * of them. All twenty-four were re-read against it and all twenty-four stand,
 * unchanged, because the evidence is silent rather than agreeing. The lines the
 * data does reach are the four in `consentCare`, which are about process.
 */
export const deck: Plan[] = [
  /* ---- §6 Threshold — rounds 1–2 --------------------------------- */
  {
    id: 'porch',
    name: 'Porch',
    tier: 'threshold',
    where: 'house',
    /**
     * PLANNING-DATA.md — 10,570 London decisions mention a porch, and 30.1% of
     * them come back with conditions against a 24.0% baseline. A porch under
     * three square metres genuinely is permitted development; the volume says
     * people apply anyway, and the rate says it is not waved through. Not
     * `sensitive`, though: what the data shows is an application, not a hard one.
     */
    consent: 'householder',
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
    where: 'house',
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
    where: 'house',
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
    where: 'house',
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
    where: 'garden',
    /** PLANNING-DATA.md — 19.2% conditioned, below the 24.0% baseline. */
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
    where: 'house',
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
    where: 'house',
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
    where: 'house',
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
    where: 'house',
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
    where: 'house',
    /**
     * PLANNING-DATA.md — confirmed. A conservatory is conditioned 30.8% of the
     * time and a glazed extension 34.7%, against a 24.0% baseline. What gets
     * conditioned is the roof: height, pitch, and where the ridge sits.
     */
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
    where: 'upstairs',
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
    where: 'upstairs',
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
    where: 'upstairs',
    /**
     * PLANNING-DATA.md — confirmed, strongly. A study is a loft conversion, and
     * loft conversions are conditioned 9.7% of the time: the lowest rate of
     * anything measured, against a 24.0% baseline. Building inside your own
     * roof really is the thing nobody has an opinion about.
     */
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
    where: 'upstairs',
    /** PLANNING-DATA.md — a loft or an outbuilding: 9.7% and 22.0% conditioned. */
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
    where: 'upstairs',
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
    where: 'garden',
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
    where: 'garden',
    /**
     * PLANNING-DATA.md — the most-conditioned thing in the whole dataset. A
     * roof terrace is conditioned 44.0% of the time and a patio 35.4%, against
     * a 24.0% baseline: higher than the conservatory, higher than the air
     * conditioning unit. Overlooking is why. Somewhere to sit outside turns out
     * to be the single most negotiated thing a Londoner can build, which is not
     * what anybody would guess, and it is why this card is no longer
     * `permitted`.
     */
    consent: 'sensitive',
    have: 'Somewhere to sit outside without standing on the grass.',
    cost: 'moderate',
    care: 'Weeds between the slabs, and a jet wash you will buy and use twice.',
    emits: [],
    sensitive: ['noise', 'smell', 'shade'],
    orientation: {
      // Row 4 — the strip of garden the house keeps in shadow. The terrace's
      // north line used to be about the street, which an outdoor plan can no
      // longer reach; this is the same observation about the same problem.
      north: 'It sits in the shadow of the house until late on. You will sit there less than you imagine.',
      south: 'The afternoon lands here. This is the one you will use.',
    },
  },
  {
    id: 'shed',
    name: 'Shed',
    tier: 'outside',
    where: 'garden',
    /**
     * PLANNING-DATA.md — 22.0% conditioned as an outbuilding, just under the
     * 24.0% baseline. Called a garden room it reaches 29.3%, which is a fair
     * description of what happens when a shed acquires a window and a radiator.
     */
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
    where: 'garden',
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
    where: 'garden',
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
    where: 'garden',
    /**
     * PLANNING-DATA.md — 35.5% of air source heat pump applications are
     * conditioned, against a 24.0% baseline. Siting and acoustics, which is the
     * same thing this plan's adjacency writing is about. The flag now agrees
     * with the loudest line in the deck instead of contradicting it.
     */
    consent: 'sensitive',
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
    /**
     * §5 — the roof, which is where it always was. It was `indoor` only because
     * a one-storey board had nowhere else to put it, and a solar array is not
     * in a room.
     */
    where: 'roof',
    /** PLANNING-DATA.md — 26.4% conditioned, within noise of the 24.0% baseline. */
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
    where: 'house',
    /**
     * PLANNING-DATA.md — the strongest single result in the set. Internal wall
     * insulation appears in **one** of 308,015 London decisions. External wall
     * insulation appears 86 times and is conditioned 30.2%.
     *
     * The word doing the work in this plan's name is *internal*. Keep it: it is
     * the difference between a card nobody has to ask about and a card that is
     * about the street's opinion of your house.
     */
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
    where: 'house',
    /**
     * §9.1 — the second `sensitive` in the deck, and the answer to a finding
     * the M7 measurements turned up: with the glass extension as its only
     * source, the flag fired 0.4 times a game, so a player could play three
     * games and never meet it. One flag in four doing almost nothing is content
     * thinness rather than a design position.
     *
     * This is the defensible one to change. An external condenser is plant
     * bolted to a wall that runs in the evenings — noise limits, siting and
     * hours are exactly what a condition gets attached to. Everything else in
     * the deck is either plainly permitted or plainly a householder
     * application, and inflating the flag by pretending otherwise would make
     * §9 dishonest to buy a nicer distribution.
     */
    /**
     * PLANNING-DATA.md — confirmed, and the highest single rate in the deck:
     * 42.2% of air conditioning applications are conditioned, against a 24.0%
     * baseline. M7 moved this from `householder` on the argument that an
     * outdoor condenser unit is a neighbour's problem. The data agrees.
     */
    consent: 'sensitive',
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
  /**
   * §8.7, verbatim — with two of its lines removed rather than left to rot.
   *
   * §8.7 wrote *heat pump beside bedroom* and *home farm beside bedroom* for a
   * flat board, where the two could genuinely end up sharing a wall. §5 gave the
   * house floors and moved the private tier upstairs, and a garden cell and a
   * first-floor cell now have no way of touching at all: not beside, and nothing
   * sits over a garden. Both lines had been unreachable since M15 without
   * anything noticing, which is what `canMeet` in `scripts/validate.ts` now
   * exists to prevent.
   *
   * No mechanic went with them. The heat pump still emits noise and the home
   * farm still emits smell, so if either ever does end up under something that
   * suffers from it, §8.6's quality step speaks — it just speaks in the general
   * voice rather than the specific one.
   */
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

  // Written for this build, in the same voice.
  {
    a: 'kitchen',
    b: 'bin-store',
    line: 'Convenient in February. Less so in July, with the window open.',
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

  /**
   * §8.6 — stacked, not beside. `over` means `a` sits directly on top of `b`,
   * and these fire through a floor rather than through a wall.
   *
   * Two of these were written as side-by-side lines before the house had floors,
   * and had quietly stopped being reachable: the private tier lives upstairs
   * now, so a bathroom can no longer be next to a kitchen or a study next to the
   * hall. They can only be *over* them, so that is what they say.
   */
  {
    a: 'bathroom',
    b: 'kitchen',
    over: true,
    line: 'One floor, two rooms, and both of them wanting the same drains.',
  },
  {
    a: 'study',
    b: 'hall',
    over: true,
    line: 'You will hear every arrival before you hear the door.',
  },
  {
    a: 'bedroom',
    b: 'kitchen',
    over: true,
    line: 'Dinner arrives through the floorboards an hour before you sleep.',
  },
  {
    a: 'bedroom',
    b: 'utility-room',
    over: true,
    line: 'The spin cycle finishes at eleven, directly under the pillow.',
  },
  {
    a: 'bathroom',
    b: 'living-room',
    over: true,
    line: 'Everyone downstairs knows exactly who is running the tap.',
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
 * §8.6 — the few connecting words that name what caused a line.
 *
 * The line itself says what the relationship is like. This says which two
 * things are in it, and it exists because playtesting found the line reading as
 * atmosphere: a player who does not know that *this* sentence is about *that*
 * placement and *that* neighbour has not seen the mechanic at all, however good
 * the sentence is.
 *
 * Small enough to be worth having on the fork surface anyway. A game about a
 * hospice garden may have no street to face, and "beside" is not the only way
 * two things can be related.
 */
export const causeWords = {
  beside: 'beside',
  /**
   * §5 — the house has floors, so "beside" is no longer the only way two rooms
   * can be in each other's way. 'under' rather than 'below' for the downward
   * one: it is what anyone standing in the room would actually say.
   */
  above: 'above',
  below: 'under',
  and: 'and',
  /** What the old house is called when it is the neighbour rather than a room. */
  fabric: 'the old house',

  /**
   * §5 — where it is standing, for an orientation line. One per band of the
   * plot, not one per compass direction: row 1 and row 4 both face north, and
   * "facing the street" is a lie about a terrace at the bottom of the garden.
   * The middle of the house never fires an orientation line, but it is written
   * here anyway so a fork changing the row map does not find a gap.
   */
  facing: {
    street: 'facing the street',
    middle: 'in the middle of the house',
    back: 'at the back, onto the garden',
    shadow: 'in the shadow of the house',
    garden: 'at the bottom of the garden',
  },
};

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
/**
 * PLANNING-DATA.md — checked and kept. 60,869 London decisions mention
 * demolition: refused 16.2% against a 20.0% baseline, conditioned 28.4%
 * against 24.0%. Demolition is refused *less* often than average and
 * conditioned *more* often, which is precisely the shape of this line and of
 * §9.1's insistence that the game flags things rather than blocking them. The
 * weight is real and it arrives afterwards, not at the door.
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
 *
 * These four are the lines PLANNING-DATA.md speaks to most directly, because
 * they are about *process* and the data is a record of process. The earlier
 * versions described how an application feels — weeks of it, a decision notice
 * somewhere safe — which is true and is not an obligation. What a condition
 * actually obliges you to do is now known, from 30,000 condition discharges:
 *
 *   approved plans and drawings   5,795   build precisely what you drew
 *   materials and finishes        2,384   what it is made of is agreed
 *   construction management       1,619
 *   drainage and contamination    1,423
 *   landscaping                   1,199
 *
 * The first two dominate householder work by a distance, and neither of them
 * was in these lines. They are also the right *shape* for §10.2's "what it
 * asks" column: ongoing, specific, and not a warning.
 */
export const consentCare: Record<Consent, string> = {
  /**
   * §9.1 — 21% of all London decisions are lawful development certificates:
   * people paying to establish that they did not need permission, of whom
   * 15.1% are told that they did. "Nobody had to be asked" is true and is not
   * the same as "nothing was filed".
   */
  permitted:
    'Nobody had to approve this, which is not the same as nobody asking. Keep the drawings and the dates — the one certificate you never applied for is the one a buyer’s solicitor wants.',
  householder:
    'You build precisely what you drew. The drawings are the permission, so the change of mind on site is a new application, and the shortcut is the thing that gets noticed.',
  sensitive:
    'The materials stopped being entirely your choice. What it is faced in, what colour, what the roof does at the edge — agreed with somebody else, on the record, and still agreed in ten years.',
  demolition:
    'A heavier process, and a longer one. What comes down has to be recorded, and what replaces it has to answer for it.',
};

/**
 * §14 — the flag as it appears on a plan in hand. Two or three words, because it
 * sits under the plan's name on a small block.
 *
 * §9.1 again: none of these is an outcome. "Application" is not "approval", and
 * "conditions likely" is not "refusal".
 *
 * `permitted` reads "no application expected" rather than "no application".
 * PLANNING-DATA.md: 65,087 London decisions — 21% of all of them — are people
 * establishing that they did not need permission, and 15.1% of those are told
 * they did. A flat "no application" claims a certainty the data does not
 * support. One word, and it is the difference between a rule and an
 * expectation.
 */
export const consentLabels: Record<Consent, string> = {
  permitted: 'no application expected',
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
    /**
     * This used to raise the heat pump from `permitted` to `householder`. With
     * the base flag now `sensitive` on the evidence in PLANNING-DATA.md, that
     * override would be a *downgrade* — conservation would make the heat pump
     * easier, which is the opposite of everything else in this block.
     *
     * So the flag is left alone and what conservation actually adds is said
     * instead. It does not change whether you ask; it changes what you end up
     * agreeing to.
     */
    'heat-pump': {
      care: 'Where the unit stands stops being a question about the boiler and becomes a question about the street: sited out of sight, boxed if it is not, and held to a noise limit at the neighbour’s wall rather than at yours.',
    },
    'glass-extension': {
      care: 'The ridge has to sit below the eaves of the original house. Whatever you wanted the roof to do, it does it lower down.',
    },
  },
};
