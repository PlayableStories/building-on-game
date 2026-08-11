/**
 * What just ended up next to what — GDD §8.6.
 *
 * When a plan is placed, the game checks each neighbour — the four beside it,
 * and since §5 gave the house floors, the one under it and the one over it —
 * and resolves in a strict order:
 *
 *   1. explicit pair    — a written line for this exact pairing
 *   2. quality match    — an emitted quality meeting a neighbour sensitive to it
 *   3. orientation      — the plan's row triggers its orientation line
 *   4. nothing          — silence is a valid result
 *
 * **One line per placement, maximum.** If several fire, the explicit pair wins,
 * then the strongest quality match, then orientation.
 *
 * Every result also carries *why*. Playtesting found the mechanic the whole
 * prototype exists to test was landing as atmosphere: "I do not aware the line
 * is directly related to my placement and/or the neighbour." The resolution has
 * always known which neighbour fired — it simply threw the answer away and
 * returned a sentence. Now it returns the cells too, so the plot can light them
 * while the sentence is being read.
 *
 * A floor is not a wall. Noise, smell and damp travel through one as readily as
 * the other — which is why the quality step needed no change at all — but the
 * *phrasing* has to know the difference, and a pair line written for two rooms
 * sharing a wall does not automatically hold for two rooms sharing a ceiling.
 * So `Neighbour` carries a `Relation`, and a pair line fires sideways unless it
 * says `over`.
 *
 * The writing all lives in `content.ts`, including the handful of connecting
 * words used to name a cause. This module decides which line to ask for and
 * which cells it is about; it does not know English.
 */
import type {
  CauseWords,
  CellId,
  Observation,
  PairLine,
  PlanAdjacency,
  Position,
  Quality,
  QualityLine,
  Relation,
} from '../types.ts';
import { orientationOf, positionOf } from './grid.ts';

export type { CauseWords, Observation };

/**
 * A cell the placement is read against: either something the player placed, or
 * the old house. `how` is where it stands relative to the placement — beside it,
 * under it, or over it.
 */
export type Neighbour = { how: Relation } & (
  | { kind: 'plan'; cell: CellId; plan: PlanAdjacency }
  | { kind: 'fabric'; cell: CellId }
);

export interface AdjacencyContent {
  pairLines: readonly PairLine[];
  qualityLines: readonly QualityLine[];
  /** Strongest first. Breaks ties when several quality matches fire. */
  qualitySeverity: readonly Quality[];
  causeWords: CauseWords;
}

/** What a resolution step found, before it is turned into an `Observation`. */
interface Match {
  line: string;
  because: CellId[];
  /** What the placed plan is being read against, for the cause phrase. */
  against: Neighbour[];
}

function targetMatches(target: PairLine['b'], neighbour: Neighbour): boolean {
  if (target === '*') return true;
  if (target === 'fabric') return neighbour.kind === 'fabric';
  return neighbour.kind === 'plan' && neighbour.plan.id === target;
}

/** What to call a neighbour in a cause phrase. */
function nameOf(neighbour: Neighbour, words: CauseWords): string {
  return neighbour.kind === 'fabric' ? words.fabric : neighbour.plan.name;
}

