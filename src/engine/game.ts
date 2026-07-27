/**
 * The core loop — GDD §6, §7.
 *
 * A pure reducer over `GameState`. It is created by passing in the deck and the
 * config, which is how the engine gets at content without ever importing
 * `content.ts` — the constraint the fork surface in §16 depends on.
 */
import type { CellId, Config, GameState, Plan, PlanIdentity } from '../types.ts';
import { drawHand } from './deck.ts';
import { FABRIC_CELLS, FRONT_DOOR_CELL, isFabric, isLegalCell } from './grid.ts';
import { createRng } from './rng.ts';

export type Action =
  | { type: 'SELECT_PLAN'; planId: Plan['id'] }
  | { type: 'PLACE'; cell: CellId }
  | { type: 'RESTART'; seed: number };

export interface Game {
  initialState: (seed: number) => GameState;
  reducer: (state: GameState, action: Action) => GameState;
}

export function createGame(deck: readonly PlanIdentity[], config: Config): Game {
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
      // M2 introduces the 'intro' phase in front of this — §2, the why-now line
      // and the household, shown once before round 1.
      phase: 'play',
      round: 1,
      hand: first.hand,
      selectedPlanId: null,
      placements: [],
      fabric: [...FABRIC_CELLS],
      frontDoor: FRONT_DOOR_CELL,
      observation: null,
      pool,
      seed: first.seed,
    };
  }

  function place(state: GameState, cell: CellId): GameState {
    const planId = state.selectedPlanId;
    if (planId === null) return state;
    if (!state.hand.includes(planId)) return state;
    if (!isLegalCell(state, cell)) return state;

    // §7.2 — placing onto inherited fabric demolishes it. The confirmation this
    // move deserves, and the consequences it carries, arrive in M5.
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

    const finished = state.round >= config.rounds;
    const nextRound = state.round + 1;

    // M3 splits this: PLACE will stop on the adjacency line (§8.6) and a
    // separate dismissal will advance the round. There is nothing to stop on yet.
    const dealt = finished
      ? { hand: [] as Plan['id'][], seed: state.seed }
      : deal(pool, nextRound, state.seed);

    return {
      ...state,
      // §15 — the game ends when the last plan is placed. There is no win
      // condition to check and no way to fail.
      phase: finished ? 'report' : 'play',
      round: finished ? state.round : nextRound,
      hand: dealt.hand,
      selectedPlanId: null,
      placements,
      fabric,
      frontDoor,
      observation: null,
      pool,
      seed: dealt.seed,
    };
  }

  function reducer(state: GameState, action: Action): GameState {
    switch (action.type) {
      case 'SELECT_PLAN': {
        if (state.phase !== 'play') return state;
        if (!state.hand.includes(action.planId)) return state;
        // Clicking the selected plan again deselects it.
        const selectedPlanId =
          state.selectedPlanId === action.planId ? null : action.planId;
        return { ...state, selectedPlanId };
      }

      case 'PLACE': {
        if (state.phase !== 'play') return state;
        return place(state, action.cell);
      }

      case 'RESTART':
        return initialState(action.seed);
    }
  }

  return { initialState, reducer };
}
