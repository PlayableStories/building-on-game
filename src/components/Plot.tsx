/**
 * The plot — GDD §5, §12, §13.
 *
 * Flat coloured cells on a grid. No floor plan: no wall thicknesses, no doors
 * drawn, no furniture, no scale bar. Blocks keep it about relationships, which
 * is the useful part.
 */
import { COLUMNS, ROWS, type CellId, type GameState, type PlanIdentity } from '../types.ts';
import { cellId, FRONT_DOOR_CELL, legalCells, placementAt } from '../engine/grid.ts';

interface PlotProps {
  state: GameState;
  deck: readonly PlanIdentity[];
  onPlace: (cell: CellId) => void;
}

export default function Plot({ state, deck, onPlace }: PlotProps) {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));
  const legal = state.selectedPlanId === null ? [] : legalCells(state);

  return (
    <div className="plot">
      <p className="plot__edge plot__edge--street">The street</p>

      <div className="plot__frame">
        <div className="plot__grid" role="grid" aria-label="The plot">
          {ROWS.map((row) =>
            COLUMNS.map((column) => {
              const cell = cellId(column, row);
              const placement = placementAt(state, cell);
              const plan = placement ? byId.get(placement.planId) : undefined;
              const isFabric = state.fabric.includes(cell);
              const isLegal = legal.includes(cell);
              const isFrontDoor = cell === FRONT_DOOR_CELL && state.frontDoor !== null;

              const classes = ['cell'];
              if (placement) classes.push('cell--placed');
              else if (isFabric) classes.push('cell--fabric');
              else classes.push('cell--empty');
              if (isLegal) classes.push('cell--legal');

              return (
                <button
                  key={cell}
                  type="button"
                  role="gridcell"
                  className={classes.join(' ')}
                  data-tier={plan?.tier}
                  disabled={!isLegal}
                  onClick={() => onPlace(cell)}
                  aria-label={
                    plan
                      ? `${cell}, ${plan.name}`
                      : isFabric
                        ? `${cell}, inherited fabric${isFrontDoor ? ', front door' : ''}`
                        : `${cell}, empty`
                  }
                >
                  <span className="cell__ref">{cell}</span>
                  <span className="cell__name">
                    {plan ? plan.name : isFabric ? 'Inherited' : ''}
                  </span>
                  {isFrontDoor && <span className="cell__door">front door</span>}
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
