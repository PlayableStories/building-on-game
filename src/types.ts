/**
 * Shared types for Building On.
 *
 * This is the only module `src/engine/` is allowed to import. Everything the
 * engine needs about the *content* of the game arrives as an argument typed
 * from here, never as an import of `content.ts`. That constraint is what makes
 * the fork surface in GDD §16 real: a participant can replace the entire deck,
 * the household and the report copy without opening engine code.
 *
 * Section references throughout are to GDD.md.
 */

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/** §8.5 — nine qualities, kept small so a player can hold them in their head. */
export const QUALITIES = [
  'heat',
  'damp',
  'noise',
  'smell',
  'light',
  'work',
  'quiet',
  'footfall',
  'shade',
] as const;
export type Quality = (typeof QUALITIES)[number];

/**
 * §6 — the staged tiers, in the order the house gets built.
 *
 * `roof` is last because it is last: you do not put a dormer on a house before
 * there is a floor under it. It shares a name with the `where` of the same
 * value and they are different things — a tier is *when* a plan is dealt, a
 * `where` is which part of the building it goes on. They coincide for the roof
 * cards and nowhere else: `solar-array` goes on the roof from the wildcard
 * pool, and `balcony` is dealt in the private tier but stands upstairs.
 */
export const TIERS = ['threshold', 'daily', 'private', 'outside', 'roof'] as const;
export type Tier = (typeof TIERS)[number];

