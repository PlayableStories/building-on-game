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

/** §6 — the four staged tiers, in the order the house gets built. */
export const TIERS = ['threshold', 'daily', 'private', 'outside'] as const;
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

/** A cell is named the way the GDD names it: 'B2', 'C3', 'E5'. */
export type CellId = `${Column}${Row}`;

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
 * §5 — the house, and the garden behind it.
 *
 * A plan belongs to one or the other and can only be placed there: a bathroom
 * does not go in the garden and a lawn does not go in the hall. The zone a cell
 * belongs to is decided by its row, which is why the plot reads as a building
 * with ground behind it rather than as twenty-five interchangeable squares.
 */
export type Zone = 'indoor' | 'outdoor';

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
  /** §5 — the house or the garden. It cannot be placed in the other one. */
  zone: Zone;
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
export type PlanIdentity = Pick<Plan, 'id' | 'name' | 'tier' | 'zone'>;

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
 * An explicit line for one exact pairing. Matched in either direction, and the
 * best writing in the game — used for the handful of pairs that deserve it.
 */
export interface PairLine {
  a: Plan['id'];
  b: PairTarget;
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
  /** Joins the placed plan to what it is being read against. */
  beside: string;
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

/** §10.2 — the three columns, assembled. */
export interface Report {
  have: string[];
  /** A phrase, never a number. */
  cost: string;
  /**
   * The longest column, deliberately. Plan obligations first, then the consent
   * the house has taken on, then what demolition leaves behind — §9.3 puts
   * consent inside this column rather than in a section of its own.
   */
  care: string[];
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
