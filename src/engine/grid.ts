/**
 * The plot — GDD §5, §7.
 *
 * A 5×5 grid, columns A–E and rows 1–5, with the inherited house already
 * standing on B2, C2, B3 and C3. Everything here is pure geometry and pure
 * state inspection; nothing in this module knows what a plan says.
 */
import {
  COLUMNS,
  ROWS,
  type CellId,
  type Column,
  type GameState,
  type Orientation,
  type Row,
} from '../types.ts';

/** §5 — the house the player inherited. */
export const FABRIC_CELLS: readonly CellId[] = ['B2', 'C2', 'B3', 'C3'];

/** §5 — the one thing about the house decided before the player arrived. */
export const FRONT_DOOR_CELL: CellId = 'B2';

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
 * §5 — row 1 is the street, row 5 is the garden, and sun comes from the south.
 * Row 3 is neither, so a plan placed there gets no orientation line. Used by the
 * adjacency resolution in M3.
 */
export function orientationOf(cell: CellId): Orientation | null {
  const { row } = parseCell(cell);
  if (row <= 2) return 'north';
  if (row >= 4) return 'south';
  return null;
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

/** Inherited fabric counts as occupied for adjacency — §7.1. */
export function isOccupied(state: GameState, cell: CellId): boolean {
  return placementAt(state, cell) !== undefined || isFabric(state, cell);
}

/**
 * §7 — every cell a plan may legally go in:
 *
 *   1. an empty cell orthogonally adjacent to something already occupied, and
 *   2. any inherited fabric cell still standing, which demolishes it (§7.2).
 *
 * A cell that already holds a placement is never legal again — §7.3, nothing can
 * be moved or removed.
 */
export function legalCells(state: GameState): CellId[] {
  const legal = new Set<CellId>();

  for (const cell of ALL_CELLS) {
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

export function isLegalCell(state: GameState, cell: CellId): boolean {
  return legalCells(state).includes(cell);
}