/** A plan belongs to a tier, or to the wildcard pool that can appear in any round. */
export const PLAN_TIERS = [...TIERS, 'wildcard'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** §9.1 — flags, never outcomes. Nothing here succeeds or fails. */
export const CONSENT_FLAGS = [
  'permitted',
  'householder',
  'sensitive',
  'demolition',
] as const;
export type Consent = (typeof CONSENT_FLAGS)[number];

/** §10.2 — bands only. These are aggregated into a phrase, never a number. */
export const COST_BANDS = ['very-low', 'low', 'moderate', 'high'] as const;
export type CostBand = (typeof COST_BANDS)[number];

/* ------------------------------------------------------------------ *
 * The plot — §5
 * ------------------------------------------------------------------ */

export const COLUMNS = ['A', 'B', 'C', 'D', 'E'] as const;
export type Column = (typeof COLUMNS)[number];

export const ROWS = [1, 2, 3, 4, 5] as const;
export type Row = (typeof ROWS)[number];

/**
 * §5 — the building has three levels, and a plan belongs to one of them.
 *
 * The prototype was a single storey, and GDD §4 listed multiple storeys as out
 * of scope. What overturned it was the planning data: dormers, rooflights and
 * roof extensions are the second, third and fourth most common works in London,
 * 165,405 applications between them, and none of them is a cell on a flat
 * board. The board went up so that the deck could hold them.
 */
export const LEVELS = ['ground', 'first', 'roof'] as const;
export type Level = (typeof LEVELS)[number];

/** The letter a level contributes to a cell id. */
export const LEVEL_CODE = { ground: 'G', first: 'F', roof: 'R' } as const;
export type LevelCode = (typeof LEVEL_CODE)[Level];

/**
 * A cell is a level, a column and a row: 'GB2' is the old kitchen, 'FB2' is the
 * room above it, 'RB2' is the roof over whichever of those is on top.
 *
 * The level is part of the id rather than a field beside it, so every existing
 * lookup — `includes`, `Set`, `find(p => p.cell === cell)` — keeps working on a
 * plain string. The player never sees the prefix: the plot prints 'B2' under a
 * level heading, and the accessible name says "First floor, B2".
 */
export type CellId = `${LevelCode}${Column}${Row}`;

/**
 * §5 — which way a row faces. Row 1 is the street (north) and row 5 is the open
 * garden (south), with the sun coming from the south. Not every row faces
 * something: see `orientationOf` in `engine/grid.ts` for the map, and for why
 * rows 2 and 4 face nothing.
 */
export type Orientation = 'north' | 'south';

/**
 * §5 — where in the plot a row sits, front to back. Five bands, and they mean
 * five different things to stand in. See `positionOf` in `engine/grid.ts`.
 *
 * Not the same idea as `Orientation`, and this is the distinction: the street
 * and the strip of garden the house shadows both face north, and they are not
 * the same place. The deck's writing is keyed on the compass, because what the
 * sun does is the same in both. A cause phrase has to name the band, because
 * "facing the street" is a lie about a terrace at the bottom of the garden.
 */
export type Position = 'street' | 'middle' | 'back' | 'shadow' | 'garden';

/**
 * §5 — where a plan goes. One field, four answers, one legality rule each.
 *
 * A bathroom does not go in the garden and a lawn does not go in the hall. That
 * was `zone: 'indoor' | 'outdoor'` while the board was one storey, and it stops
 * meaning anything once there are three: a bedroom and a balcony are both
 * upstairs, and "indoor" is not what separates them.
 *
 *   house     the ground floor, rows 1–3
 *   garden    the ground floor, rows 4–5
 *   upstairs  the first floor, and only over a room
 *   roof      on top of whatever is built, at whatever height that is
 *
 * See `legalCells` in `engine/grid.ts`, where each of these is exactly one rule.
 */
export const WHERES = ['house', 'garden', 'upstairs', 'roof'] as const;
export type Where = (typeof WHERES)[number];

/** A cell that was already built when the player arrived, and what it is. */
export interface InheritedCell {
  cell: CellId;
  /**
   * §12 — its own name, printed exactly as a placed plan's name is printed.
   * "Old kitchen" reads as something that could be replaced; "Inherited" does
   * not, which is the whole reason these are named.
   */
  name: string;
}

/**
 * §5 — the plot as it stands before the first round.
 *
 * This is content, not geometry. A fork pointing the game at a community centre
 * or a hospice garden inherits a different building with different rooms in it,
 * and should be able to say so here rather than in `engine/grid.ts`.
 */
export interface PlotContent {
  /**
   * §5, §7 — the one thing about the house decided before the player arrived,
   * and the one cell they cannot change. It is never a legal placement.
   */
  frontDoor: InheritedCell;
  /**
   * §5 — the stair the house came with, and the landing it arrives at.
   *
   * Like the front door it is inherited and can never come down: it is how you
   * get upstairs, and a house that could lose its stairs would be a house whose
   * first floor could be stranded. The landing directly above it is inherited
   * too, and it is the whole first-floor seeding mechanism — with one cell
   * occupied up there, §7.1's frontier rule works on the first floor with no
   * special case at all.
   */
  stair: InheritedCell;
  /** §7.2 — the old rooms. These can be placed on, which takes them down. */
  fabric: InheritedCell[];
  /** §5 — the first garden row. Everything from here down is outdoors. */
  gardenFromRow: Row;
}

/* ------------------------------------------------------------------ *
 * The deck — §8.2
 * ------------------------------------------------------------------ */

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  /** §5 — the one place it may go. It cannot be placed anywhere else. */
  where: Where;
  /** Qualities this plan puts into its neighbours. */
  emits: Quality[];
  /** Qualities this plan suffers from. */
  sensitive: Quality[];
  /** Optional — how it behaves in the north rows vs the south rows. */
  orientation?: Partial<Record<Orientation, string>>;
  consent: Consent;
  /** One line each, for the three report columns in §10.2. */
  have: string;
  cost: CostBand;
  care: string;
}

/**
 * The part of a plan the core loop needs: which plan it is, what to print on the
 * block, which tier it is drawn from, and which half of the plot it may go in.
 * The grid and the draw never read the writing, so they are typed against this
 * rather than the whole `Plan` — which also lets M1 ship a deck that has not
 * been written yet.
 */
export type PlanIdentity = Pick<Plan, 'id' | 'name' | 'tier' | 'where'>;

/**
 * What the adjacency resolution in §8.6 needs: which plan it is, what it puts
 * into its neighbours, what it suffers from, and how it behaves north or south.
 * Still not the writing for the report, which arrives with M4.
 */
export type PlanAdjacency = PlanIdentity &
  Pick<Plan, 'emits' | 'sensitive' | 'orientation'>;

/**
 * With M5 the deck is a full `Plan` — there is no field left to stage. The two
 * narrower types above are not scaffolding left over from that staging: the
 * grid, the draw and the adjacency resolution genuinely do not read the report
 * writing or the consent flag, and typing them against what they use is what
 * keeps a content change from being able to break them.
 */

/* ------------------------------------------------------------------ *
 * Writing — §8.6
 * ------------------------------------------------------------------ */

