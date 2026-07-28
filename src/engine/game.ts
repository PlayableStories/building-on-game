/**
 * The core loop — GDD §6, §7.
 *
 * A pure reducer over `GameState`. It is created by passing in the deck and the
 * config, which is how the engine gets at content without ever importing
 * `content.ts` — the constraint the fork surface in §16 depends on.
 */
import type { CellId, Config, GameState, Plan, PlanAdjacency } from '../types.ts';
import { type AdjacencyContent, type Neighbour, observationFor } from './adjacency.ts';
import { drawHand } from './deck.ts';
import {
  FABRIC_CELLS,
  FRONT_DOOR_CELL,
  isFabric,
  isLegalCell,
  orthogonalNeighbours,
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

export function createGame(
  deck: readonly PlanAdjacency[],
  config: Config,
  writing: AdjacencyContent,
): Game {
  const byId = new Map(deck.map((plan) => [plan.id, plan]));
  /**
   * Deal the given round and return the hand alongside the seed the *next* deal
   * should use, so that the whole game is reproducible from one starting number
   * without the reducer holding hidden state.
   */
  function deal(
    pool: readonly Plan['id'][],
    round: number,
    seed: number,
  ): { hand: Plan['id'][]; seed: number } {
    const rng = createRng(seed);
    const hand = drawHand(deck, pool, round, config.rounds, rng);
    return { hand, seed: Math.floor(rng() * 2 ** 32) };
  }

  function initialState(seed: number): GameState {
    const pool = deck.map((plan) => plan.id);
    const first = deal(pool, 1, seed);

    return {
      // §2 — the why-now line and the household are shown once, before round 1.
      // The first hand is dealt here so that dismissing the intro puts the
      // player straight into a round rather than into a wait.
      phase: 'intro',
      round: 1,
      hand: first.hand,
      selectedPlanId: null,
      placements: [],
      fabric: [...FABRIC_CELLS],
      frontDoor: FRONT_DOOR_CELL,
      observation: null,
      pendingDemolition: null,
      pool,
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
    if (!isLegalCell(state, cell)) return state;

    return isFabric(state, cell)
      ? { ...state, pendingDemolition: cell }
      : place(state, cell);
  }

  function place(state: GameState, cell: CellId): GameState {
    const planId = state.selectedPlanId;
    if (planId === null) return state;
    if (!state.hand.includes(planId)) return state;
    if (!isLegalCell(state, cell)) return state;

    // §7.2 — placing onto inherited fabric demolishes it. Irreversible: §7.3
    // means there is no way back from here for the rest of the game.
    const demolished = isFabric(state, cell);

    const placements = [
      ...state.placements,
      { planId, cell, round: state.round, demolished },
    ];
    const pool = state.pool.filter((id) => id !== planId);
    const fabric = demolished ? state.fabric.filter((c) => c !== cell) : state.fabric;

    // §7 — demolishing B2 removes the front door, and every later placement is
    // read against that.
    const frontDoor =
      demolished && cell === state.frontDoor ? null : state.frontDoor;

    const placed = {
      ...state,
      selectedPlanId: null,
      pendingDemolition: null,
      placements,
      fabric,
      frontDoor,
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
   * The neighbours of a cell, as §8.6 sees them: the plans next door, and the
   * old house where it is still standing.
   */
  function neighboursOf(state: GameState, cell: CellId): Neighbour[] {
    const neighbours: Neighbour[] = [];

    for (const ref of orthogonalNeighbours(cell)) {
      const placement = placementAt(state, ref);
      if (placement) {
        const plan = byId.get(placement.planId);
        if (plan) neighbours.push({ kind: 'plan', plan });
      } else if (state.fabric.includes(ref)) {
        neighbours.push({ kind: 'fabric' });
      }
    }

    return neighbours;
  }

  function observationAt(
    state: GameState,
    planId: Plan['id'],
    cell: CellId,
  ): string | null {
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
    const dealt = deal(state.pool, nextRound, state.seed);

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
