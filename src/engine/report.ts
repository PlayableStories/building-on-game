/**
 * What the house reports back — GDD §10.
 *
 * Not a score. Three columns: what you'll have, what it cost, and what you'll
 * look after — the last one longest, deliberately, because cost and benefit are
 * what an estate agent tells you and responsibility is the thing nobody
 * mentions.
 *
 * Nothing here totals anything a player can see. Cost bands are aggregated into
 * a phrase and never into a number (§10.2).
 */
import type {
  CellId,
  ClosingLine,
  Config,
  Consent,
  CostBand,
  GameState,
  HouseSummary,
  HouseholdMember,
  PlacedPlan,
  Plan,
  Quality,
  Report,
} from '../types.ts';
import { type ConsentContent, consentCare, consentFor } from './consent.ts';
import { parseCell } from './grid.ts';

export interface ReportContent extends ConsentContent {
  household: readonly HouseholdMember[];
  /**
   * §10.2 — one phrase per band of total cost, cheapest first. The last is used
   * for anything above the rest.
   */
  costPhrases: readonly string[];
  closingLines: readonly ClosingLine[];
  /** §7 — added to the care column when any of the old house came down. */
  demolitionCare: string;
  /** §9.1 — the flag vocabulary, in the order obligations should be read. */
  consentOrder: readonly Consent[];
}

/** How much each band weighs when the total is turned into a phrase. */
const COST_WEIGHT: Record<CostBand, number> = {
  'very-low': 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/** Manhattan distance on the grid: how many cells you cross to get there. */
function stepsBetween(a: CellId, b: CellId): number {
  const from = parseCell(a);
  const to = parseCell(b);
  const columns = 'ABCDE';
  return (
    Math.abs(columns.indexOf(from.column) - columns.indexOf(to.column)) +
    Math.abs(from.row - to.row)
  );
}

/**
 * §10.3 — which qualities the finished plot is most made of, strongest first.
 *
 * Counted from what the placed plans emit, then ordered by how many plans emit
 * each. Ties are broken by the severity order in content, so the result is
 * stable for a given house rather than dependent on placement order.
 */
export function dominantQualities(
  placed: readonly Plan[],
  severity: readonly Quality[],
): Quality[] {
  const counts = new Map<Quality, number>();
  for (const plan of placed) {
    for (const quality of plan.emits) {
      counts.set(quality, (counts.get(quality) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return severity.indexOf(a[0]) - severity.indexOf(b[0]);
    })
    .map(([quality]) => quality);
}

/**
 * Prepare the finished house for content to read, so that the household's
 * reactions in §10.4 can ask real questions of the plot without `content.ts`
 * ever importing engine code.
 */
export function summarise(
  state: GameState,
  deck: readonly Plan[],
  severity: readonly Quality[],
): HouseSummary {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));

  const placed: PlacedPlan[] = state.placements.flatMap((placement) => {
    const plan = byId.get(placement.planId);
    if (!plan) return [];
    return [
      {
        id: plan.id,
        name: plan.name,
        cell: placement.cell,
        round: placement.round,
        demolished: placement.demolished,
      },
    ];
  });

  const cellOf = (id: Plan['id']): CellId | null =>
    placed.find((entry) => entry.id === id)?.cell ?? null;

  const plans = placed.flatMap((entry) => {
    const plan = byId.get(entry.id);
    return plan ? [plan] : [];
  });

  return {
    placed,
    fabricRemaining: state.fabric,
    frontDoor: state.frontDoor,
    dominant: dominantQualities(plans, severity),
    has: (id) => cellOf(id) !== null,
    cellOf,
    distance: (a, b) => {
      const from = cellOf(a);
      const to = cellOf(b);
      return from && to ? stepsBetween(from, to) : null;
    },
    fromFrontDoor: (id) => {
      const to = cellOf(id);
      return to ? stepsBetween(state.frontDoor, to) : null;
    },
  };
}

/**
 * §10.2 — the cost bands, aggregated into a rough description. Never a number,
 * and never shown before the end.
 */
export function costPhrase(
  placed: readonly Plan[],
  phrases: readonly string[],
): string {
  if (phrases.length === 0) return '';

  const total = placed.reduce((sum, plan) => sum + COST_WEIGHT[plan.cost], 0);
  const most = placed.length * COST_WEIGHT.high;
  const share = most === 0 ? 0 : total / most;

  const index = Math.min(Math.floor(share * phrases.length), phrases.length - 1);
  return phrases[index] as string;
}

/**
 * §10.3 — one sentence naming what kind of house it turned out to be.
 *
 * The most specific line that fits wins, so a general fallback can sit in the
 * same list as a line that only fires for a house with nothing old left in it.
 */
export function closingLine(house: HouseSummary, lines: readonly ClosingLine[]): string {
  // Derived rather than counted against a constant, so that a fork inheriting a
  // building of a different size gets the right answer without saying how big
  // it was: nothing demolished is all of it, nothing left is none of it.
  const tookSomethingDown = house.placed.some((entry) => entry.demolished);
  const fabric = !tookSomethingDown
    ? 'all'
    : house.fabricRemaining.length === 0
      ? 'none'
      : 'some';

  // The dominant qualities that actually characterise the house — the top few,
  // not every quality that appeared once.
  const leading = new Set(house.dominant.slice(0, 3));

  const fits = lines.filter((line) => {
    if (line.fabric !== undefined && line.fabric !== fabric) return false;
    if (line.dominant !== undefined) {
      return line.dominant.every((quality) => leading.has(quality));
    }
    return true;
  });

  if (fits.length === 0) return '';

  let best = fits[0] as ClosingLine;
  const weight = (line: ClosingLine) =>
    (line.fabric === undefined ? 0 : 1) + (line.dominant?.length ?? 0);
  for (const line of fits) {
    if (weight(line) > weight(best)) best = line;
  }
  return best.line;
}

/**
 * Assemble the three columns, the closing line and the household's reactions.
 *
 * §10.1 — nothing here is totalled or displayed during play. This runs once, on
 * the last placement, and the player sees all of it at the same moment.
 */
export function buildReport(
  state: GameState,
  deck: readonly Plan[],
  content: ReportContent,
  severity: readonly Quality[],
  config: Config,
): Report {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));
  const house = summarise(state, deck, severity);

  const placed = house.placed.flatMap((entry) => {
    const plan = byId.get(entry.id);
    return plan ? [plan] : [];
  });

  // §10.2 — the have lines in placement order. The pleasures, plainly.
  const have = placed.map((plan) => plan.have);

  /**
   * The longest column, deliberately, and assembled in a fixed order: what each
   * plan asks of you, then the consent the house has taken on (§9.3), then what
   * pulling the old house down leaves behind (§7).
   */
  const care = placed.map((plan) => plan.care);

  const taken = house.placed.flatMap((entry) => {
    const plan = byId.get(entry.id);
    if (!plan) return [];
    return [
      consentFor(plan, entry.cell, entry.demolished, config.conservation, content),
    ];
  });
  care.push(...consentCare(taken, content.consentOrder, content.consentCare));

  // §9.2 — under conservation, taking the old house down has already said
  // something much longer, and it does not need saying twice.
  const demolished = house.placed.some((entry) => entry.demolished);
  if (demolished && !config.conservation) {
    care.push(content.demolitionCare);
  }

  return {
    have,
    cost: costPhrase(placed, content.costPhrases),
    care,
    closing: closingLine(house, content.closingLines),
    household: content.household.map((person) => ({
      name: person.name,
      reaction: person.reaction(house),
    })),
  };
}