/**
 * §8.7 — a neighbour a pair line can name. Usually another plan, but two of the
 * lines the GDD asks for are not plan-to-plan: air conditioning speaks up
 * "beside anything", and internal wall insulation reacts to the original solid
 * walls rather than to a room.
 */
export type PairTarget = Plan['id'] | '*' | 'fabric';

/**
 * §8.6 — how a neighbour stands relative to the placement being read, from the
 * placement's point of view. A bedroom put on top of a kitchen is `above` it.
 *
 * Since §5 the house has floors, and a floor is not a wall: what travels through
 * one is not the same as what travels through the other, and a line that called
 * both "beside" would be describing a house the player cannot see.
 */
export type Relation = 'beside' | 'above' | 'below';

/**
 * An explicit line for one exact pairing. Matched in either direction, and the
 * best writing in the game — used for the handful of pairs that deserve it.
 *
 * A line fires on the *same floor* unless `over` says otherwise. That default is
 * deliberate: every line written before the house had floors means "beside", and
 * silently letting them fire through a ceiling would put existing writing in a
 * situation it was not written for.
 */
export interface PairLine {
  a: Plan['id'];
  b: PairTarget;
  /**
   * Stacked rather than side by side: fires only when `a` is directly above `b`.
   * Directional on purpose — a bathroom over a living room is a different
   * sentence from a living room over a bathroom.
   */
  over?: true;
  line: string;
}

/**
 * §8.6 — the generic line for an emitted quality meeting a neighbour sensitive
 * to it. One line per quality: what fires is always a quality meeting its own
 * sensitivity, so there is nothing to key a second axis on.
 */
export interface QualityLine {
  quality: Quality;
  line: string;
}

/**
 * §8.6 — one line, and everything needed to show what caused it.
 *
 * Playtesting found the mechanic the whole prototype exists to test landing as
 * atmosphere rather than as consequence: "I do not aware the line is directly
 * related to my placement and/or the neighbour." The resolution always knew
 * which neighbour fired — it threw the answer away and returned a sentence.
 *
 * So `cause` is the phrase shown above the line, and `because` is what the plot
 * lights underneath it. They are the same fact said two ways, which is the
 * point: the player reads the relationship and sees it at the same moment.
 */
export interface Observation {
  line: string;
  /** Which of §8.6's three steps produced it. */
  kind: 'pair' | 'quality' | 'orientation';
  /** The cell just placed. Always lit. */
  cell: CellId;
  /**
   * The neighbours that caused it. Empty for an orientation line, where the
   * cause is which row it landed in rather than anything next to it.
   */
  because: CellId[];
  /** 'Kitchen beside the bin store' · 'Terrace, facing the garden' */
  cause: string;
}

/**
 * §8.6 — the connecting words that turn a resolved relationship into a phrase.
 * On the fork surface with the rest of the writing: a game about a hospice
 * garden says "beside" differently, and may not have a street to face.
 */
export interface CauseWords {
  /** Joins the placed plan to a neighbour on the same floor. */
  beside: string;
  /** …to one underneath it. 'Bedroom **above** the kitchen'. */
  above: string;
  /** …and to one over its head. 'Kitchen **under** the bedroom'. */
  below: string;
  /** Joins two neighbours when both fired. */
  and: string;
  /** What to call the inherited fabric when it is the neighbour. */
  fabric: string;
  /**
   * How to describe standing in each band — 'facing the street', 'in the shadow
   * of the house'. Keyed on `Position` rather than `Orientation` because two
   * bands face north and they are not the same place to be.
   */
  facing: Record<Position, string>;
}

/**
 * §9.3 — one thing the finished house has taken on, and the conditions that
 * make it the right thing to say.
 *
 * These used to be one fixed line per consent flag. Four flags, and nearly every
 * house collects nearly all of them: 400 games produced **three** distinct
 * obligation pairs, one of which printed in 337 of them. The report's last words
 * before the closing line were effectively fixed text.
 *
 * So they are chosen the way `ClosingLine` is chosen — the most specific writing
 * that fits — and the conditions are the house's *consent profile* rather than
 * its character. That boundary is deliberate: what the house is like is the
 * closing line's job, and an obligation that reads like a second closing line is
 * not an obligation.
 */
export interface ObligationLine {
  line: string;
  /**
   * What this line is about, and the whole of the redundancy fix: the report has
   * room for two obligations and prints **at most one per subject**.
   *
   * Without it the report spent both lines on demolition in 84% of games —
   * "part of the old house is gone" followed by "what comes down has to be
   * recorded", which is one fact said twice with everything else squeezed out.
   */
  subject: string;

