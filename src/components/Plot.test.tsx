/**
 * The plot — §5, §8.6.
 *
 * `App.test.tsx` plays the game, which means it plays whatever seed it was
 * dealt. That is the right way to test the wiring and the wrong way to test a
 * rare arrangement: a line that fires across two levels turns up in about half
 * of games, so a test that waited for one would be silently vacuous in the other
 * half. So this one builds the arrangement through the engine and renders the
 * board at it.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Plot from './Plot.tsx';
import {
  causeWords,
  config,
  deck,
  pairLines,
  plot,
  qualityLines,
  qualitySeverity,
  situations,
  ui,
} from '../content.ts';
import type { GameState } from '../types.ts';
import { createGame } from '../engine/game.ts';

afterEach(cleanup);

const game = createGame(
  deck,
  config,
  { pairLines, qualityLines, qualitySeverity, causeWords },
  plot,
  situations.map((situation) => situation.id),
);

/** §7.2 — a placement onto the old house stops and asks. Say yes and go on. */
function settle(state: GameState): GameState {
  return state.pendingDemolition === null
    ? state
    : game.reducer(state, { type: 'CONFIRM_DEMOLITION' });
}

/**
 * A kitchen on the ground floor with a bedroom put directly over it, driven
 * through the real reducer. It leaves the line up, which is the state under
 * test: a sentence about two cells on two different levels.
 */
function bedroomOverKitchen(): GameState {
  const opening = game.reducer(game.initialState(1), { type: 'BEGIN' });
  const kitchen = settle(
    game.reducer(
      { ...opening, hand: ['kitchen'], selectedPlanId: 'kitchen' },
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

function renderPlot(state: GameState) {
  return render(
    <Plot state={state} deck={deck} plot={plot} copy={ui.plot} onPlace={() => {}} />,
  );
}

function levelButton(name: string) {
  return screen.getByRole('button', { name });
}

describe('a line that crosses two levels (§5, §8.6)', () => {
  it('goes to the level of the placement, which is where the sentence starts', () => {
    renderPlot(bedroomOverKitchen());

    expect(levelButton(ui.plot.levels.first).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('grid').getAttribute('aria-label')).toBe(
      ui.plot.levels.first,
    );
  });

  it('lights the placement on the level it is on', () => {
    const { container } = renderPlot(bedroomOverKitchen());

    const subject = container.querySelectorAll('.cell--subject');
    expect(subject).toHaveLength(1);
    expect(subject[0]?.getAttribute('aria-label')).toMatch(
      new RegExp(`^${ui.plot.levels.first}, B2,`),
    );
  });

  /**
   * The half that only exists because the house gained floors. "Bedroom above
   * the kitchen" is half a sentence when the kitchen is on a level that is not
   * on screen, so the switcher has to say where the rest of it is.
   */
  it('marks the level the other end of it is on', () => {
    renderPlot(bedroomOverKitchen());

    expect(levelButton(ui.plot.levels.ground).dataset.cause).toBe('true');
    // …and not the level already on screen, which would be pointing at itself.
    expect(levelButton(ui.plot.levels.first).dataset.cause).toBe('false');
    expect(levelButton(ui.plot.levels.roof).dataset.cause).toBe('false');
  });

  it('has the other end lit when that level is looked at', () => {
    const state = bedroomOverKitchen();
    // The switcher moves the board; the line is unaffected, because the board
    // only follows a *new* observation.
    const { container } = renderPlot(state);
    fireEvent.click(levelButton(ui.plot.levels.ground));

    const cause = container.querySelector('.cell--cause');
    expect(cause?.getAttribute('aria-label')).toMatch(
      new RegExp(`^${ui.plot.levels.ground}, B2,`),
    );
  });

  it('marks nothing when the line is about one level only', () => {
    // A line whose cause is on the same floor has nothing to point at.
    const opening = game.reducer(game.initialState(1), { type: 'BEGIN' });
    const flat = settle(
      game.reducer(
        { ...opening, hand: ['glass-extension'], selectedPlanId: 'glass-extension' },
        { type: 'PLACE', cell: 'GD1' },
      ),
    );
    renderPlot(flat);

    expect(flat.observation).not.toBeNull();
    for (const level of Object.values(ui.plot.levels)) {
      expect(levelButton(level).dataset.cause).toBe('false');
    }
  });
});
