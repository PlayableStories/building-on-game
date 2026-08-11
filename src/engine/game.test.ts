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
import { createRng, pick } from './rng.ts';

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
function whereOfPlan(planId: string) {
  const where = byId.get(planId)?.where;
  if (where === undefined) throw new Error(`no such plan: ${planId}`);
  return where;
}

/**
 * The first plan in hand that goes in the house. Most of the tests below aim at
 * a specific indoor cell, so they need a plan that is allowed to go there.
 */
function indoorInHand(state: GameState): string {
  const planId = state.hand.find((id) => byId.get(id)?.where === 'house');
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
    const cell = legalCells(selected, whereOfPlan(planId))[0];
    if (cell === undefined) throw new Error('no legal cell');

    const placed = settle(game.reducer(selected, { type: 'PLACE', cell }));
    lines.push(placed.observation);
    state =
      placed.observation === null ? placed : game.reducer(placed, { type: 'DISMISS' });
  }

  return { final: state, steps, lines };
}

/**
 * The same game, played by somebody choosing at random rather than always
 * reaching for the first card and the first square.
 *
 * Seeded off the game seed so a failure is reproducible, and deliberately kept
 * separate from `playThrough` rather than replacing it: the first-choice walk is
 * what most of the assertions in this file are written against, and it is fast.
 */
function playRandomly(seed: number): { final: GameState; steps: GameState[] } {
  const rng = createRng(seed ^ 0x5eed);
  const steps: GameState[] = [];
  let state = startGame(seed);

  while (state.phase === 'play') {
    steps.push(state);
    const planId = pick(state.hand, rng);
    if (planId === undefined) throw new Error('dealt an empty hand');
    const selected = game.reducer(state, { type: 'SELECT_PLAN', planId });
    const cell = pick(legalCells(selected, whereOfPlan(planId)), rng);
    if (cell === undefined) throw new Error('no legal cell');

    const placed = settle(game.reducer(selected, { type: 'PLACE', cell }));
    state = placed.observation === null ? placed : game.reducer(placed, { type: 'DISMISS' });
  }

  return { final: state, steps };
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

  /**
   * §5 — the gate on going vertical. The test above only proves the plan the
   * simulation happened to take could be placed; this one proves *every* plan
   * in *every* hand could have been, which is the thing four legality rules on
   * three levels could plausibly break. A hand with a plan the player cannot
   * put anywhere is a dead end with no explanation, and the game has no way to
   * apologise for it.
   *
   * Four hundred games rather than fifty because the levels multiplied the
   * states worth reaching, and this is cheap.
   */
  it('never deals a plan with nowhere to put it, on any level (§5)', () => {
    for (let seed = 1; seed <= 400; seed++) {
      for (const state of playThrough(seed).steps) {
        for (const planId of state.hand) {
          const cells = legalCells(state, whereOfPlan(planId));
          expect(cells.length, `${planId} had nowhere to go at seed ${seed}`)
            .toBeGreaterThan(0);
        }
      }
    }
  });

  /**
   * The same gate, played by somebody who does not always take the first thing.
   *
   * This matters more than it looks. `playThrough` takes the first plan and the
   * first legal cell every time, and it turns out that never reaches the states
   * where the board can strangle itself: it took a random walk to find that
   * roofing the cells around the landing kills the first floor for good, and
   * that one game in four hundred then dealt a hand of three plans with nowhere
   * to put any of them. The gate above had been passing over that the whole
   * time, because the walk it takes never goes there.
   *
   * A deterministic first-choice policy is a *shape* of play, not a sample of
   * one. Two shapes are not a proof either, but they are twice as many.
   */
  it('holds under a player who does not always take the first thing (§5, §15)', () => {
    for (let seed = 1; seed <= 400; seed++) {
      for (const state of playRandomly(seed).steps) {
        for (const planId of state.hand) {
          const cells = legalCells(state, whereOfPlan(planId));
          expect(cells.length, `${planId} had nowhere to go at seed ${seed}`)
            .toBeGreaterThan(0);
        }
      }
    }
  });

  /**
   * §5, §6 — the specific arrangement that found it, built on purpose.
   *
   * The first floor's whole opening move is the cells around the landing that
   * have a room underneath them: at the start that is FC1 over the front door
   * and FB2 over the old kitchen. Roof both and the upstairs frontier is gone
   * and can never come back, because roofing a cell seals the one beneath it.
   *
   * The rules are right — that irreversibility is the most interesting move in
   * §5. What must not happen is the game then offering a bedroom.
   */
  it('stops offering upstairs once the roof has sealed the way up (§5)', () => {
    let state = startGame(1);
    for (const cell of ['RC1', 'RB2'] as const) {
      state = settle(
        game.reducer(
          { ...state, hand: ['rooflight'], selectedPlanId: 'rooflight' },
          { type: 'PLACE', cell },
        ),
      );
      state = state.observation === null ? state : game.reducer(state, { type: 'DISMISS' });
    }

    // The board really is sealed…
    expect(legalCells(state, 'upstairs')).toEqual([]);
    // …the plans are still in the pool, because somewhere may yet open up…
    expect(state.pool).toContain('bedroom');
    // …and none of them is in the hand while there is nowhere to put it.
    for (const planId of state.hand) {
      expect(whereOfPlan(planId)).not.toBe('upstairs');
    }
  });

  /**
   * …and it is a filter, not a ban. The first floor is reachable from the
   * landing, so a new ground-floor room beside the stair opens a way up again
   * and the plans that were being held back come straight back into the draw.
   *
   * Worth its own test because the cheap version of the fix — dropping a plan
   * from the pool the first time it has nowhere to go — would pass every other
   * assertion in this file and quietly delete the first floor from the game.
   */
  it('offers upstairs again the moment a room opens a way up (§5)', () => {
    let state = startGame(1);
    for (const cell of ['RC1', 'RB2'] as const) {
      state = settle(
        game.reducer(
          { ...state, hand: ['rooflight'], selectedPlanId: 'rooflight' },
          { type: 'PLACE', cell },
        ),
      );
      state = state.observation === null ? state : game.reducer(state, { type: 'DISMISS' });
    }
    expect(legalCells(state, 'upstairs')).toEqual([]);

    // A1 is beside the stair, so a room there gives FA1 something to stand on
    // and the landing something to reach it from.
    state = settle(
      game.reducer(
        { ...state, hand: ['boot-room'], selectedPlanId: 'boot-room' },
        { type: 'PLACE', cell: 'GA1' },
      ),
    );
    state = state.observation === null ? state : game.reducer(state, { type: 'DISMISS' });

    expect(legalCells(state, 'upstairs')).toContain('FA1');
    expect(state.pool).toContain('bedroom');
  });

  /** §5, §7 — and nothing the simulation places ever lands somewhere it may not. */
  it('never places anything on an unsupported or fixed cell (§5, §7)', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { final, steps } = playThrough(seed);
      for (const [index, placement] of final.placements.entries()) {
        const before = steps[index];
        if (before === undefined) throw new Error('no state before the placement');
        const where = whereOfPlan(placement.planId);
        expect(legalCells(before, where)).toContain(placement.cell);
        expect([final.frontDoor, final.stair, final.landing]).not.toContain(placement.cell);
      }
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
    const next = game.reducer(selected, { type: 'PLACE', cell: 'GD2' });

    expect(next.pool).not.toContain(kept);
    expect(next.pool).toContain(passedOver);
  });
});