  /* Conditions. Every one present must hold; a line with none always fits. */

  /** The house took this flag on somewhere. */
  flag?: Consent;
  /** How much inherited fabric is still standing. */
  fabric?: 'all' | 'some' | 'none';
  /** At least this many placements need an application — §10.5 counts them. */
  minApplications?: number;
  /** §9.2 — only in a conservation area. */
  conservation?: true;
}

/**
 * §10.3 — one sentence naming what kind of house it turned out to be, and the
 * conditions that make it the right one. Derived from what is on the plot, not
 * from a score.
 *
 * Both axes are here because the GDD's own four examples use both: two are about
 * dominant qualities ("A house that asks a lot of you in spring"), and two are
 * about how much of the old house survived ("There is very little of the old
 * house left").
 *
 * A line with no conditions at all is a fallback, and there must be one.
 */
export interface ClosingLine {
  line: string;
  /** Every quality named here must be among the plot's dominant ones. */
  dominant?: Quality[];
  /** How much inherited fabric is still standing. */
  fabric?: 'all' | 'some' | 'none';
}

/* ------------------------------------------------------------------ *
 * The report — §10
 * ------------------------------------------------------------------ */

export interface PlacedPlan {
  id: Plan['id'];
  name: string;
  cell: CellId;
  round: number;
  /** This placement went onto inherited fabric — §7.2. */
  demolished: boolean;
}

/**
 * The finished house, prepared for content to read.
 *
 * The household's reactions in §10.4 need to know things about the plot — how
 * far the bathroom is from the front door, whether a door that closes exists at
 * all. Handing them a summary keeps `content.ts` free of engine imports, which
 * is what makes the fork surface in §16 a real boundary rather than a habit.
 */
export interface HouseSummary {
  /** Every placement, in the order it was made. */
  placed: readonly PlacedPlan[];
  /** Inherited fabric still standing. Empty means all of it came down. */
  fabricRemaining: readonly CellId[];
  /** §7 — fixed, and the same in every game. It came with the house. */
  frontDoor: CellId;
  /** Strongest first, across the whole plot. */
  dominant: readonly Quality[];
  /** Is this plan anywhere on the plot? */
  has: (id: Plan['id']) => boolean;
  /** Where it went, or null if it was never placed. */
  cellOf: (id: Plan['id']) => CellId | null;
  /** Steps between two plans, or null if either is missing. */
  distance: (a: Plan['id'], b: Plan['id']) => number | null;
  /** Steps from the front door, or null if that plan was never placed. */
  fromFrontDoor: (id: Plan['id']) => number | null;
}

/**
 * §10.2 — one thing you gained, and what it will ask of you for as long as you
 * have it. The unit the report is built from.
 */
export interface ReportPair {
  name: string;
  have: string;
  care: string;
}

/**
 * §10.2 — the report, assembled.
 *
 * It used to be three parallel columns, and playtesting found two problems with
 * that: it was too long to read, and the responsibility never resolved into any
 * felt sense of what it bought you — "I have no feeling of associating
 * responsibility and long-term care into a balanced feeling of long-term
 * benefit." Two lists side by side do not make a player connect item three of
 * one to item three of the other, and there is no reason they should.
 *
 * So the two columns become rows of `pairs`: each thing you gained sits beside
 * the thing it asks, and you cannot read one without the other. Three of them,
 * because three is what fits in the head, and the three that ask the most of
 * you, because those are the ones that will decide what living here is like.
 *
 * Cost was never a list, and the obligations the house took on (§9.3) are not
 * about any single plan — both stay as short lines underneath.
 */
/* ------------------------------------------------------------------ *
 * What you would actually have to submit — §9.1, §10.5
 * ------------------------------------------------------------------ */

/**
 * One route through the planning system, as `decision_times.csv` measured it.
 *
 * Every figure here is real and every figure here is about **London, not about
 * this house**. That distinction is §9.1 and it is not negotiable: the game
 * flags process and never predicts an outcome, so a rate quoted at the player
 * has to be visibly a rate about other people's applications.
 */
