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
  PlacedPlan,
  Plan,
  PlanningContent,
  PlanningNeed,
  PlanningRoute,
  PlanningStatement,
  Quality,
  Report,
  Situation,
} from '../types.ts';
import { type ConsentContent, consentCare, consentFor } from './consent.ts';
import { parseCell } from './grid.ts';

export interface ReportContent extends ConsentContent {
  /** §2, §10.4 — the pool. The one this game was played for answers it. */
  situations: readonly Situation[];
  /**
   * §10.2 — one phrase per band of total cost, cheapest first. The last is used
   * for anything above the rest.
   */
  costPhrases: readonly string[];
  closingLines: readonly ClosingLine[];
  /** §9.1 — the flag vocabulary, in the order obligations should be read. */
  consentOrder: readonly Consent[];
  /**
   * §10.5 — the figures and the writing behind the planning statement, or null
   * for a fork that has no such data and should say nothing.
   */
  planning: PlanningContent | null;
}

/** How much each band weighs when the total is turned into a phrase. */
const COST_WEIGHT: Record<CostBand, number> = {
  'very-low': 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/**
 * §10.2 — how much of the finished house the report actually talks about.
 *
 * Eight pairs and five obligations is a document. Three and two is something a
 * player reads to the end, which is the only version that works: the report is
 * the payoff, and a payoff nobody finishes is not one. Playtesting was blunt
 * about this — "the result is too complicate and too long".
 */
const REPORT_PAIRS = 3;
const OBLIGATION_LINES = 2;

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
 * §9.3, §10.3 — how much of the old house is still there.
 *
 * Derived rather than counted against a constant, so that a fork inheriting a
 * building of a different size gets the right answer without saying how big it
 * was: nothing demolished is all of it, nothing left is none of it.
 *
 * Shared by the closing line and the obligations, which both key writing on it
 * and must agree about what a half-demolished house is.
 */
export function fabricLeft(house: HouseSummary): 'all' | 'some' | 'none' {
  if (!house.placed.some((entry) => entry.demolished)) return 'all';
  return house.fabricRemaining.length === 0 ? 'none' : 'some';
}

/**
 * §10.3 — one sentence naming what kind of house it turned out to be.
 *
 * The most specific line that fits wins, so a general fallback can sit in the
 * same list as a line that only fires for a house with nothing old left in it.
 */
export function closingLine(house: HouseSummary, lines: readonly ClosingLine[]): string {
  const fabric = fabricLeft(house);

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
 * §10.5 — what you would actually have to submit.
 *
 * The one thing this must never do is tell the player what happens to their
 * house. §9.1 is that consent is a flag and never an outcome, and a section
 * quoting an approval rate is the easiest place in the whole game to break it
 * by accident: *"81% were approved"* is a fact about London, and *"you have an
 * 81% chance"* is a prediction the game has spent every other decision
 * refusing to make.
 *
 * So the numbers are attributed in the same breath as they are said, the count
 * this house contributes is its own placements rather than a probability, and
 * there is no branch anywhere below that reads a rate and decides anything. The
 * house's own figures and the dataset's figures never meet.
 *
 * Returns null when the fork has no planning data, and a statement saying so
 * when the house needs no application — those are different answers and the
 * player should be told the second one.
 */
export function planningStatement(
  needs: readonly PlanningNeed[],
  content: PlanningContent | null,
): PlanningStatement | null {
  if (content === null) return null;
  const { copy, data } = content;

  /** How many placements go through each door. */
  const counts = new Map<string, number>();
  for (const need of needs) {
    const key = content.routeFor(need);
    if (key === null || data.routes[key] === undefined) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const applications = [...counts.values()].reduce((sum, n) => sum + n, 0);

  // Nothing to submit — which is a result worth printing, not a blank.
  if (applications === 0) {
    return { needed: copy.none, route: '', record: '', source: '' };
  }

  /**
   * Of the doors this house goes through, the slow one. Not the commonest:
   * a project takes as long as its longest application, so the timetable is
   * set by the worst of them and that is the one worth naming. Ties go to
   * whichever holds more of the house.
   */
  let named = [...counts.keys()][0] as string;
  for (const key of counts.keys()) {
    const a = data.routes[key] as PlanningRoute;
    const b = data.routes[named] as PlanningRoute;
    if (
      a.medianDays > b.medianDays ||
      (a.medianDays === b.medianDays &&
        (counts.get(key) as number) > (counts.get(named) as number))
    ) {
      named = key;
    }
  }

  const route = data.routes[named] as PlanningRoute;
  return {
    needed: copy.needed,
    route: copy.route(applications, counts.get(named) as number, route),
    record: copy.record(route),
    source: copy.source,
  };
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

  /** Every placement, with the plan behind it and the consent it took on. */
  const made = house.placed.flatMap((entry) => {
    const plan = byId.get(entry.id);
    if (!plan) return [];
    const consent = consentFor(
      plan,
      entry.cell,
      entry.demolished,
      config.conservation,
      content,
    );
    return [{ entry, plan, consent }];
  });

  const placed = made.map((one) => one.plan);

  /**
   * §10.2 — how much this one asks of you: what it cost to build, plus the
   * weight of the heaviest consent it took on. Nothing here is shown, and it
   * is not a score — it decides which three of the eight the report is about,
   * and nothing else. The three that ask the most are the three that will
   * decide what living here is like.
   */
  const asks = (one: (typeof made)[number]) => {
    const flags = one.consent.flags.map((flag) => content.consentOrder.indexOf(flag));
    return COST_WEIGHT[one.plan.cost] + Math.max(0, ...flags);
  };

  // Heaviest first, and where two ask the same, the later one — a house is more
  // what it most recently became than what it started as.
  const ranked = [...made].sort(
    (a, b) => asks(b) - asks(a) || b.entry.round - a.entry.round,
  );

  const pairs = ranked.slice(0, REPORT_PAIRS).map((one) => ({
    name: one.plan.name,
    have: one.plan.have,
    care: one.plan.care,
  }));

  /**
   * §10.5 — every placement as the planning system would see it. A placement
   * counts once however many flags it took on: one application covers the lot,
   * which is the same reasoning §9.3 uses to deduplicate the obligations.
   */
  const needs = made.map((one) => ({
    flags: one.consent.flags,
    demolished: one.entry.demolished,
    conservation: config.conservation,
  }));

  const applications = needs.filter((need) =>
    need.flags.some((flag) => flag !== 'permitted'),
  ).length;

  /**
   * §9.3 — the obligations the house itself has taken on, which belong to no
   * single plan and so cannot be paired with anything. Two lines, off the front
   * of an order that already puts the most specific first.
   *
   * `ranked` rather than `made`, so that a placement-specific obligation is
   * ordered by how much that placement asked. Without it, two lines is not
   * enough room to guarantee that §9.2's demolition-in-a-conservation-area
   * obligation — the heaviest thing in the game — actually gets said: it would
   * sit behind whatever happened to be placed earlier.
   *
   * The house's own profile goes in too, so the writing can be about *this*
   * house rather than about the four flags every house collects. See §9.3 in
   * `types.ts` for why that was worth changing.
   */
  const obligations = consentCare(
    ranked.map((one) => one.consent),
    content.consentOrder,
    content.obligationLines,
    {
      flags: new Set(made.flatMap((one) => one.consent.flags)),
      fabric: fabricLeft(house),
      applications,
      conservation: config.conservation,
    },
  ).slice(0, OBLIGATION_LINES);

  // §10.4 — the situation this game opened on, answered by the plot that came
  // out of it. One line, and it is the only place the framing comes back.
  const situation = content.situations.find((entry) => entry.id === state.situationId);

  return {
    pairs,
    cost: costPhrase(placed, content.costPhrases),
    obligations,
    planning: planningStatement(needs, content.planning),
    closing: closingLine(house, content.closingLines),
    answer: situation ? situation.reaction(house) : '',
  };
}
