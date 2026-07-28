/**
 * The plot — GDD §5, §7.
 *
 * A 5×5 grid, columns A–E and rows 1–5, divided into the house and the garden
 * behind it. What is already standing on it — the front door and the old rooms —
 * is content, not geometry, and arrives in `GameState` from `PlotContent`.
 *
 * Everything here is pure geometry and pure state inspection; nothing in this
 * module knows what a plan says.
 */
import {
  COLUMNS,
  ROWS,
  type CellId,
  type Column,
  type GameState,
  type Orientation,
  type Row,
  type Zone,
} from '../types.ts';

export const ALL_CELLS: readonly CellId[] = COLUMNS.flatMap((column) =>
  ROWS.map((row) => cellId(column, row)),
);

export function cellId(column: Column, row: Row): CellId {
  return `${column}${row}`;
}

export function parseCell(cell: CellId): { column: Column; row: Row } {
  // A CellId is always one column letter followed by one row digit.
  const column = cell[0] as Column;
  const row = Number(cell[1]) as Row;
  return { column, row };
}

/**
 * §5 — the house in front, the garden behind. A plan can only go in its own
 * zone, which is what stops the plot reading as twenty-five interchangeable
 * squares and starts it reading as a building with ground behind it.
 */
export function zoneOf(cell: CellId, gardenFromRow: Row): Zone {
  return parseCell(cell).row >= gardenFromRow ? 'outdoor' : 'indoor';
}

/**
 * §5 — which way a cell faces. The sun is in the south, so `north` means the
 * cold side and `south` the bright one, in both halves of the plot:
 *
 *   1  north  the street elevation, and the shaded front of the house
 *   2  —      the middle of the house, facing nothing in particular
 *   3  south  the back of the house, onto the garden
 *   4  north  garden, but under the shadow the building casts behind it
 *   5  south  open garden, and the sun from lunchtime onwards
 *
 * Row 4 is north-facing for the same reason row 1 is: the thing to its north is
 * what it spends the day behind. Indoors that is the street; outdoors it is the
 * house. So a plan's north line covers both — the sun is somewhere else, and
 * this is what that costs you.
 *
 * Row 2 faces nothing on purpose. Every zone needs somewhere that is simply
 * inside it, or an orientation line fires on nearly every placement and stops
 * being worth reading.
 */
export function orientationOf(cell: CellId): Orientation | null {
  const { row } = parseCell(cell);
  if (row === 1 || row === 4) return 'north';
  if (row === 3 || row === 5) return 'south';
  return null;
}

/**
 * §5, §9.2 — the face of the building the street can see, which is row 1 and
 * only row 1.
 *
 * Deliberately not "faces north": the garden's shaded strip faces north too,
 * and nobody applies for consent to put a lawn behind a house. The two ideas
 * were the same thing when the north rows were rows 1–2; they are not any more,
 * and §9.2's rule about openings is about the street rather than about the sun.
 */
export function isStreetElevation(cell: CellId): boolean {
  return parseCell(cell).row === 1;
}

/** Orthogonal only. Diagonals are not neighbours — §7.1. */
export function orthogonalNeighbours(cell: CellId): CellId[] {
  const { column, row } = parseCell(cell);
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
    neighbours.push(cellId(neighbourColumn, neighbourRow));
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
 * §7 — the front door came with the house and stays with it. It is occupied for
 * adjacency, so the first round has somewhere to build from, and it is never a
 * legal placement, so it cannot be built over.
 */
export function isFrontDoor(state: GameState, cell: CellId): boolean {
  return state.frontDoor === cell;
}

/** The old house counts as occupied for adjacency — §7.1. */
export function isOccupied(state: GameState, cell: CellId): boolean {
  return (
    placementAt(state, cell) !== undefined ||
    isFabric(state, cell) ||
    isFrontDoor(state, cell)
  );
}

/**
 * §5, §7 — every cell this plan may legally go in:
 *
 *   1. it is in the plan's own zone — a bathroom does not go in the garden, and
 *      a lawn does not go in the hall,
 *   2. it is not the front door, which is the one cell nothing can be built on,
 *   3. and it is either an inherited room, which demolishes it (§7.2), or an
 *      empty cell orthogonally adjacent to something already occupied.
 *
 * A cell that already holds a placement is never legal again — §7.3, nothing can
 * be moved or removed.
 *
 * **The plot can never lock:** a demolished room is replaced by the placement
 * that demolished it, so the cells the old house occupies stay occupied for the
 * whole game. Both zones therefore always touch something, and both always have
 * a frontier. There is a test that plays this out rather than only asserting it.
 */
export function legalCells(state: GameState, zone: Zone): CellId[] {
  const legal = new Set<CellId>();

  for (const cell of ALL_CELLS) {
    if (zoneOf(cell, state.gardenFromRow) !== zone) continue;
    if (isFrontDoor(state, cell)) continue;
    if (placementAt(state, cell) !== undefined) continue;

    if (isFabric(state, cell)) {
      legal.add(cell);
      continue;
    }

    if (orthogonalNeighbours(cell).some((neighbour) => isOccupied(state, neighbour))) {
      legal.add(cell);
    }
  }

  return ALL_CELLS.filter((cell) => legal.has(cell));
}

export function isLegalCell(state: GameState, cell: CellId, zone: Zone): boolean {
  return legalCells(state, zone).includes(cell);
}