export interface PlanningRoute {
  /** 'a householder application' — for a sentence about one of them. */
  one: string;
  /** 'householder applications' — for a sentence about several. */
  many: string;
  /** How many of them were decided in the export. */
  decided: number;
  /**
   * The **median** wait, in days. Not the mean: decision times have a long
   * right tail, and the mean overstates the wait by five weeks on the routes
   * where it matters most. See the `decision_times` block in `queries.sql`.
   */
  medianDays: number;
  /** Permitted or permitted-with-conditions, as a share of decided. */
  approvedPct: number;
}

/**
 * §10.5 — the figures the closing planning statement is built from, and the
 * one place a fork points it at its own city.
 *
 * Deleting this block deletes the section. That is deliberate: a fork whose
 * building is not in London, or that has no equivalent data, should be able to
 * say nothing rather than say something borrowed.
 */
export interface PlanningData {
  /** Where the numbers came from, printed under them. */
  source: string;
  /** Keyed by whatever `ui.report.planning` asks for. */
  routes: Record<string, PlanningRoute>;
}

/**
 * §10.5 — what this house would actually have to submit, or null if it would
 * not have to submit anything.
 *
 * Assembled here rather than in a component so that the one rule §9.1 turns on
 * — *this is a statement about the dataset, never about your house* — is
 * enforced by a type rather than by remembering. There is nowhere in this shape
 * to put a verdict.
 */
export interface PlanningStatement {
  /** Whether an application is needed at all, in a sentence. */
  needed: string;
  /** Which route, and how many placements go through it. Empty if none do. */
  route: string;
  /** How long, and how often it went through — for other people. Empty if none. */
  record: string;
  /** Attribution, printed small. Empty if there is nothing to attribute. */
  source: string;
}

/**
 * One placement, as the planning system would see it.
 *
 * Per placement rather than per house, because a house is not on one route.
 * Take part of the old building down inside a conservation area and *that*
 * placement is its own consent; the other nine are still ordinary householder
 * applications, and a section that called all ten conservation consent would be
 * overstating by nine.
 */
export interface PlanningNeed {
  /** §9.1 — everything this placement took on. `permitted` alone needs nothing. */
  flags: readonly Consent[];
  /** §7.2 — this placement went onto the old house. */
  demolished: boolean;
  /** §9.2 — the config flag, because it changes which door you go through. */
  conservation: boolean;
}

/**
 * §10.5 — the writing, the figures, and which door this house goes through.
 *
 * `routeFor` is content rather than engine on purpose. Which application you
 * make is a fact about a planning system, not about a grid: a fork in another
 * city has different doors, and one with no planning system at all returns
 * null from every branch and gets a game that never mentions it.
 */
export interface PlanningContent {
  data: PlanningData;
  copy: PlanningCopy;
  /** A key into `data.routes`, or null for "nothing to submit". */
  routeFor: (need: PlanningNeed) => string | null;
}

/** §10.5, §16 — every word of the planning statement. */
export interface PlanningCopy {
  heading: string;
  /** When nothing here needs an application at all. */
  none: string;
  /** When something does. */
  needed: string;
  /**
   * 'Four of these are householder applications.'
   *
   * `applications` is everything needing permission; `onRoute` is how many go
   * through this particular door. They are usually the same number and the copy
   * has to handle them not being.
   */
  route: (applications: number, onRoute: number, route: PlanningRoute) => string;
  /** What happened to other people's. Never to this house — §9.1. */
  record: (route: PlanningRoute) => string;
  source: string;
}

export interface Report {
  /** Heaviest first. At most three — see `REPORT_PAIRS`. */
  pairs: ReportPair[];
  /** A phrase, never a number. */
  cost: string;
  /**
   * §9.3 — the consent this house has taken on, condensed. Not per-plan, which
   * is why it cannot be paired: three householder applications are one
   * relationship with the local authority, not three.
   */
  obligations: string[];
  /**
   * §10.5 — what you would have to submit. Null when nothing here needs an
   * application, and null when a fork has removed `planningData` entirely.
   */
  planning: PlanningStatement | null;
  closing: string;
  /** §10.4 — the situation the game opened on, answered. One line. */
  answer: string;
}

/* ------------------------------------------------------------------ *
 * Preservation — §9.2
 * ------------------------------------------------------------------ */

/**
 * §9.2 — the four deltas behind `conservation: true`. One config flag changes
 * the character of the whole game without the engine knowing what a
 * conservation area is: it asks content what changes and applies it.
 *
 * A participant forking the game gets the same lever for free. Point these at
 * whatever their building is actually constrained by.
 */
