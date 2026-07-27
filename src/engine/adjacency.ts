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
 * The writing all lives in `content.ts`; this module only decides which line to
 * ask for. That is the split §8.6's design note is after — a participant can
 * rewrite every observation in the game without opening engine code.
 */
import type {
  CellId,
  PairLine,
  PlanAdjacency,
  Quality,
  QualityLine,
} from '../types.ts';
import { orientationOf } from './grid.ts';

/** A cell next door: either something the player placed, or the old house. */
export type Neighbour =
  | { kind: 'plan'; plan: PlanAdjacency }
  | { kind: 'fabric' };

export interface AdjacencyContent {
  pairLines: readonly PairLine[];
  qualityLines: readonly QualityLine[];
  /** Strongest first. Breaks ties when several quality matches fire. */
  qualitySeverity: readonly Quality[];
}

function targetMatches(target: PairLine['b'], neighbour: Neighbour): boolean {
  if (target === '*') return true;
  if (target === 'fabric') return neighbour.kind === 'fabric';
  return neighbour.kind === 'plan' && neighbour.plan.id === target;
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
): string | null {
  const matches = content.pairLines.filter((line) => {
    // Matched in either direction: the pair is a relationship, not a sequence.
    if (line.a === placed.id) {
      return neighbours.some((neighbour) => targetMatches(line.b, neighbour));
    }
    if (line.b === placed.id) {
      return neighbours.some((neighbour) => targetMatches(line.a, neighbour));
    }
    return false;
  });

  if (matches.length === 0) return null;

  let best = matches[0] as PairLine;
  for (const match of matches) {
    if (specificity(match) > specificity(best)) best = match;
  }
  return best.line;
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
): string | null {
  const fired = new Set<Quality>();

  for (const neighbour of neighbours) {
    if (neighbour.kind !== 'plan') continue;

    for (const quality of placed.emits) {
      if (neighbour.plan.sensitive.includes(quality)) fired.add(quality);
    }
    for (const quality of neighbour.plan.emits) {
      if (placed.sensitive.includes(quality)) fired.add(quality);
    }
  }

  if (fired.size === 0) return null;

  const strongest = content.qualitySeverity.find((quality) => fired.has(quality));
  if (strongest === undefined) return null;

  return content.qualityLines.find((line) => line.quality === strongest)?.line ?? null;
}

/**
 * §8.6 — the row a plan lands in. Rows 1–2 are the street, rows 4–5 the garden
 * and the sun; row 3 is neither, and nothing fires there.
 */
function orientation(placed: PlanAdjacency, cell: CellId): string | null {
  const facing = orientationOf(cell);
  if (facing === null) return null;
  return placed.orientation?.[facing] ?? null;
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
): string | null {
  return (
    explicitPair(content, placed, neighbours) ??
    qualityMatch(content, placed, neighbours) ??
    orientation(placed, cell)
  );
}
