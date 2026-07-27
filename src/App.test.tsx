import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.tsx';
import { config, deck } from './content.ts';

afterEach(cleanup);

const planNames = new Set(deck.map((plan) => plan.name));

function grid() {
  return screen.getByRole('grid', { name: 'The plot' });
}

function cells() {
  return within(grid()).getAllByRole('gridcell');
}

function legalCells() {
  return cells().filter((cell) => !(cell as HTMLButtonElement).disabled);
}

function handButtons() {
  // The hand is the three plan buttons outside the grid.
  return screen
    .getAllByRole('button')
    .filter((button) => button.classList.contains('plan'));
}

/**
 * These drive the real components rather than the reducer, so they cover the
 * wiring the engine tests cannot: that a click on a plan highlights cells, that
 * a click on a highlighted cell places, and that the round advances.
 */
describe('a whole game, played through the interface', () => {
  it('is 25 cells, with the inherited house named on the grid', () => {
    render(<App />);
    expect(cells()).toHaveLength(25);
    expect(within(grid()).getAllByText('Inherited')).toHaveLength(4);
    expect(within(grid()).getByText('front door')).toBeDefined();
  });

  it('offers no legal cell until a plan is chosen (§13)', () => {
    render(<App />);
    expect(legalCells()).toHaveLength(0);

    fireEvent.click(handButtons()[0] as HTMLElement);
    // The opening position: four fabric cells plus the eight touching them.
    expect(legalCells()).toHaveLength(12);
  });

  it('clears the highlighting when the plan is deselected', () => {
    render(<App />);
    const plan = handButtons()[0] as HTMLElement;
    fireEvent.click(plan);
    expect(legalCells().length).toBeGreaterThan(0);
    fireEvent.click(plan);
    expect(legalCells()).toHaveLength(0);
  });

  it('deals three named plans each round and counts the rounds (§14)', () => {
    render(<App />);

    for (let round = 1; round <= config.rounds; round++) {
      expect(screen.getByText(`${round} of ${config.rounds}`)).toBeDefined();

      const hand = handButtons();
      expect(hand).toHaveLength(3);
      for (const button of hand) {
        const name = button.querySelector('.plan__name')?.textContent ?? '';
        expect(planNames.has(name)).toBe(true);
      }

      fireEvent.click(hand[0] as HTMLElement);
      const legal = legalCells();
      expect(legal.length).toBeGreaterThan(0);
      fireEvent.click(legal[0] as HTMLElement);
    }

    // §15 — the game ends when the last plan is placed. No score, no verdict.
    expect(screen.getByText('The house is finished.')).toBeDefined();
    expect(screen.queryByText(`${config.rounds} of ${config.rounds}`)).toBeNull();
  });

  it('shows the finished plot with every placement named on it', () => {
    render(<App />);

    for (let round = 1; round <= config.rounds; round++) {
      fireEvent.click(handButtons()[0] as HTMLElement);
      fireEvent.click(legalCells()[0] as HTMLElement);
    }

    const named = cells().filter((cell) => {
      const name = cell.querySelector('.cell__name')?.textContent ?? '';
      return planNames.has(name);
    });
    expect(named).toHaveLength(config.rounds);
  });

  it('starts over from the inherited house on Build again (§14)', () => {
    render(<App />);

    for (let round = 1; round <= config.rounds; round++) {
      fireEvent.click(handButtons()[0] as HTMLElement);
      fireEvent.click(legalCells()[0] as HTMLElement);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Build again' }));

    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(handButtons()).toHaveLength(3);
    expect(within(grid()).getAllByText('Inherited')).toHaveLength(4);
  });
});

describe('what the interface must not show (§10.1, §14)', () => {
  it('shows no score, cost or timer at any point during play', () => {
    render(<App />);

    for (let round = 1; round <= config.rounds; round++) {
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/score|points|£|\$|budget|total/i);
      fireEvent.click(handButtons()[0] as HTMLElement);
      fireEvent.click(legalCells()[0] as HTMLElement);
    }

    expect(document.body.textContent ?? '').not.toMatch(
      /score|points|£|\$|budget|total/i,
    );
  });
});
