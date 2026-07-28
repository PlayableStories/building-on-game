/**
 * What just ended up next to what — GDD §8.6.
 *
 * When a plan is placed, the game checks each orthogonal neighbour and resolves
 * in a strict order:
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
} from '../types.ts';
import { orientationOf, positionOf } from './grid.ts';

export type { CauseWords, Observation };

/** A cell next door: either something the player placed, or the old house. */
export type Neighbour =
  | { kind: 'plan'; cell: CellId; plan: PlanAdjacency }
  | { kind: 'fabric'; cell: CellId };

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
  /** Names of what the placed plan is being read against, deduplicated. */
  against: string[];
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
  /** The neighbours this line is about, which is what the plot will light. */
  function firedOn(line: PairLine): Neighbour[] {
    // Matched in either direction: the pair is a relationship, not a sequence.
    if (line.a === placed.id) {
      return neighbours.filter((neighbour) => targetMatches(line.b, neighbour));
    }
    if (line.b === placed.id) {
      return neighbours.filter((neighbour) => targetMatches(line.a, neighbour));
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
    against: namesOf(best.on, content.causeWords),
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
  return {
    line,
    because: on.map((neighbour) => neighbour.cell),
    against: namesOf(on, content.causeWords),
  };
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
      cause: `${placed.name} ${words.beside} ${pair.against.join(` ${words.and} `)}`,
    };
  }

  const quality = qualityMatch(content, placed, neighbours);
  if (quality) {
    return {
      line: quality.line,
      kind: 'quality',
      cell,
      because: quality.because,
      cause: `${placed.name} ${words.beside} ${quality.against.join(` ${words.and} `)}`,
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