/** Deduplicated, in the order the neighbours were found. */
function namesOf(neighbours: readonly Neighbour[], words: CauseWords): string[] {
  const names: string[] = [];
  for (const neighbour of neighbours) {
    const name = nameOf(neighbour, words);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * A fixed order rather than the order the neighbours happened to arrive in, so
 * the same relationship reads the same way every time it fires.
 */
const RELATIONS: readonly Relation[] = ['beside', 'above', 'below'];

/**
 * The phrase above the line: what was placed, and what it is being read against,
 * grouped by how each neighbour stands to it.
 *
 * 'Bedroom above the kitchen' · 'Bathroom beside the landing and above the hall'
 *
 * Naming the relationship is the whole point. M10 fixed a line reading as
 * atmosphere by saying *which two things*; on a house with floors, saying "the
 * bedroom beside the kitchen" about a bedroom on the floor above would put the
 * fix straight back where it started.
 */
function causeOf(
  placedName: string,
  on: readonly Neighbour[],
  words: CauseWords,
): string {
  const phrases: string[] = [];
  for (const how of RELATIONS) {
    const names = namesOf(
      on.filter((neighbour) => neighbour.how === how),
      words,
    );
    if (names.length > 0) phrases.push(`${words[how]} ${names.join(` ${words.and} `)}`);
  }
  return `${placedName} ${phrases.join(` ${words.and} `)}`;
}

/**
 * Specific writing beats general writing. A line naming both plans is better
 * than one naming the old walls, which is better than "beside anything" — so a
 * wildcard rule can be added to the deck without drowning everything near it.
 */
function specificity(line: PairLine): number {
  if (line.b === '*') return 0;
  if (line.b === 'fabric') return 1;
  return 2;
}

function explicitPair(
  content: AdjacencyContent,
  placed: PlanAdjacency,
  neighbours: readonly Neighbour[],
): Match | null {
  /**
   * The neighbours this line is about, which is what the plot will light.
   *
   * `over` lines are directional — `a` on top of `b` — so which end of the pair
   * was just placed decides which way to look. A plain line is about the same
   * floor and looks sideways only.
   */
  function firedOn(line: PairLine): Neighbour[] {
    const wanted: Relation = line.over === undefined ? 'beside' : 'above';

    // Matched in either direction: the pair is a relationship, not a sequence.
    if (line.a === placed.id) {
      return neighbours.filter(
        (neighbour) => neighbour.how === wanted && targetMatches(line.b, neighbour),
      );
    }
    if (line.b === placed.id) {
      // Placed as the underneath half: the other end is the one over its head.
      const other: Relation = wanted === 'above' ? 'below' : 'beside';
      return neighbours.filter(
        (neighbour) => neighbour.how === other && targetMatches(line.a, neighbour),
      );
    }
    return [];
  }

  const matches = content.pairLines
    .map((line) => ({ line, on: firedOn(line) }))
    .filter((match) => match.on.length > 0);

  if (matches.length === 0) return null;

  let best = matches[0] as (typeof matches)[number];
  for (const match of matches) {
    if (specificity(match.line) > specificity(best.line)) best = match;
  }

  return {
    line: best.line.line,
    because: best.on.map((neighbour) => neighbour.cell),
    against: best.on,
  };
}

/**
 * §8.6 — an emitted quality meeting a neighbour sensitive to it. Both
 * directions count: what the new plan does to its neighbours, and what they do
 * to it. Where several fire, the strongest wins, ranked by an order that lives
 * in content rather than here.
 */
function qualityMatch(
  content: AdjacencyContent,
  placed: PlanAdjacency,
  neighbours: readonly Neighbour[],
): Match | null {
  /** Which neighbours are involved in a given quality, in either direction. */
  const involved = new Map<Quality, Neighbour[]>();

  const note = (quality: Quality, neighbour: Neighbour) => {
    const already = involved.get(quality) ?? [];
    if (!already.includes(neighbour)) already.push(neighbour);
    involved.set(quality, already);
  };

  for (const neighbour of neighbours) {
    if (neighbour.kind !== 'plan') continue;

    for (const quality of placed.emits) {
      if (neighbour.plan.sensitive.includes(quality)) note(quality, neighbour);
    }
    for (const quality of neighbour.plan.emits) {
      if (placed.sensitive.includes(quality)) note(quality, neighbour);
    }
  }

  if (involved.size === 0) return null;

  const strongest = content.qualitySeverity.find((quality) => involved.has(quality));
  if (strongest === undefined) return null;

  const line = content.qualityLines.find((entry) => entry.quality === strongest)?.line;
  if (line === undefined) return null;

  const on = involved.get(strongest) as Neighbour[];
  return { line, because: on.map((neighbour) => neighbour.cell), against: on };
}

/**
 * §8.6 — which way the cell it landed in faces. Nothing fires in the rows that
 * face nothing, which is what keeps this from speaking on every placement.
 */
function orientation(
  placed: PlanAdjacency,
  cell: CellId,
): { line: string; where: Position } | null {
  const facing = orientationOf(cell);
  if (facing === null) return null;
  const line = placed.orientation?.[facing];
  // The line is chosen by the compass; the cause names the band. Both come off
  // the same map, and they are different answers — see `positionOf`.
  return line === undefined ? null : { line, where: positionOf(cell) };
}

/**
 * The one line for a placement, or null for silence.
 *
 * §11's discovery reveals, if they are ever built, resolve in front of all of
 * this — a reveal fires once and takes the place of that placement's line.
 */
export function observationFor(
  content: AdjacencyContent,
  placed: PlanAdjacency,
  cell: CellId,
  neighbours: readonly Neighbour[],
): Observation | null {
  const words = content.causeWords;

  const pair = explicitPair(content, placed, neighbours);
  if (pair) {
    return {
      line: pair.line,
      kind: 'pair',
      cell,
      because: pair.because,
      cause: causeOf(placed.name, pair.against, words),
    };
  }

  const quality = qualityMatch(content, placed, neighbours);
  if (quality) {
    return {
      line: quality.line,
      kind: 'quality',
      cell,
      because: quality.because,
      cause: causeOf(placed.name, quality.against, words),
    };
  }

  const facing = orientation(placed, cell);
  if (facing) {
    return {
      line: facing.line,
      kind: 'orientation',
      cell,
      // Nothing next door caused this one — where it landed did.
      because: [],
      cause: `${placed.name}, ${words.facing[facing.where]}`,
    };
  }

  return null;
}
