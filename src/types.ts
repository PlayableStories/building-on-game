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
 * §5 — row 1 is the street (north), row 5 is the garden (south), sun comes from
 * the south. Row 3 is neither, and plans placed there get no orientation line.
 */
export type Orientation = 'north' | 'south';

/* ------------------------------------------------------------------ *
 * The deck — §8.2
 * ------------------------------------------------------------------ */

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
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
 * block, and which tier it is drawn from. The grid and the draw never read the
 * writing, so they are typed against this rather than the whole `Plan` — which
 * also lets M1 ship a deck that has not been written yet.
 */
export type PlanIdentity = Pick<Plan, 'id' | 'name' | 'tier'>;

/**
 * What the adjacency resolution in §8.6 needs: which plan it is, what it puts
 * into its neighbours, what it suffers from, and how it behaves north or south.
 * Still not the writing for the report, which arrives with M4.
 */
export type PlanAdjacency = PlanIdentity &
  Pick<Plan, 'emits' | 'sensitive' | 'orientation'>;

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

/** §10.3 — a closing line and the quality profile that selects it. */
export interface ClosingLine {
  line: string;
  /** Dominant qualities across the plot that make this line the right one. */
  dominant: Quality[];
}

/* ------------------------------------------------------------------ *
 * The household — §2, §10.4
 * ------------------------------------------------------------------ */

export interface HouseholdMember {
  id: string;
  /** 'Your daughter, 14' */
  name: string;
  /** The one-sentence setup shown before round 1. */
  line: string;
  /** §10.4 — a reaction to the finished house. Not a verdict. */
  reaction: (state: GameState) => string;
}

/**
 * Who the house is for, before the house exists to react to. The intro needs
 * only the setup lines; the reactions in §10.4 are written against a finished
 * plot and arrive with the report in M4.
 */
export type HouseholdIntro = Omit<HouseholdMember, 'reaction'>;

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
  /** 1-based, up to `Config.rounds`. */
  round: number;
  /** Plan ids dealt this round. Never carried over — §6. */
  hand: Plan['id'][];
  selectedPlanId: Plan['id'] | null;
  placements: Placement[];
  /** Inherited fabric still standing. Starts as B2, C2, B3, C3 — §5. */
  fabric: CellId[];
  /** Null once B2 has been demolished — §7. */
  frontDoor: CellId | null;
  /** The one line for the placement just made, or null for silence — §8.6. */
  observation: string | null;
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
  /** §9.2 — one flag that changes the character of the whole game. */
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
  household: HouseholdMember[];
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
}
