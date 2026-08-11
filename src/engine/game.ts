/**
 * The core loop — GDD §6, §7.
 *
 * A pure reducer over `GameState`. It is created by passing in the deck and the
 * config, which is how the engine gets at content without ever importing
 * `content.ts` — the constraint the fork surface in §16 depends on.
 */
import type {
  CellId,
  Config,
  GameState,
  Observation,
  Plan,
  PlanAdjacency,
  PlotContent,
} from '../types.ts';
import { type AdjacencyContent, type Neighbour, observationFor } from './adjacency.ts';
import { drawHand } from './deck.ts';
import {
  above,
  adjacentCells,
  isFabric,
  isFixed,
  isLegalCell,
  legalCells,
  placementAt,
} from './grid.ts';
import { createRng } from './rng.ts';

export type Action =
  | { type: 'BEGIN' }
  | { type: 'SELECT_PLAN'; planId: Plan['id'] }
  | { type: 'PLACE'; cell: CellId }
  | { type: 'CONFIRM_DEMOLITION' }
  | { type: 'CANCEL_DEMOLITION' }
  | { type: 'DISMISS' }
  | { type: 'RESTART'; seed: number };

export interface Game {
  initialState: (seed: number) => GameState;
  reducer: (state: GameState, action: Action) => GameState;
}

/**
 * §5 — the cell directly above, for a cell that must have one.
 *
 * The stair is on the ground floor by definition, so its landing always exists.
 * A fork that puts the stair on the roof has made a mistake worth hearing about
 * at start-up rather than as an undefined three rounds later — and
 * `npm run validate` catches it before that.
 */
function aboveOrThrow(cell: CellId): CellId {
  const up = above(cell);
  if (up === null) {
    throw new Error(`plot: the stair at ${cell} has no level above it for a landing (§5).`);
  }
  return up;
}

