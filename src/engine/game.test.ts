import { describe, expect, it } from 'vitest';
import {
  causeWords,
  config,
  deck,
  pairLines,
  plot,
  situations,
  qualityLines,
  qualitySeverity,
} from '../content.ts';
import type { GameState, Observation } from '../types.ts';
import { tierForRound } from './deck.ts';
import { createGame } from './game.ts';
import { legalCells } from './grid.ts';

const game = createGame(
  deck,
  config,
  { pairLines, qualityLines, qualitySeverity, causeWords },
  plot,
  situations.map((situation) => situation.id),
);
const byId = new Map(deck.map((plan) => [plan.id, plan]));

/**
 * The game opens on the framing (§2). Play begins once it is dismissed, so
 * every test that places anything starts here.
 */
function startGame(seed: number): GameState {
  return game.reducer(game.initialState(seed), { type: 'BEGIN' });
}

/**
 * §7.2, §13 — a placement onto fabric stops and asks. This says yes, which is
 * what the helpers below want: a game that keeps moving, and demolition
 * exercised rather than avoided.
 */
function settle(state: GameState): GameState {
  return state.pendingDemolition === null
    ? state
    : game.reducer(state, { type: 'CONFIRM_DEMOLITION' });
}

/** §5 — a plan's half of the plot, which is what its legal cells depend on. */
function zoneOfPlan(planId: string) {
  const zone = byId.get(planId)?.zone;
  if (zone === undefined) throw new Error(`no such plan: ${planId}`);
  return zone;
}

/**
 * The first plan in hand that goes in the house. Most of the tests below aim at
 * a specific indoor cell, so they need a plan that is allowed to go there.
 */
function indoorInHand(state: GameState): string {
  const planId = state.hand.find((id) => byId.get(id)?.zone === 'indoor');
  if (planId === undefined) throw new Error('no indoor plan in hand');
  return planId;
}

/** Play a whole game, always taking the first plan and the first legal cell. */
function playThrough(seed: number): {
  final: GameState;
  steps: GameState[];
  lines: (Observation | null)[];
} {
  const steps: GameState[] = [];
  const lines: (Observation | null)[] = [];
  let state = startGame(seed);

  while (state.phase === 'play') {
    steps.push(state);
    const planId = state.hand[0];
    if (planId === undefined) throw new Error('dealt an empty hand');
    const selected = game.reducer(state, { type: 'SELECT_PLAN', planId });
    const cell = legalCells(selected, zoneOfPlan(planId))[0];
    if (cell === undefined) throw new Error('no legal cell');

    const placed = settle(game.reducer(selected, { type: 'PLACE', cell }));
    lines.push(placed.observation);
    state =
      placed.observation === null ? placed : game.reducer(placed, { type: 'DISMISS' });
  }

  return { final: state, steps, lines };
}

describe('the core loop (§6, §15)', () => {
  it('ends after exactly the configured number of placements', () => {
    const { final } = playThrough(7);
    expect(final.placements).toHaveLength(config.rounds);
    expect(final.phase).toBe('report');
  });

  it('never runs out of legal cells across many seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(playThrough(seed).final.placements).toHaveLength(config.rounds);
    }
  });

  it('deals a fresh hand every round, weighted to the tier (§6)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const state of playThrough(seed).steps) {
        expect(state.hand).toHaveLength(3);
        const tier = tierForRound(state.round, config.rounds);
        const fromTier = state.hand.filter((id) => byId.get(id)?.tier === tier);
        expect(fromTier.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('never deals a plan again once it has been placed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const placed = new Set<string>();
      for (const state of playThrough(seed).steps) {
        for (const id of state.hand) expect(placed.has(id)).toBe(false);
        const justPlaced = state.hand[0];
        if (justPlaced !== undefined) placed.add(justPlaced);
      }
    }
  });

  it('returns a passed-over plan to the pool — only what is placed is gone (§6)', () => {
    const opening = startGame(11);
    const kept = indoorInHand(opening);
    const passedOver = opening.hand.find((id) => id !== kept) as string;

    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId: kept });
    const next = game.reducer(selected, { type: 'PLACE', cell: 'D2' });

    expect(next.pool).not.toContain(kept);
    expect(next.pool).toContain(passedOver);
  });
});

