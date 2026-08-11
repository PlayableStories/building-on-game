/**
 * The plot — GDD §5, §12, §13.
 *
 * A grid of flat coloured cells: no floor plan, no wall thicknesses, no doors
 * drawn, no furniture, no scale bar. Blocks keep it about relationships, which
 * is the useful part.
 *
 * Since §5 gained levels there are three such grids — the roof, the first floor
 * and the ground floor with the garden behind it — and **one of them is on
 * screen at a time**, chosen by the switcher above the board. Stacking all three
 * as an elevation was the other option and it was not taken: it shrinks the
 * cells past the point where a room's name fits, to show two levels that are
 * empty for most of the game.
 *
 * The switcher costs nothing to operate, because it mostly operates itself.
 * Choosing a plan moves the board to the level that plan can go on, so the
 * player arrives at a board with highlights on it rather than at an empty one —
 * without which the level rule looks like the game refusing to work.
 *
 * Every occupied cell is printed the same way — its name at the top, in the same
 * face at the same size — whether the player put it there or inherited it. An
 * inherited cell adds a small quiet label underneath saying so. That is the
 * right way round: playtesting found that a cell shouting "Inherited" reads as
 * scenery, and nobody worked out it could be built on. A cell that says
 * *Old scullery* and murmurs *inherited* reads as a room, and rooms can go.
 */
import { useEffect, useState } from 'react';
import {
  COLUMNS,
  LEVELS,
  ROWS,
  type CellId,
  type GameState,
  type InterfaceCopy,
  type Level,
  type PlanIdentity,
  type PlotContent,
} from '../types.ts';
import { cellId, isGarden, legalCells, levelOf, placementAt } from '../engine/grid.ts';

interface PlotProps {
  state: GameState;
  deck: readonly PlanIdentity[];
  /** §5 — what the inherited cells are called. */
  plot: PlotContent;
  /** §16 — every word on and around the plot. */
  copy: InterfaceCopy['plot'];
  onPlace: (cell: CellId) => void;
}

/**
 * Ground first, roof last — left to right is going up.
 *
 * The switcher sits *below* the board, beside the hand, because choosing a level
 * and choosing a plan are the same gesture a beat apart and the cursor should
 * not have to cross the whole plot between them. It was a vertical stack above
 * the board when it read like an elevation; below the board a stack only pushes
 * the cards further away, which is the thing being fixed.
 */
const BOTTOM_UP: readonly Level[] = LEVELS;