export function createGame(
  deck: readonly PlanAdjacency[],
  config: Config,
  writing: AdjacencyContent,
  plot: PlotContent,
  /**
   * §2 — the situations this game could be played for. Ids only: the engine
   * draws one and never reads a word of it.
   */
  situationIds: readonly string[],
): Game {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));

  /**
   * §5 — the part of the building a plan may be placed in. A plan that is not
   * in the deck has no `where`, and no legal cell either, so nothing can be
   * placed for it.
   */
  function whereFor(planId: Plan['id']) {
    return byId.get(planId)?.where;
  }

  /**
   * Deal the given round and return the hand alongside the seed the *next* deal
   * should use, so that the whole game is reproducible from one starting number
   * without the reducer holding hidden state.
   */
  function deal(
    state: Omit<GameState, 'hand' | 'phase' | 'round' | 'seed'>,
    round: number,
    seed: number,
  ): { hand: Plan['id'][]; seed: number } {
    const rng = createRng(seed);
    const hand = drawHand(deck, placeable(state), round, config.rounds, rng);
    return { hand, seed: Math.floor(rng() * 2 ** 32) };
  }

  /**
   * §15 — the pool, minus anything that has nowhere to go.
   *
   * The game cannot be failed and cannot be blocked, and that has to survive
   * being true of the *plot* as well as of the rules. It stopped being true of
   * the plot when the roof tier arrived: roofing a cell seals the first floor
   * under it (§5), the first floor's only opening move is the three cells around
   * the landing, and roofing all three strangles the upstairs frontier for good.
   * One game in four hundred dealt a hand of three plans with nowhere to put any
   * of them, which is the one outcome a no-fail game must not produce.
   *
   * Fixed here rather than in the placement rules, because the rules are right:
   * roofing a cell really should commit it, and that irreversibility is the most
   * interesting move in §5. What was wrong was offering a card the board could
   * not take. So the draw asks the board first.
   *
   * A plan filtered out this round is not discarded — it stays in the pool, and
   * comes back the moment somewhere opens up for it.
   */
  function placeable(
    state: Omit<GameState, 'hand' | 'phase' | 'round' | 'seed'>,
  ): Plan['id'][] {
    const alive = new Map<Plan['where'], boolean>();
    return state.pool.filter((id) => {
      const where = byId.get(id)?.where;
      if (where === undefined) return false;
      const known = alive.get(where);
      if (known !== undefined) return known;
      const open = legalCells(state as GameState, where).length > 0;
      alive.set(where, open);
      return open;
    });
  }

  function initialState(seed: number): GameState {
    const pool = deck.map((plan) => plan.id);

    // §2 — the situation comes out of the same seed as the deck, so one number
    // still reproduces a whole game: the same circumstances and the same deal.
    const rng = createRng(seed);
    const situationId = situationIds[Math.floor(rng() * situationIds.length)] ?? '';

    // The board before anything is on it, so the first deal can ask it the same
    // question every later deal asks: what has somewhere to go?
    const opening = {
      situationId,
      selectedPlanId: null,
      placements: [],
      fabric: plot.fabric.map((room) => room.cell),
      frontDoor: plot.frontDoor.cell,
      stair: plot.stair.cell,
      // §5 — the landing is the cell directly above the stair. Derived rather
      // than written twice, so a fork that moves the stair moves the landing
      // with it and cannot put them in different columns by accident.
      landing: aboveOrThrow(plot.stair.cell),
      gardenFromRow: plot.gardenFromRow,
      observation: null,
      pendingDemolition: null,
      pool,
    } satisfies Omit<GameState, 'hand' | 'phase' | 'round' | 'seed'>;

    const first = deal(opening, 1, Math.floor(rng() * 2 ** 32));

    return {
      ...opening,
      // §2 — the why-now line and the household are shown once, before round 1.
      // The first hand is dealt here so that dismissing the intro puts the
      // player straight into a round rather than into a wait.
      phase: 'intro',
      round: 1,
      hand: first.hand,
      seed: first.seed,
    };
  }

  /**
   * §7.2, §13 — a placement onto inherited fabric demolishes it, and that is the
   * one move the game asks about before making it. Everything else lands on the
   * click.
   */
  function propose(state: GameState, cell: CellId): GameState {
    const planId = state.selectedPlanId;
    if (planId === null) return state;
    if (!state.hand.includes(planId)) return state;
    const where = whereFor(planId);
    if (where === undefined) return state;
    if (!isLegalCell(state, cell, where)) return state;

    return isFabric(state, cell)
      ? { ...state, pendingDemolition: cell }
      : place(state, cell);
  }

  function place(state: GameState, cell: CellId): GameState {
    const planId = state.selectedPlanId;
    if (planId === null) return state;
    if (!state.hand.includes(planId)) return state;
    const where = whereFor(planId);
    if (where === undefined) return state;
    if (!isLegalCell(state, cell, where)) return state;

    // §7.2 — placing onto inherited fabric demolishes it. Irreversible: §7.3
    // means there is no way back from here for the rest of the game.
    const demolished = isFabric(state, cell);

    const placements = [
      ...state.placements,
      { planId, cell, round: state.round, demolished },
    ];
    const pool = state.pool.filter((id) => id !== planId);
    const fabric = demolished ? state.fabric.filter((c) => c !== cell) : state.fabric;

    // §7 — the front door is not in `fabric` and is never a legal cell, so it
    // survives whatever else comes down. It is the fixed point the rest of the
    // house is decided around.

    const placed = {
      ...state,
      selectedPlanId: null,
      pendingDemolition: null,
      placements,
      fabric,
      pool,
    };

    // §8.6 — one line for what has just been put next to what, or silence.
    const observation = observationAt(placed, planId, cell);

    // With a line to read, the round waits on it being dismissed (§13). With
    // silence there is nothing to wait for, so play simply carries on.
    return observation === null
      ? advance(placed)
      : { ...placed, observation };
  }

  /**
   * The neighbours of a cell, as §8.6 sees them: the plans next door, the ones
   * above and below since the house gained floors, and the old house wherever it
   * is still standing.
   */
  function neighboursOf(state: GameState, cell: CellId): Neighbour[] {
    const neighbours: Neighbour[] = [];

    for (const { cell: ref, how } of adjacentCells(cell)) {
      const placement = placementAt(state, ref);
      if (placement) {
        const plan = byId.get(placement.planId);
        if (plan) neighbours.push({ kind: 'plan', cell: ref, plan, how });
      } else if (state.fabric.includes(ref) || isFixed(state, ref)) {
        // The front door is part of the old house too — insulation against it
        // is insulation against a solid wall, same as any other old room.
        neighbours.push({ kind: 'fabric', cell: ref, how });
      }
    }

    return neighbours;
  }

  function observationAt(
    state: GameState,
    planId: Plan['id'],
    cell: CellId,
  ): Observation | null {
    const plan = byId.get(planId);
    if (!plan) return null;
    return observationFor(writing, plan, cell, neighboursOf(state, cell));
  }

  /** Move to the next round, or end the game — §15. */
  function advance(state: GameState): GameState {
    // §15 — the game ends when the last plan is placed. There is no win
    // condition to check and no way to fail.
    if (state.round >= config.rounds) {
      return { ...state, phase: 'report', hand: [], observation: null };
    }

    const nextRound = state.round + 1;
    const dealt = deal(state, nextRound, state.seed);

    return {
      ...state,
      round: nextRound,
      hand: dealt.hand,
      selectedPlanId: null,
      observation: null,
      seed: dealt.seed,
    };
  }

  function reducer(state: GameState, action: Action): GameState {
    switch (action.type) {
      case 'BEGIN': {
        // §2 — the framing is shown once and never returned to.
        if (state.phase !== 'intro') return state;
        return { ...state, phase: 'play' };
      }

      case 'SELECT_PLAN': {
        if (state.phase !== 'play') return state;
        // Nothing else happens while a line is being read, or while the game is
        // waiting to hear whether the old house is coming down.
        if (state.observation !== null) return state;
        if (state.pendingDemolition !== null) return state;
        if (!state.hand.includes(action.planId)) return state;
        // Clicking the selected plan again deselects it.
        const selectedPlanId =
          state.selectedPlanId === action.planId ? null : action.planId;
        return { ...state, selectedPlanId };
      }

      case 'PLACE': {
        if (state.phase !== 'play') return state;
        if (state.observation !== null) return state;
        if (state.pendingDemolition !== null) return state;
        return propose(state, action.cell);
      }

      case 'CONFIRM_DEMOLITION': {
        // §13 — the only confirmation in the game. There is nothing to confirm
        // unless a demolition has actually been proposed.
        if (state.pendingDemolition === null) return state;
        return place(state, state.pendingDemolition);
      }

      case 'CANCEL_DEMOLITION': {
        // The plan stays selected, so backing out returns the player to exactly
        // where they were rather than to the start of the round.
        if (state.pendingDemolition === null) return state;
        return { ...state, pendingDemolition: null };
      }

      case 'DISMISS': {
        // §13 — the line is dismissed by clicking, Space or Enter, and the
        // round moves on. With no line up there is nothing to dismiss.
        if (state.observation === null) return state;
        return advance(state);
      }

      case 'RESTART':
        return initialState(action.seed);
    }
  }

  return { initialState, reducer };
}