describe('the line, and the pause for it (§8.6, §13)', () => {
  /** Force a placement that is guaranteed to say something. */
  function placeInto(seed: number, planId: string, cell: 'B1' | 'C4' | 'B4' | 'B2') {
    const state = startGame(seed);
    // The hand is drawn, so put the plan we want to test into it directly.
    const rigged: GameState = { ...state, hand: [planId], selectedPlanId: planId };
    return settle(game.reducer(rigged, { type: 'PLACE', cell }));
  }

  it('holds the round open while there is a line to read', () => {
    // The glass extension on the street elevation fires its north line.
    const placed = placeInto(1, 'glass-extension', 'B1');

    expect(placed.observation?.line).toBe(
      'The light is even and cold. You will heat this room more than any other.',
    );
    // §8.6 — and it says what caused it, so the plot can light it.
    expect(placed.observation?.cause).toBe('Glass-roofed extension, facing the street');
    expect(placed.observation?.cell).toBe('B1');
    expect(placed.round).toBe(1);
    expect(placed.placements).toHaveLength(1);
  });

  it('moves on when the line is dismissed', () => {
    const placed = placeInto(1, 'glass-extension', 'B1');
    const dismissed = game.reducer(placed, { type: 'DISMISS' });

    expect(dismissed.observation).toBeNull();
    expect(dismissed.round).toBe(2);
    expect(dismissed.hand).toHaveLength(3);
  });

  it('carries straight on when there is nothing to say (§8.6)', () => {
    // A shed in the garden, backing onto the old scullery: no pair, no
    // quality, no orientation. Silence, and the round advances without a dismissal.
    const placed = placeInto(1, 'shed', 'B4');
    expect(placed.observation).toBeNull();
    expect(placed.round).toBe(2);
  });

  it('accepts nothing but a dismissal while the line is up', () => {
    const placed = placeInto(1, 'glass-extension', 'B1');
    const otherPlan = deck[0]?.id as string;

    expect(game.reducer(placed, { type: 'SELECT_PLAN', planId: otherPlan })).toBe(placed);
    expect(game.reducer(placed, { type: 'PLACE', cell: 'D2' })).toBe(placed);
  });

  it('does nothing when dismissed with no line up', () => {
    const opening = startGame(1);
    expect(game.reducer(opening, { type: 'DISMISS' })).toBe(opening);
  });

  it('ends the game on the last line, not before it', () => {
    const { final, lines } = playThrough(7);
    expect(lines).toHaveLength(config.rounds);
    expect(final.phase).toBe('report');
    expect(final.observation).toBeNull();
  });

  it('says something at least sometimes, across many games', () => {
    // If the deck were written so that nothing ever fired, every test above
    // would still pass and the prototype would have nothing to test.
    let spoken = 0;
    for (let seed = 1; seed <= 30; seed++) {
      spoken += playThrough(seed).lines.filter((line) => line !== null).length;
    }
    expect(spoken).toBeGreaterThan(30);
  });
});

describe('selection', () => {
  it('clears after a placement', () => {
    const opening = startGame(3);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    expect(selected.selectedPlanId).toBe(planId);

    const placed = game.reducer(selected, { type: 'PLACE', cell: 'D2' });
    expect(placed.selectedPlanId).toBeNull();
  });

  it('toggles off when the same plan is clicked twice', () => {
    const opening = startGame(3);
    const planId = opening.hand[0] as string;
    const once = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const twice = game.reducer(once, { type: 'SELECT_PLAN', planId });
    expect(twice.selectedPlanId).toBeNull();
  });

  it('ignores a plan that is not in the hand', () => {
    const opening = startGame(3);
    const notDealt = deck.find((plan) => !opening.hand.includes(plan.id));
    const after = game.reducer(opening, {
      type: 'SELECT_PLAN',
      planId: notDealt?.id ?? 'nonsense',
    });
    expect(after.selectedPlanId).toBeNull();
  });
});