export interface ConservationOverrides {
  /**
   * A plan with a street-facing opening, placed in the north rows. Its own
   * consent flag stands; this is taken on as well.
   */
  northOpening: { consent: Consent; care: string };
  /** Taking any of the old house down. Replaces the ordinary demolition line. */
  demolition: { consent: Consent; care: string };
  /**
   * Per-plan deltas: a different flag, an extra obligation, or both. The GDD
   * names two — the heat pump's outdoor unit and the glass extension's ridge.
   */
  plans: Record<Plan['id'], { consent?: Consent; care?: string }>;
}

/* ------------------------------------------------------------------ *
 * The situation — §2, §10.4
 * ------------------------------------------------------------------ */

/**
 * §2 — why this house has to change, for the people who will live in it.
 *
 * One per game, drawn from the pool by the game's seed. It replaces the fixed
 * three-person household the prototype opened with: playtesting found that
 * three people introduced at once were all forgotten by round three, and that
 * the specifics of *whose* daughter played *which* instrument were doing none
 * of the work. One circumstance, common enough that most players have been in
 * it or near it, is remembered — and it is a much stronger replay driver, since
 * the same deck answered against a different situation is a different house.
 */
export interface Situation {
  id: string;
  /** The one sentence shown before round 1. */
  line: string;
  /**
   * §10.4 — one line about the finished house. A reaction, not a verdict:
   * nothing here says the house is good or bad, only what it will be like to
   * live in it in these circumstances.
   */
  reaction: (house: HouseSummary) => string;
}

/**
 * The situation before there is a house to answer it. The intro needs only the
 * line; the reaction is written against a finished plot.
 */
export type SituationIntro = Omit<Situation, 'reaction'>;

/* ------------------------------------------------------------------ *
 * Teaching it — §13, §14
 * ------------------------------------------------------------------ */

/**
 * What the game is and how it is played, in the fewest words that work.
 *
 * Shown once before round 1 and available from the header for the whole game.
 * Playtesting found the two things a first-time player did not know, and both
 * are the game's own fault rather than theirs: what they were being asked to
 * *do*, and that the old rooms could be taken down at all. A no-fail game has
 * no failure to teach through, so it has to say.
 */
export interface Rules {
  /** One sentence: what you are doing and that there is no way to lose. */
  objective: string;
  /** The rules a player cannot infer from the board. Keep it to a handful. */
  points: string[];
}

/**
 * Every other word the interface says — GDD §16.
 *
 * The M12 fork-surface audit found about twenty of these hard-coded in
 * components, which quietly broke the promise §16 makes. A participant pointing
 * the game at a hospice garden has no street, is not "building on" anything,
 * and does not "take down" a wall — and none of that was reachable without
 * opening a `.tsx` file.
 *
 * It is not glamorous content, but it is the difference between a fork and a
 * rewrite. Everything a player can read now lives in `content.ts`.
 */
export interface InterfaceCopy {
  /** The game's own name, in the header. */
  title: string;
  /** Dismisses the framing and starts round 1. */
  begin: string;
  /** Opens the rules from the header, and the heading on the card itself. */
  rules: { open: string; heading: string; close: string };

  /** §13 — what to do next, above the hand. */
  prompt: {
    choose: string;
    /** One per `where`: which part of the building this plan belongs to. */
    place: Record<Where, string>;
  };

  /** §5, §12 — the labels on and around the plot. */
  plot: {
    /** §5 — one heading per level, top to bottom. */
    levels: Record<Level, string>;
    /** §5 — what the switcher between the levels is called, for screen readers. */
    levelPicker: string;
    /** §5 — what the cell above the stair is called. */
    landing: string;
    street: string;
    garden: string;
    /** The aside after the garden label — '· sun from the south'. */
    sun: string;
    /** The quiet label under every cell that came with the building. */
    inherited: string;
    /** For screen readers: how to describe a cell that holds nothing. */
    empty: string;
    /** …and the one cell that can never be built on (§7). */
    fixed: string;
  };

  /** §8.6 — how to dismiss the line. */
  observation: { dismiss: string };

  /** §7.2, §13 — the only confirmation in the game. */
  demolition: {
    /** What is about to happen, given what is there and what is going there. */
    line: (standing: string, cell: CellId, plan: string) => string;
    note: string;
    confirm: string;
    cancel: string;
  };

