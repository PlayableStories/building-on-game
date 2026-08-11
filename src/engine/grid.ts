/**
 * The plot — GDD §5, §7.
 *
 * Three levels of a 5×5 grid: the ground floor with the garden behind it, a
 * first floor over the rooms, and the roof on top of whatever is built. What is
 * already standing on it — the front door, the stair and landing, the old rooms
 * — is content, not geometry, and arrives in `GameState` from `PlotContent`.
 *
 * Everything here is pure geometry and pure state inspection; nothing in this
 * module knows what a plan says.
 */
import {
  COLUMNS,
  LEVELS,
  LEVEL_CODE,
  ROWS,
  type CellId,
  type Column,
  type GameState,
  type Level,
  type Orientation,
  type Relation,
  type Row,
  type Where,
} from '../types.ts';

export const ALL_CELLS: readonly CellId[] = LEVELS.flatMap((level) =>
  ROWS.flatMap((row) => COLUMNS.map((column) => cellId(level, column, row))),
);

export function cellId(level: Level, column: Column, row: Row): CellId {
  return `${LEVEL_CODE[level]}${column}${row}`;
}

const LEVEL_BY_CODE = Object.fromEntries(
  LEVELS.map((level) => [LEVEL_CODE[level], level]),
) as Record<string, Level>;

export function parseCell(cell: CellId): { level: Level; column: Column; row: Row } {
  // A CellId is always one level code, one column letter and one row digit.
  return {
    level: LEVEL_BY_CODE[cell[0] as string] as Level,
    column: cell[1] as Column,
    row: Number(cell[2]) as Row,
  };
}

export function levelOf(cell: CellId): Level {
  return parseCell(cell).level;
}

/** The same column and row, one level up or down. Null at the top and bottom. */
export function above(cell: CellId): CellId | null {
  const { level, column, row } = parseCell(cell);
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  return next === undefined ? null : cellId(next, column, row);
}

export function below(cell: CellId): CellId | null {
  const { level, column, row } = parseCell(cell);
  const under = LEVELS[LEVELS.indexOf(level) - 1];
  return under === undefined ? null : cellId(under, column, row);
}

/**
 * §5 — the house in front, the garden behind. Ground floor only: there is no
 * garden on the first floor, and the rows above the garden are simply not part
 * of the building.
 */
export function isGarden(cell: CellId, gardenFromRow: Row): boolean {
  return parseCell(cell).row >= gardenFromRow;
}

/**
 * §5 — where in the plot a row sits, front to back. Five bands, and they mean
 * five different things to stand in.
 */
export const POSITIONS = ['street', 'middle', 'back', 'shadow', 'garden'] as const;
export type Position = (typeof POSITIONS)[number];

const POSITION_BY_ROW: Record<Row, Position> = {
  1: 'street',
  2: 'middle',
  3: 'back',
  4: 'shadow',
  5: 'garden',
};

/**
 * §5 — which way each band faces. The sun is in the south, so `north` is the
 * cold side and `south` the bright one, in both halves of the plot:
 *
 *   1  street  north  the street elevation, and the shaded front of the house
 *   2  middle  —      the middle of the house, facing nothing in particular
 *   3  back    south  the back of the house, onto the garden
 *   4  shadow  north  garden, but under the shadow the building casts behind it
 *   5  garden  south  open garden, and the sun from lunchtime onwards
 *
 * Row 4 is north-facing for the same reason row 1 is: the thing to its north is
 * what it spends the day behind. Indoors that is the street; outdoors it is the
 * house. So a plan's north line covers both — the sun is somewhere else, and
 * this is what that costs you.
 *
 * Row 2 faces nothing on purpose. Every part of the plot needs somewhere that is simply
 * inside it, or an orientation line fires on nearly every placement and stops
 * being worth reading.
 *
 * Height does not change any of this. A first-floor front bedroom faces the
 * street exactly as the room under it does, and a dormer on the front slope is
 * the most street-facing thing a house has.
 */
const FACING: Record<Position, Orientation | null> = {
  street: 'north',
  middle: null,
  back: 'south',
  shadow: 'north',
  garden: 'south',
};

export function positionOf(cell: CellId): Position {
  return POSITION_BY_ROW[parseCell(cell).row];
}

export function orientationOf(cell: CellId): Orientation | null {
  return FACING[positionOf(cell)];
}

/**
 * §5, §9.2 — the face of the building the street can see, which is row 1 and
 * only row 1, at any height.
 *
 * Deliberately not "faces north": the garden's shaded strip faces north too,
 * and nobody applies for consent to put a lawn behind a house. §9.2's rule
 * about openings is about the street rather than about the sun.
 */
export function isStreetElevation(cell: CellId): boolean {
  return positionOf(cell) === 'street';
}

/**
 * §8.6 — every cell a placement is read against: the four beside it, the one
 * under it and the one over it.
 *
 * **This is not `orthogonalNeighbours`, and the difference is load-bearing.**
 * §7.1's frontier rule asks a different question — what may I build against —
 * and it has to stay flat. Give it the cell below and every first-floor cell
 * over a room touches something by definition, so the frontier upstairs
 * evaporates and the first floor can be built in any order from anywhere. Two
 * questions, two functions.
 */