describe('placement (§7)', () => {
  it('does nothing without a selected plan', () => {
    const opening = startGame(5);
    expect(game.reducer(opening, { type: 'PLACE', cell: 'C1' })).toBe(opening);
  });

  it('refuses an illegal cell', () => {
    const opening = startGame(5);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    // E5 is the far corner — nothing touches it at the opening.
    expect(game.reducer(selected, { type: 'PLACE', cell: 'E5' })).toBe(selected);
  });

  it('records a placement onto fabric as a demolition (§7.2)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = settle(game.reducer(selected, { type: 'PLACE', cell: 'C3' }));

    expect(placed.placements[0]?.demolished).toBe(true);
    expect(placed.fabric).not.toContain('C3');
  });

  it('keeps the front door whatever else comes down (§7)', () => {
    // Every old room demolished, and the door still there. It is the one thing
    // about this house the player did not get to decide.
    const { final } = playThrough(5);
    expect(final.frontDoor).toBe('C1');
    expect(final.placements.map((placement) => placement.cell)).not.toContain('C1');
  });

  it('refuses to build on the front door at all (§7)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });

    expect(game.reducer(selected, { type: 'PLACE', cell: 'C1' })).toBe(selected);
  });

  it('leaves the old house standing when the placement is not on it', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'D2' });

    expect(placed.fabric).toEqual(opening.fabric);
    expect(placed.placements[0]?.demolished).toBe(false);
  });

  /* §5 — the zone rule. A plan belongs to the house or to the garden. */

  it('refuses to put an indoor plan in the garden (§5)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });

    // B4 is legal ground, and touches the old house — but not for a bathroom.
    expect(game.reducer(selected, { type: 'PLACE', cell: 'B4' })).toBe(selected);
  });

  it('refuses to put an outdoor plan in the house (§5)', () => {
    // The garden plans are the whole 'outside' tier plus a few wildcards, so
    // walk seeds until one turns up rather than assuming round 1 deals one.
    for (let seed = 1; seed <= 40; seed++) {
      const opening = startGame(seed);
      const planId = opening.hand.find((id) => byId.get(id)?.zone === 'outdoor');
      if (planId === undefined) continue;

      const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
      expect(game.reducer(selected, { type: 'PLACE', cell: 'D2' })).toBe(selected);
      expect(game.reducer(selected, { type: 'PLACE', cell: 'C3' })).toBe(selected);
      return;
    }
    throw new Error('no outdoor plan dealt in forty openings');
  });

  it('never places anything outside its own zone, across many seeds (§5)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const placement of playThrough(seed).final.placements) {
        const row = Number(placement.cell[1]);
        const zone = byId.get(placement.planId)?.zone;
        expect(zone).toBe(row >= 4 ? 'outdoor' : 'indoor');
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * The one confirmation — §7.2, §13
 * ------------------------------------------------------------------ */

describe('the demolition confirmation (§7.2, §13)', () => {
  /** Select an indoor plan from hand and aim it at a cell in the house. */
  function aim(seed: number, cell: 'C3' | 'B2' | 'D2') {
    const opening = startGame(seed);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    return { selected, proposed: game.reducer(selected, { type: 'PLACE', cell }) };
  }

  it('asks before taking any of the old house down', () => {
    const { proposed } = aim(5, 'C3');

    expect(proposed.pendingDemolition).toBe('C3');
    // Nothing has happened yet. The plan is still in hand, still selected.
    expect(proposed.placements).toEqual([]);
    expect(proposed.fabric).toContain('C3');
    expect(proposed.selectedPlanId).not.toBeNull();
  });

  it('is the only confirmation in the game (§13)', () => {
    const { proposed } = aim(5, 'D2');

    expect(proposed.pendingDemolition).toBeNull();
    expect(proposed.placements).toHaveLength(1);
  });

  it('takes it down when confirmed', () => {
    const { proposed } = aim(5, 'C3');
    const done = game.reducer(proposed, { type: 'CONFIRM_DEMOLITION' });

    expect(done.pendingDemolition).toBeNull();
    expect(done.placements[0]?.demolished).toBe(true);
    expect(done.fabric).not.toContain('C3');
  });

  it('leaves the old house standing when it is not, and keeps the plan in hand', () => {
    const { selected, proposed } = aim(5, 'C3');
    const backedOut = game.reducer(proposed, { type: 'CANCEL_DEMOLITION' });

    expect(backedOut.pendingDemolition).toBeNull();
    expect(backedOut.placements).toEqual([]);
    expect(backedOut.fabric).toEqual(selected.fabric);
    // Backing out returns the player to exactly where they were, not to the
    // start of the round.
    expect(backedOut.selectedPlanId).toBe(selected.selectedPlanId);
    expect(backedOut.hand).toEqual(selected.hand);
    expect(backedOut.round).toBe(selected.round);
  });

  it('lets a cancelled plan go somewhere else', () => {
    const { proposed } = aim(5, 'C3');
    const elsewhere = game.reducer(
      game.reducer(proposed, { type: 'CANCEL_DEMOLITION' }),
      { type: 'PLACE', cell: 'D2' },
    );

    expect(elsewhere.placements).toHaveLength(1);
    expect(elsewhere.placements[0]?.cell).toBe('D2');
    expect(elsewhere.placements[0]?.demolished).toBe(false);
  });

  it('accepts nothing else while it is waiting for an answer', () => {
    const { proposed } = aim(5, 'C3');
    const otherPlan = deck[0]?.id as string;

    expect(game.reducer(proposed, { type: 'SELECT_PLAN', planId: otherPlan })).toBe(
      proposed,
    );
    expect(game.reducer(proposed, { type: 'PLACE', cell: 'D2' })).toBe(proposed);
  });

  it('does nothing when answered with no question asked', () => {
    const opening = startGame(5);
    expect(game.reducer(opening, { type: 'CONFIRM_DEMOLITION' })).toBe(opening);
    expect(game.reducer(opening, { type: 'CANCEL_DEMOLITION' })).toBe(opening);
  });

  it('asks about every old room, including the one behind the door (§7)', () => {
    const { proposed } = aim(5, 'B2');
    expect(proposed.pendingDemolition).toBe('B2');

    const done = game.reducer(proposed, { type: 'CONFIRM_DEMOLITION' });
    expect(done.fabric).not.toContain('B2');
    // The door itself is not part of what came down. It never is.
    expect(done.frontDoor).toBe('C1');
  });

  it('never asks about the front door, because it is never on offer (§7)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const proposed = game.reducer(selected, { type: 'PLACE', cell: 'C1' });

    expect(proposed.pendingDemolition).toBeNull();
    expect(proposed).toBe(selected);
  });
});

describe('restart (§15)', () => {
  it('puts the plot back to the house that was inherited', () => {
    const { final } = playThrough(2);
    const again = game.reducer(final, { type: 'RESTART', seed: 4 });

    // A new game is a new round 1, so the framing is shown again — it is who
    // the house is for, and the next one is for them too.
    expect(again.phase).toBe('intro');
    expect(again.round).toBe(1);
    expect(again.placements).toEqual([]);
    expect(again.fabric).toEqual(['B2', 'C2', 'B3', 'C3']);
    expect(again.frontDoor).toBe('C1');
    expect(again.pool).toHaveLength(deck.length);
  });
});
