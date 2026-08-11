/**
 * The hand — GDD §6, §13, §14.
 *
 * Three plans, drawn fresh each round. Click one to select it; the legal cells
 * on the plot highlight.
 *
 * §14 — each plan carries its consent flag. §9.1 means that flag is never an
 * outcome, so it is shown flatly, in the same weight as the tier: it is a fact
 * about the plan, not a warning about it.
 */
import type { Consent, GameState, Plan, PlanIdentity } from '../types.ts';

type HandPlan = PlanIdentity & Pick<Plan, 'consent'>;

interface HandProps {
  state: GameState;
  deck: readonly HandPlan[];
  /** The flag as this game reads it — conservation can change it (§9.2). */
  consentOf: (plan: HandPlan) => Consent;
  consentLabels: Record<Consent, string>;
  onSelect: (planId: Plan['id']) => void;
}

export default function Hand({
  state,
  deck,
  consentOf,
  consentLabels,
  onSelect,
}: HandProps) {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));

  return (
    <ul className="hand">
      {state.hand.map((planId) => {
        const plan = byId.get(planId);
        if (!plan) return null;
        const selected = state.selectedPlanId === planId;
        const consent = consentOf(plan);

        return (
          <li key={planId}>
            <button
              type="button"
              className={`plan${selected ? ' plan--selected' : ''}`}
              data-tier={plan.tier}
              data-where={plan.where}
              data-consent={consent}
              aria-pressed={selected}
              onClick={() => onSelect(planId)}
            >
              <span className="plan__name">{plan.name}</span>
              {/* §5, §14 — where it goes is part of what the plan *is*, and a
                  player deciding between three should not have to select one to
                  find out that it only fits in the garden.

                  The roof tier goes on the roof, so it would read "roof · roof"
                  — the same word twice, which tells nobody anything and looks
                  like a bug. Said once when the two coincide. */}
              <span className="plan__tier">
                {plan.tier === plan.where ? plan.where : `${plan.tier} · ${plan.where}`}
              </span>
              <span className="plan__consent">{consentLabels[consent]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