export function adjacentCells(cell: CellId): { cell: CellId; how: Relation }[] {
  const adjacent: { cell: CellId; how: Relation }[] = orthogonalNeighbours(cell).map(
    (near) => ({ cell: near, how: 'beside' }),
  );

  // Named from the placement's point of view: the cell underneath is the one
  // this placement is *above*.
  const under = below(cell);
  if (under !== null) adjacent.push({ cell: under, how: 'above' });
  const over = above(cell);
  if (over !== null) adjacent.push({ cell: over, how: 'below' });

  return adjacent;
}

/** Orthogonal, and on the same level. Diagonals are not neighbours — §7.1. */
export function orthogonalNeighbours(cell: CellId): CellId[] {
  const { level, column, row } = parseCell(cell);
  const columnIndex = COLUMNS.indexOf(column);
  const rowIndex = ROWS.indexOf(row);

  const candidates: [number, number][] = [
    [columnIndex - 1, rowIndex],
    [columnIndex + 1, rowIndex],
    [columnIndex, rowIndex - 1],
    [columnIndex, rowIndex + 1],
  ];

  const neighbours: CellId[] = [];
  for (const [c, r] of candidates) {
    const neighbourColumn = COLUMNS[c];
    const neighbourRow = ROWS[r];
    if (neighbourColumn === undefined || neighbourRow === undefined) continue;
    neighbours.push(cellId(level, neighbourColumn, neighbourRow));
  }
  return neighbours;
}

export function placementAt(state: GameState, cell: CellId) {
  return state.placements.find((placement) => placement.cell === cell);
}

export function isFabric(state: GameState, cell: CellId): boolean {
  return state.fabric.includes(cell);
}

/**
 * §7 — the three cells that came with the house and stay with it: the front
 * door, the stair, and the landing the stair arrives at. All are occupied for
 * adjacency, so every level has somewhere to build from, and none is ever a
 * legal placement, so none can be built over.
 */
export function isFixed(state: GameState, cell: CellId): boolean {
  return cell === state.frontDoor || cell === state.stair || cell === state.landing;
}

/** The old house counts as occupied for adjacency — §7.1. */
export function isOccupied(state: GameState, cell: CellId): boolean {
  return placementAt(state, cell) !== undefined || isFabric(state, cell) || isFixed(state, cell);
}

/** A cell with something standing in it that could hold a floor above. */
function holdsRoom(state: GameState, cell: CellId | null): boolean {
  if (cell === null) return false;
  if (isGarden(cell, state.gardenFromRow)) return false;
  return isOccupied(state, cell);
}

/**
 * §5, §7 — every cell this plan may legally go in.
 *
 * Four rules, one per `where`, all of them composed with the two constants: a
 * cell already holding a placement is never legal again (§7.3), and the fixed
 * cells are never legal at all.
 *
 *   house     ground floor, in front of the garden, touching what is standing
 *   garden    ground floor, behind the house, touching what is standing
 *   upstairs  first floor, over a room, touching what is standing up there
 *   roof      on top of the building, at whatever height that turns out to be
 *
 * **Two things are worth reading twice.**
 *
 * The roof does not use the frontier rule. What a roof cell touches is the
 * thing underneath it, which is already connected to the rest of the building
 * by the rules that let it be built — so requiring roof cells to touch each
 * other as well would forbid roofing a detached corner for no reason a player
 * could infer.
 *
 * And roofing a cell commits it: once something is on the roof at a column and
 * row, the first floor beneath it can never be built. You roofed it, so you
 * cannot build up there now. That is the one genuinely new irreversible move
 * since §7.3, and the rules card has to say so.
 *
 * **The plot can never lock.** The old rooms stay occupied whether or not they
 * are demolished, so the ground floor always has a frontier; the landing is
 * always occupied, so the first floor always has one; and the roof is available
 * from round one, because the house the player inherited already has a roof.
 * There is a test that plays this out rather than only asserting it.
 */
export function legalCells(state: GameState, where: Where): CellId[] {
  const legal = new Set<CellId>();

  for (const cell of ALL_CELLS) {
    if (placementAt(state, cell) !== undefined) continue;
    if (isFixed(state, cell)) continue;

    const { level } = parseCell(cell);
    const garden = isGarden(cell, state.gardenFromRow);
    const touching = orthogonalNeighbours(cell).some((near) => isOccupied(state, near));

    switch (where) {
      case 'house':
        // An inherited room is always legal, so demolition is never locked away
        // behind building up to it.
        if (level === 'ground' && !garden && (isFabric(state, cell) || touching)) {
          legal.add(cell);
        }
        break;

      case 'garden':
        if (level === 'ground' && garden && touching) legal.add(cell);
        break;

      case 'upstairs':
        if (
          level === 'first' &&
          holdsRoom(state, below(cell)) &&
          touching &&
          // …and nothing has been roofed over this column and row.
          !isOccupied(state, above(cell) as CellId)
        ) {
          legal.add(cell);
        }
        break;

      case 'roof': {
        if (level !== 'roof') break;
        const first = below(cell) as CellId;
        // On top of the first floor if there is one there, and otherwise on top
        // of the ground floor — the roof sits on whatever is highest.
        const onTop = isOccupied(state, first)
          ? true
          : holdsRoom(state, below(first));
        if (onTop) legal.add(cell);
        break;
      }
    }
  }

  return ALL_CELLS.filter((cell) => legal.has(cell));
}

export function isLegalCell(state: GameState, cell: CellId, where: Where): boolean {
  return legalCells(state, where).includes(cell);
}