  /** §10, §15 — the payoff, and the way back to a new game. */
  report: {
    finished: string;
    have: string;
    care: string;
    cost: string;
    obligations: string;
    /** §10.5 — what you would actually have to submit. */
    planning: PlanningCopy;
    again: string;
  };
}

/* ------------------------------------------------------------------ *
 * Game state
 * ------------------------------------------------------------------ */

export type Phase = 'intro' | 'play' | 'report';

export interface Placement {
  planId: Plan['id'];
  cell: CellId;
  /** 1-based. */
  round: number;
  /** True when this placement went onto inherited fabric — §7.2. */
  demolished: boolean;
}

export interface GameState {
  phase: Phase;
  /**
   * §2 — which situation this game is being played for, drawn from the seed so
   * that one number still reproduces a whole game.
   */
  situationId: string;
  /** 1-based, up to `Config.rounds`. */
  round: number;
  /** Plan ids dealt this round. Never carried over — §6. */
  hand: Plan['id'][];
  selectedPlanId: Plan['id'] | null;
  placements: Placement[];
  /** Inherited fabric still standing. Starts as whatever `PlotContent` says. */
  fabric: CellId[];
  /**
   * §7 — fixed for the whole game. The front door is the one thing about this
   * house the player cannot change, which is what makes it the house they were
   * left rather than a plot they were given.
   */
  frontDoor: CellId;
  /**
   * §5, §7 — the two cells the stair occupies: the flight on the ground floor
   * and the landing it arrives at on the first. Both are fixed for the whole
   * game, for the same reason the front door is.
   *
   * The landing is what makes the first floor reachable at all. §7.1 says a
   * placement has to touch something already standing, and without one occupied
   * cell up there nothing upstairs would ever be legal.
   */
  stair: CellId;
  landing: CellId;
  /**
   * §5 — the first garden row, carried here for the same reason as `frontDoor`:
   * it is decided by content before round 1 and then fixed, and every legality
   * check needs it. Materialising the setup into the state keeps `engine/grid.ts`
   * pure geometry with nothing to look up.
   */
  gardenFromRow: Row;
  /**
   * §8.6 — the line for the placement just made, or null for silence.
   *
   * Not a string: it carries what caused it as well as what it says, so the
   * plot can light the cells the sentence is about while the sentence is being
   * read. See `Observation` in `engine/adjacency.ts`.
   */
  observation: Observation | null;
  /**
   * §7.2, §13 — the fabric cell a placement is waiting on confirmation for.
   * Demolition is the only irreversible move in the game and the only one that
   * asks. Null the rest of the time, which is nearly always.
   */
  pendingDemolition: CellId | null;
  /** Plan ids not yet placed. */
  pool: Plan['id'][];
  seed: number;
}

/* ------------------------------------------------------------------ *
 * Configuration and content
 * ------------------------------------------------------------------ */

export interface Config {
  /** §6 [Open] — playtest 6 against 8 before settling. */
  rounds: number;
  /**
   * §9.2 — one flag that changes the character of the whole game. What it
   * changes is `conservationOverrides`, which is content, so the engine never
   * learns what a conservation area is.
   */
  conservation: boolean;
}

/**
 * Everything a participant would change. See GDD §16: swapping the deck for a
 * community centre, a co-op office or a hospice garden should never require
 * opening a file that isn't this one or `theme.css`.
 */
export interface Content {
  /** §2 — the single line explaining why the work is happening at all. */
  whyNow: string;
  /** §13, §14 — what the game is, for someone who has never played it. */
  rules: Rules;
  /** §5 — the building that was already there, and where the garden starts. */
  plot: PlotContent;
  /** §2 — the pool the game draws one from. */
  situations: Situation[];
  deck: Plan[];
  pairLines: PairLine[];
  qualityLines: QualityLine[];
  /** Strongest first. Breaks ties when several quality matches fire — §8.6. */
  qualitySeverity: Quality[];
  /** §10.2 — a phrase per aggregate cost, never a number. */
  costPhrases: string[];
  closingLines: ClosingLine[];
  /** §9.3 — consent lands inside 'what you'll look after', not its own section. */
  consentCare: Record<Consent, string>;
  /** §9.2 — what `conservation: true` changes. */
  conservationOverrides: ConservationOverrides;
}
