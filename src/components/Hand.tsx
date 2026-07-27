/**
 * The hand — GDD §6, §13, §14.
 *
 * Three plans, drawn fresh each round. Click one to select it; the legal cells
 * on the plot highlight. The consent flag on each plan arrives in M5.
 */
import type { GameState, Plan, PlanIdentity } from '../types.ts';

interface HandProps {
  state: GameState;
  deck: readonly PlanIdentity[];
  onSelect: (planId: Plan['id']) => void;
}

export default function Hand({ state, deck, onSelect }: HandProps) {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));

  return (
    <ul className="hand">
      {state.hand.map((planId) => {
        const plan = byId.get(planId);
        if (!plan) return null;
        const selected = state.selectedPlanId === planId;

        return (
          <li key={planId}>
            <button
              type="button"
              className={`plan${selected ? ' plan--selected' : ''}`}
              data-tier={plan.tier}
              aria-pressed={selected}
              onClick={() => onSelect(planId)}
            >
              <span className="plan__name">{plan.name}</span>
              <span className="plan__tier">{plan.tier}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
