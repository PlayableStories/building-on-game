/**
 * The plot — GDD §5, §12, §13.
 *
 * Flat coloured cells on a grid. No floor plan: no wall thicknesses, no doors
 * drawn, no furniture, no scale bar. Blocks keep it about relationships, which
 * is the useful part.
 *
 * Every occupied cell is printed the same way — its name at the top, in the same
 * face at the same size — whether the player put it there or inherited it. An
 * inherited cell adds a small quiet label underneath saying so. That is the
 * right way round: playtesting found that a cell shouting "Inherited" reads as
 * scenery, and nobody worked out it could be built on. A cell that says
 * *Old scullery* and murmurs *inherited* reads as a room, and rooms can go.
 */
import {
  COLUMNS,
  ROWS,
  type CellId,
  type GameState,
  type PlanIdentity,
  type PlotContent,
} from '../types.ts';
import { cellId, legalCells, placementAt, zoneOf } from '../engine/grid.ts';

interface PlotProps {
  state: GameState;
  deck: readonly PlanIdentity[];
  /** §5 — what the inherited cells are called. */
  plot: PlotContent;
  onPlace: (cell: CellId) => void;
}

export default function Plot({ state, deck, plot, onPlace }: PlotProps) {
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
  // plan's zone. With nothing selected there is no question and no highlight.
  const selected = state.selectedPlanId === null ? undefined : byId.get(state.selectedPlanId);
  const legal = selected ? legalCells(state, selected.zone) : [];

  /** The name of an inherited cell — an old room, or the front door. */
  const inheritedName = (cell: CellId): string | undefined => {
    if (state.frontDoor === cell) return plot.frontDoor.name;
    if (!state.fabric.includes(cell)) return undefined;
    return plot.fabric.find((room) => room.cell === cell)?.name;
  };

  return (
    <div className={`plot${state.observation ? ' plot--reading' : ''}`}>
      <p className="plot__edge plot__edge--street">The street</p>

      <div className="plot__frame">
        <div className="plot__grid" role="grid" aria-label="The plot">
          {ROWS.map((row) =>
            COLUMNS.map((column) => {
              const cell = cellId(column, row);
              const placement = placementAt(state, cell);
              const plan = placement ? byId.get(placement.planId) : undefined;
              const inherited = plan ? undefined : inheritedName(cell);
              const isLegal = legal.includes(cell);
              // §7 — the front door came with the house and stays with it. It
              // is inherited, but unlike the old rooms it can never come down.
              const isDoor = state.frontDoor === cell;

              const classes = ['cell'];
              if (placement) classes.push('cell--placed');
              else if (inherited) classes.push('cell--inherited');
              else classes.push('cell--empty');
              // Two classes, because they are two different facts: `inherited`
              // is where it came from, `fabric` is that it could still go. The
              // front door is the first without being the second.
              if (inherited && !isDoor) classes.push('cell--fabric');
              if (isDoor) classes.push('cell--door');
              if (isLegal) classes.push('cell--legal');
              // §8.6 — the two ends of the relationship the line is about.
              if (cell === subject) classes.push('cell--subject');
              if (causes.includes(cell)) classes.push('cell--cause');

              const name = plan?.name ?? inherited ?? '';

              return (
                <button
                  key={cell}
                  type="button"
                  role="gridcell"
                  className={classes.join(' ')}
                  data-tier={plan?.tier}
                  data-zone={zoneOf(cell, state.gardenFromRow)}
                  disabled={!isLegal}
                  onClick={() => onPlace(cell)}
                  aria-label={
                    name
                      ? `${cell}, ${name}${inherited ? ', inherited' : ''}${
                          isDoor ? ', cannot be taken down' : ''
                        }`
                      : `${cell}, empty`
                  }
                >
                  <span className="cell__ref">{cell}</span>
                  <span className="cell__name">{name}</span>
                  {inherited && <span className="cell__inherited">inherited</span>}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <p className="plot__edge plot__edge--garden">
        The garden <span className="plot__sun">· sun from the south</span>
      </p>
    </div>
  );
}