describe('the line, and the pause for it (§8.6, §13)', () => {
  /** Force a placement that is guaranteed to say something. */
  function placeInto(seed: number, planId: string, cell: 'GD1' | 'GC4' | 'GB4' | 'GB2') {
    const state = startGame(seed);
    // The hand is drawn, so put the plan we want to test into it directly.
    const rigged: GameState = { ...state, hand: [planId], selectedPlanId: planId };
    return settle(game.reducer(rigged, { type: 'PLACE', cell }));
  }

  it('holds the round open while there is a line to read', () => {
    // The glass extension on the street elevation fires its north line.
    const placed = placeInto(1, 'glass-extension', 'GD1');

    expect(placed.observation?.line).toBe(
      'The light is even and cold. You will heat this room more than any other.',
    );
    // §8.6 — and it says what caused it, so the plot can light it.
    expect(placed.observation?.cause).toBe('Glass-roofed extension, facing the street');
    expect(placed.observation?.cell).toBe('GD1');
    expect(placed.round).toBe(1);
    expect(placed.placements).toHaveLength(1);
  });

  it('moves on when the line is dismissed', () => {
    const placed = placeInto(1, 'glass-extension', 'GD1');
    const dismissed = game.reducer(placed, { type: 'DISMISS' });

    expect(dismissed.observation).toBeNull();
    expect(dismissed.round).toBe(2);
    expect(dismissed.hand).toHaveLength(3);
  });

  it('carries straight on when there is nothing to say (§8.6)', () => {
    // A shed in the garden, backing onto the old scullery: no pair, no
    // quality, no orientation. Silence, and the round advances without a dismissal.
    const placed = placeInto(1, 'shed', 'GB4');
    expect(placed.observation).toBeNull();
    expect(placed.round).toBe(2);
  });

  it('accepts nothing but a dismissal while the line is up', () => {
    const placed = placeInto(1, 'glass-extension', 'GD1');
    const otherPlan = deck[0]?.id as string;

    expect(game.reducer(placed, { type: 'SELECT_PLAN', planId: otherPlan })).toBe(placed);
    expect(game.reducer(placed, { type: 'PLACE', cell: 'GD2' })).toBe(placed);
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

  /* ---------------------------------------------------------------- *
   * Through the floor — §5, §8.6
   * ---------------------------------------------------------------- */

  /**
   * A kitchen on the ground floor and a bedroom put directly over it, both
   * through the real reducer. The unit tests in `adjacency.test.ts` prove the
   * resolution; this proves the game actually hands it the cell below.
   */
  function bedroomOverKitchen(): GameState {
    const kitchen = settle(
      game.reducer(
        { ...startGame(1), hand: ['kitchen'], selectedPlanId: 'kitchen' },
        { type: 'PLACE', cell: 'GB2' },
      ),
    );
    const cleared = game.reducer(kitchen, { type: 'DISMISS' });
    return settle(
      game.reducer(
        { ...cleared, hand: ['bedroom'], selectedPlanId: 'bedroom' },
        { type: 'PLACE', cell: 'FB2' },
      ),
    );
  }

  it('hears through a floor, and says which way round it is (§8.6)', () => {
    const placed = bedroomOverKitchen();

    expect(placed.observation?.line).toBe(
      'Dinner arrives through the floorboards an hour before you sleep.',
    );
    expect(placed.observation?.cause).toBe('Bedroom above Kitchen');
  });

  it('lights both ends of it, across two levels', () => {
    const placed = bedroomOverKitchen();

    expect(placed.observation?.cell).toBe('FB2');
    expect(placed.observation?.because).toContain('GB2');
  });

  /**
   * §8.6's gate, and the reason M16 measured before it changed anything.
   *
   * The ladder works because silence is possible: a line that fires on every
   * placement is wallpaper, and the player stops reading it. Two extra
   * neighbours per cell push against exactly that. Measured over 400 games the
   * silent share went 58.0% → 53.7%, so half the placements still say nothing.
   *
   * The floor is set well under that rather than at it. This is a guard against
   * a collapse, not a pin on a number that new writing is allowed to move.
   */
  it('still says nothing about half the time (§8.6)', () => {
    let placements = 0;
    let silent = 0;

    for (let seed = 1; seed <= 400; seed++) {
      const { lines } = playThrough(seed);
      placements += lines.length;
      silent += lines.filter((line) => line === null).length;
    }

    expect(silent / placements).toBeGreaterThan(0.4);
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

    const placed = game.reducer(selected, { type: 'PLACE', cell: 'GD2' });
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
    expect(game.reducer(opening, { type: 'PLACE', cell: 'GC1' })).toBe(opening);
  });

  it('refuses an illegal cell', () => {
    const opening = startGame(5);
    const planId = opening.hand[0] as string;
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    // E5 is the far corner — nothing touches it at the opening.
    expect(game.reducer(selected, { type: 'PLACE', cell: 'GE5' })).toBe(selected);
  });

  it('records a placement onto fabric as a demolition (§7.2)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = settle(game.reducer(selected, { type: 'PLACE', cell: 'GC3' }));

    expect(placed.placements[0]?.demolished).toBe(true);
    expect(placed.fabric).not.toContain('GC3');
  });

  it('keeps the front door whatever else comes down (§7)', () => {
    // Every old room demolished, and the door still there. It is the one thing
    // about this house the player did not get to decide.
    const { final } = playThrough(5);
    expect(final.frontDoor).toBe('GC1');
    expect(final.placements.map((placement) => placement.cell)).not.toContain('GC1');
  });

  it('refuses to build on the front door at all (§7)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });

    expect(game.reducer(selected, { type: 'PLACE', cell: 'GC1' })).toBe(selected);
  });

  it('leaves the old house standing when the placement is not on it', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const placed = game.reducer(selected, { type: 'PLACE', cell: 'GD2' });

    expect(placed.fabric).toEqual(opening.fabric);
    expect(placed.placements[0]?.demolished).toBe(false);
  });

  /* §5 — a plan belongs to one part of the building, and only there. */

  it('refuses to put a house plan in the garden (§5)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });

    // B4 is legal ground, and touches the old house — but not for a bathroom.
    expect(game.reducer(selected, { type: 'PLACE', cell: 'GB4' })).toBe(selected);
  });

  it('refuses to put an outdoor plan in the house (§5)', () => {
    // The garden plans are the whole 'outside' tier plus a few wildcards, so
    // walk seeds until one turns up rather than assuming round 1 deals one.
    for (let seed = 1; seed <= 40; seed++) {
      const opening = startGame(seed);
      const planId = opening.hand.find((id) => byId.get(id)?.where === 'garden');
      if (planId === undefined) continue;

      const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
      expect(game.reducer(selected, { type: 'PLACE', cell: 'GD2' })).toBe(selected);
      expect(game.reducer(selected, { type: 'PLACE', cell: 'GC3' })).toBe(selected);
      return;
    }
    throw new Error('no outdoor plan dealt in forty openings');
  });

  it('never places anything outside its own `where`, across many seeds (§5)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const placement of playThrough(seed).final.placements) {
        // 'GB4' — the level code, then the column, then the row.
        const level = placement.cell[0];
        const row = Number(placement.cell[2]);
        const where = byId.get(placement.planId)?.where;

        // §5 — every placement landed where its `where` says it may.
        if (where === 'garden') expect([level, row >= 4]).toEqual(['G', true]);
        if (where === 'house') expect([level, row >= 4]).toEqual(['G', false]);
        if (where === 'upstairs') expect(level).toBe('F');
        if (where === 'roof') expect(level).toBe('R');
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * The one confirmation — §7.2, §13
 * ------------------------------------------------------------------ */

describe('the demolition confirmation (§7.2, §13)', () => {
  /** Select an indoor plan from hand and aim it at a cell in the house. */
  function aim(seed: number, cell: 'GC3' | 'GB2' | 'GD2') {
    const opening = startGame(seed);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    return { selected, proposed: game.reducer(selected, { type: 'PLACE', cell }) };
  }

  it('asks before taking any of the old house down', () => {
    const { proposed } = aim(5, 'GC3');

    expect(proposed.pendingDemolition).toBe('GC3');
    // Nothing has happened yet. The plan is still in hand, still selected.
    expect(proposed.placements).toEqual([]);
    expect(proposed.fabric).toContain('GC3');
    expect(proposed.selectedPlanId).not.toBeNull();
  });

  it('is the only confirmation in the game (§13)', () => {
    const { proposed } = aim(5, 'GD2');

    expect(proposed.pendingDemolition).toBeNull();
    expect(proposed.placements).toHaveLength(1);
  });

  it('takes it down when confirmed', () => {
    const { proposed } = aim(5, 'GC3');
    const done = game.reducer(proposed, { type: 'CONFIRM_DEMOLITION' });

    expect(done.pendingDemolition).toBeNull();
    expect(done.placements[0]?.demolished).toBe(true);
    expect(done.fabric).not.toContain('GC3');
  });

  it('leaves the old house standing when it is not, and keeps the plan in hand', () => {
    const { selected, proposed } = aim(5, 'GC3');
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
    const { proposed } = aim(5, 'GC3');
    const elsewhere = game.reducer(
      game.reducer(proposed, { type: 'CANCEL_DEMOLITION' }),
      { type: 'PLACE', cell: 'GD2' },
    );

    expect(elsewhere.placements).toHaveLength(1);
    expect(elsewhere.placements[0]?.cell).toBe('GD2');
    expect(elsewhere.placements[0]?.demolished).toBe(false);
  });

  it('accepts nothing else while it is waiting for an answer', () => {
    const { proposed } = aim(5, 'GC3');
    const otherPlan = deck[0]?.id as string;

    expect(game.reducer(proposed, { type: 'SELECT_PLAN', planId: otherPlan })).toBe(
      proposed,
    );
    expect(game.reducer(proposed, { type: 'PLACE', cell: 'GD2' })).toBe(proposed);
  });

  it('does nothing when answered with no question asked', () => {
    const opening = startGame(5);
    expect(game.reducer(opening, { type: 'CONFIRM_DEMOLITION' })).toBe(opening);
    expect(game.reducer(opening, { type: 'CANCEL_DEMOLITION' })).toBe(opening);
  });

  it('asks about every old room, including the one behind the door (§7)', () => {
    const { proposed } = aim(5, 'GB2');
    expect(proposed.pendingDemolition).toBe('GB2');

    const done = game.reducer(proposed, { type: 'CONFIRM_DEMOLITION' });
    expect(done.fabric).not.toContain('GB2');
    // The door itself is not part of what came down. It never is.
    expect(done.frontDoor).toBe('GC1');
  });

  it('never asks about the front door, because it is never on offer (§7)', () => {
    const opening = startGame(5);
    const planId = indoorInHand(opening);
    const selected = game.reducer(opening, { type: 'SELECT_PLAN', planId });
    const proposed = game.reducer(selected, { type: 'PLACE', cell: 'GC1' });

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
    expect(again.fabric).toEqual(['GB2', 'GC2', 'GB3', 'GC3']);
    expect(again.frontDoor).toBe('GC1');
    expect(again.pool).toHaveLength(deck.length);
  });
});