export default function Plot({ state, deck, plot, copy, onPlace }: PlotProps) {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));

  /**
   * §8.6 — while a line is up, the cells it is about. The placement that caused
   * it, and whatever it was read against. This is the load-bearing half of the
   * fix for "I do not aware the line is directly related to my placement": the
   * sentence names the relationship, and the plot shows it in the same moment.
   */
  const subject = state.observation?.cell;
  const causes = state.observation?.because ?? [];

  // §5 — the highlight answers "where can *this* go", so it needs the selected
  // plan's `where`. With nothing selected there is no question and no highlight.
  const selected = state.selectedPlanId === null ? undefined : byId.get(state.selectedPlanId);
  const legal = selected ? legalCells(state, selected.where) : [];

  const [shown, setShown] = useState<Level>('ground');

  /**
   * §5 — where choosing a plan takes you. Read off the plan's own legal cells
   * rather than from a table of which `where` lives on which level: there is
   * already exactly one place that rule is written down, and it is the engine.
   * A fork that invents a fifth `where` gets this for free.
   */
  const target = legal[0] === undefined ? null : levelOf(legal[0]);
  useEffect(() => {
    if (target !== null) setShown(target);
    // Following `target` alone would fight the player: it does not change when
    // they switch levels by hand, but it does the moment a placement alters
    // what is legal, which would drag the board back mid-look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedPlanId]);

  /**
   * §8.6 — a line about a cell has to be readable next to that cell. Since the
   * house started hearing through its floors, a line can be about two levels at
   * once, and the board goes to the placement's own level: that is the half the
   * player just did, and the half the sentence starts with.
   */
  useEffect(() => {
    if (subject !== undefined) setShown(levelOf(subject));
  }, [subject]);

  /**
   * …and the other half is on a level that is not on screen. "Bedroom above the
   * kitchen" is only half a sentence if the kitchen is somewhere the player
   * cannot see, so the switcher says which level the rest of it is on. Pressing
   * it does not disturb the line: the board only follows a *new* observation.
   */
  const causeLevels = new Set(
    causes.filter((cell) => levelOf(cell) !== shown).map(levelOf),
  );

  /** The name of an inherited cell — an old room, the front door, the stair. */
  const inheritedName = (cell: CellId): string | undefined => {
    if (state.frontDoor === cell) return plot.frontDoor.name;
    if (state.stair === cell) return plot.stair.name;
    if (state.landing === cell) return copy.landing;
    if (!state.fabric.includes(cell)) return undefined;
    return plot.fabric.find((room) => room.cell === cell)?.name;
  };

  // §5 — the garden is ground only. The upper levels are the building.
  const rows = shown === 'ground' ? ROWS : ROWS.filter((row) => row < state.gardenFromRow);

  return (
    /**
     * §5 — the plot holds the same envelope whichever level is on screen: the
     * street label, five rows of cells, the garden label. The upper levels fill
     * three of those rows and leave the rest empty.
     *
     * That is deliberate, and it buys two things. Nothing below the board moves
     * when the level changes — the hand stayed put instead of jumping by two
     * rows — and every cell keeps the *same screen position* on every level, so
     * B2 is where B2 was and switching reads as looking up rather than as the
     * page being redrawn.
     */
    <div
      className={`plot${state.observation ? ' plot--reading' : ''}`}
      style={{ ['--plot-max-rows' as string]: ROWS.length }}
    >
      {/* §5 — row 1 is the street elevation at every height, so this is true on
          every level: a first-floor front bedroom faces the street exactly as
          the room under it does. */}
      <p className="plot__edge plot__edge--street">{copy.street}</p>

      <div className="plot__frame">
        <div className="plot__grid" role="grid" aria-label={copy.levels[shown]}>
          {rows.map((row) =>
            COLUMNS.map((column) => {
              const cell = cellId(shown, column, row);
              const ref = `${column}${row}`;
              const placement = placementAt(state, cell);
              const plan = placement ? byId.get(placement.planId) : undefined;
              const inherited = plan ? undefined : inheritedName(cell);
              const isLegal = legal.includes(cell);
              // §7 — the cells the house came with that can never come down:
              // the front door, the stair, and the landing above it.
              const isFixedCell =
                cell === state.frontDoor || cell === state.stair || cell === state.landing;

              const classes = ['cell'];
              if (placement) classes.push('cell--placed');
              else if (inherited) classes.push('cell--inherited');
              else classes.push('cell--empty');
              // Two classes, because they are two different facts: `inherited`
              // is where it came from, `fabric` is that it could still go. The
              // fixed cells are the first without being the second.
              if (inherited && !isFixedCell) classes.push('cell--fabric');
              if (isFixedCell) classes.push('cell--door');
              if (isLegal) classes.push('cell--legal');
              // §8.6 — the two ends of the relationship the line is about.
              if (cell === subject) classes.push('cell--subject');
              if (causes.includes(cell)) classes.push('cell--cause');

              const name = plan?.name ?? inherited ?? '';
              const place = `${copy.levels[shown]}, ${ref}`;

              return (
                <button
                  key={cell}
                  type="button"
                  role="gridcell"
                  className={classes.join(' ')}
                  data-tier={plan?.tier}
                  data-garden={shown === 'ground' && isGarden(cell, state.gardenFromRow)}
                  disabled={!isLegal}
                  onClick={() => onPlace(cell)}
                  aria-label={
                    name
                      ? `${place}, ${name}${inherited ? `, ${copy.inherited}` : ''}${
                          isFixedCell ? `, ${copy.fixed}` : ''
                        }`
                      : `${place}, ${copy.empty}`
                  }
                >
                  <span className="cell__ref">{ref}</span>
                  <span className="cell__name">{name}</span>
                  {inherited && <span className="cell__inherited">{copy.inherited}</span>}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* …but there is no garden above a garden. Hidden rather than removed on
          the upper levels, so it still holds its line and the switcher below it
          does not move. */}
      <p className="plot__edge plot__edge--garden" data-shown={shown === 'ground'}>
        {copy.garden} <span className="plot__sun">{copy.sun}</span>
      </p>

      <div className="plot__levels" role="group" aria-label={copy.levelPicker}>
        {BOTTOM_UP.map((level) => (
          <button
            key={level}
            type="button"
            className="plot__level"
            // Not a tab set: `aria-pressed` says the state without promising
            // the arrow-key handling a tablist is read as offering.
            aria-pressed={level === shown}
            // §5 — a quiet mark on the levels the chosen plan could go on, so
            // the switcher answers "where does this go" before it is touched.
            data-legal={legal.some((cell) => levelOf(cell) === level)}
            // §8.6 — and while a line is up, where the other end of it is.
            data-cause={causeLevels.has(level)}
            onClick={() => setShown(level)}
          >
            {copy.levels[level]}
          </button>
        ))}
      </div>
    </div>
  );
}
