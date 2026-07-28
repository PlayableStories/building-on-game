import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.tsx';
import {
  config,
  consentLabels,
  deck,
  household,
  premise,
  whyNow,
} from './content.ts';

afterEach(cleanup);

const planNames = new Set(deck.map((plan) => plan.name));

/** Render, then dismiss the framing (§2) to get to round 1. */
function renderPlaying() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
}

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

const zoneByName = new Map(deck.map((plan) => [plan.name, plan.zone]));

/**
 * §5 — a plan in hand that goes in the given half of the plot. Tests that aim at
 * a named cell need one that is allowed to go there; returns null when this hand
 * has none, which is normal for the garden in an early round.
 */
function handButtonFor(zone: 'indoor' | 'outdoor'): HTMLElement | null {
  return (
    handButtons().find(
      (button) =>
        zoneByName.get(button.querySelector('.plan__name')?.textContent ?? '') === zone,
    ) ?? null
  );
}

/** The small quiet label under every cell that came with the house. */
function inheritedCells() {
  return within(grid()).getAllByText('inherited');
}

function observation() {
  return document.querySelector('.observation');
}

function demolition() {
  return document.querySelector('.demolition');
}

/**
 * §7.2, §13 — a placement onto the old house stops and asks. Say yes, so that
 * demolition is exercised by these tests rather than avoided by them.
 */
function confirmDemolition() {
  const asking = demolition();
  if (asking) fireEvent.click(screen.getByRole('button', { name: 'Take it down' }));
}

/**
 * One round: choose a plan, place it, answer for it if it was the old house, and
 * read past the line if there is one. §8.6 — silence is a valid result, so there
 * is not always a line to dismiss.
 */
function playRound() {
  fireEvent.click(handButtons()[0] as HTMLElement);
  fireEvent.click(legalCells()[0] as HTMLElement);
  confirmDemolition();
  const line = observation();
  if (line) fireEvent.click(line);
}

/**
 * These drive the real components rather than the reducer, so they cover the
 * wiring the engine tests cannot: that a click on a plan highlights cells, that
 * a click on a highlighted cell places, and that the round advances.
 */
describe('a whole game, played through the interface', () => {
  it('is 25 cells, with every inherited room named on the grid', () => {
    renderPlaying();
    expect(cells()).toHaveLength(25);

    // §12 — the old rooms say what they are, in the same face as any placement,
    // and murmur "inherited" underneath. The front door does too, because it is
    // inherited as well; it just cannot be taken down.
    for (const name of ['Front door', 'Old kitchen', 'Old sitting room', 'Old scullery', 'Old back room']) {
      expect(within(grid()).getByText(name)).toBeDefined();
    }
    expect(inheritedCells()).toHaveLength(5);
  });

  it('offers no legal cell until a plan is chosen (§13)', () => {
    renderPlaying();
    expect(legalCells()).toHaveLength(0);

    // §5 — where a plan can go depends on which half of the plot it belongs to.
    const indoors = handButtonFor('indoor');
    if (!indoors) throw new Error('no indoor plan in the opening hand');
    fireEvent.click(indoors);
    // The opening position indoors: four old rooms plus the six empty cells
    // touching the house. Not the front door, which is never on offer.
    expect(legalCells()).toHaveLength(10);
    expect(
      legalCells().map((cell) => (cell.getAttribute('aria-label') ?? '').slice(0, 2)),
    ).not.toContain('C1');
  });

  it('offers a garden plan only the garden (§5)', () => {
    renderPlaying();
    const outdoors = handButtonFor('outdoor');
    // The garden tier arrives late, so an opening hand may hold none.
    if (!outdoors) return;

    fireEvent.click(outdoors);
    for (const cell of legalCells()) {
      const row = Number((cell.getAttribute('aria-label') ?? '')[1]);
      expect(row).toBeGreaterThanOrEqual(4);
    }
  });

  it('clears the highlighting when the plan is deselected', () => {
    renderPlaying();
    const plan = handButtons()[0] as HTMLElement;
    fireEvent.click(plan);
    expect(legalCells().length).toBeGreaterThan(0);
    fireEvent.click(plan);
    expect(legalCells()).toHaveLength(0);
  });

  it('deals three named plans each round and counts the rounds (§14)', () => {
    renderPlaying();

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
      confirmDemolition();

      const line = observation();
      if (line) fireEvent.click(line);
    }

    // §15 — the game ends when the last plan is placed. No score, no verdict.
    expect(screen.getByText('The house is finished.')).toBeDefined();
    expect(screen.queryByText(`${config.rounds} of ${config.rounds}`)).toBeNull();
  });

  it('shows the finished plot with every placement named on it', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      playRound();
    }

    const named = cells().filter((cell) => {
      const name = cell.querySelector('.cell__name')?.textContent ?? '';
      return planNames.has(name);
    });
    expect(named).toHaveLength(config.rounds);
  });

  it('starts over from the inherited house on Build again (§14)', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      playRound();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Build again' }));

    // A new game is a new round 1, so the framing comes back with it.
    expect(screen.getByText(whyNow)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));

    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(handButtons()).toHaveLength(3);
    expect(inheritedCells()).toHaveLength(5);
  });
});

describe('the framing, before round 1 (§2, §14)', () => {
  it('says why the work is happening and who the house is for', () => {
    render(<App />);

    expect(screen.getByText(premise)).toBeDefined();
    expect(screen.getByText(whyNow)).toBeDefined();
    for (const person of household) {
      expect(screen.getByText(person.name)).toBeDefined();
      expect(screen.getByText(person.line)).toBeDefined();
    }
  });

  it('shows no plot, no hand and no round count until it is dismissed', () => {
    render(<App />);

    expect(screen.queryByRole('grid', { name: 'The plot' })).toBeNull();
    expect(handButtons()).toHaveLength(0);
    expect(screen.queryByText(`1 of ${config.rounds}`)).toBeNull();
  });

  it('gives way to round 1, and does not come back during the game', () => {
    renderPlaying();

    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(screen.queryByText(whyNow)).toBeNull();

    // §2 — never mentioned again during play.
    for (let round = 1; round <= config.rounds; round++) {
      for (const person of household) {
        expect(screen.queryByText(person.line)).toBeNull();
      }
      playRound();
    }
  });
});

describe('the line, through the interface (§8.6, §13)', () => {
  /** Play until a placement actually says something, then stop on it. */
  function playUntilLine(): Element {
    for (let round = 1; round <= config.rounds; round++) {
      fireEvent.click(handButtons()[0] as HTMLElement);
      fireEvent.click(legalCells()[0] as HTMLElement);
      confirmDemolition();
      const line = observation();
      if (line) return line;
    }
    throw new Error('no placement in a whole game said anything');
  }

  it('shows one line, and holds the round on it', () => {
    renderPlaying();
    const line = playUntilLine();

    expect(line.querySelectorAll('.observation__line')).toHaveLength(1);
    expect((line.textContent ?? '').trim().length).toBeGreaterThan(0);
    // The hand for the next round waits until the line has been read.
    expect(handButtons()).toHaveLength(0);
  });

  it('gives the hand back when the line is clicked', () => {
    renderPlaying();
    fireEvent.click(playUntilLine());

    expect(observation()).toBeNull();
    expect(handButtons()).toHaveLength(3);
  });

  it('is dismissed by Enter (§13)', () => {
    renderPlaying();
    playUntilLine();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(observation()).toBeNull();
    expect(handButtons()).toHaveLength(3);
  });

  it('is dismissed by Space (§13)', () => {
    renderPlaying();
    playUntilLine();

    fireEvent.keyDown(window, { key: ' ' });
    expect(observation()).toBeNull();
    expect(handButtons()).toHaveLength(3);
  });

  it('is not dismissed by any other key', () => {
    renderPlaying();
    playUntilLine();

    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(observation()).not.toBeNull();
  });

  it('keeps the plot visible, so you can see what you just did', () => {
    renderPlaying();
    playUntilLine();

    expect(grid()).toBeDefined();
    expect(cells()).toHaveLength(25);
  });
});

describe('the one confirmation (§7.2, §13)', () => {
  /**
   * Choose a plan for the house and aim it at a named cell. Returns the plan
   * chosen — captured before aiming, because the hand is not on screen once the
   * game has stopped to ask.
   */
  function aimAt(ref: string): string {
    renderPlaying();
    const chosen = handButtonFor('indoor');
    if (!chosen) throw new Error('no indoor plan in the opening hand');
    const name = chosen.querySelector('.plan__name')?.textContent ?? '';
    fireEvent.click(chosen);

    const target = cells().find((cell) =>
      (cell.getAttribute('aria-label') ?? '').startsWith(ref),
    );
    if (!target) throw new Error(`no cell ${ref}`);
    fireEvent.click(target);
    return name;
  }

  function asking() {
    const found = demolition();
    if (!found) throw new Error('the game did not ask');
    return found;
  }

  it('asks before taking any of the old house down', () => {
    aimAt('C3');
    expect(demolition()).not.toBeNull();
    // Nothing has happened yet — the old house is still on the plot.
    expect(inheritedCells()).toHaveLength(5);
  });

  it('does not ask for any other placement', () => {
    aimAt('D2');
    expect(demolition()).toBeNull();
  });

  it('says plainly that it cannot be undone', () => {
    aimAt('C3');
    expect(screen.getByText('This cannot be undone.')).toBeDefined();
  });

  it('names the room that is coming down, rather than its grid reference (§12)', () => {
    aimAt('C3');
    expect(asking().textContent).toMatch(/old back room/i);

    cleanup();
    aimAt('B2');
    expect(asking().textContent).toMatch(/old kitchen/i);
  });

  it('never asks about the front door, because it is never on offer (§7)', () => {
    aimAt('C1');
    expect(demolition()).toBeNull();
    // Still round 1, and nothing has been placed — the click did nothing at all.
    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(inheritedCells()).toHaveLength(5);
    expect(within(grid()).getByText('Front door')).toBeDefined();
  });

  it('takes it down on Take it down', () => {
    aimAt('C3');
    fireEvent.click(screen.getByRole('button', { name: 'Take it down' }));

    expect(demolition()).toBeNull();
    expect(inheritedCells()).toHaveLength(4);
  });

  it('leaves it standing on Put it somewhere else, with the plan still chosen', () => {
    const chosen = aimAt('C3');
    fireEvent.click(screen.getByRole('button', { name: 'Put it somewhere else' }));

    expect(demolition()).toBeNull();
    expect(inheritedCells()).toHaveLength(5);
    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    // The plan is still in hand and still selected, so it can go elsewhere.
    expect(document.querySelector('.plan--selected .plan__name')?.textContent).toBe(
      chosen,
    );
    expect(legalCells().length).toBeGreaterThan(0);
  });

  it('backs out on Escape', () => {
    aimAt('C3');
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(demolition()).toBeNull();
    expect(inheritedCells()).toHaveLength(5);
  });

  it('hides the hand while it is waiting for an answer', () => {
    aimAt('C3');
    expect(handButtons()).toHaveLength(0);
    // The plot stays visible — you can see what you are about to take down.
    expect(cells()).toHaveLength(25);
  });
});

describe('the consent flag on each plan in hand (§9.1, §14)', () => {
  it('shows one flag per plan, in words rather than as a warning', () => {
    renderPlaying();

    const flags = handButtons().map(
      (button) => button.querySelector('.plan__consent')?.textContent ?? '',
    );
    expect(flags).toHaveLength(3);
    for (const flag of flags) {
      expect(Object.values(consentLabels)).toContain(flag);
    }
  });

  it('never says an application succeeded or failed (§9.1)', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      expect(document.body.textContent ?? '').not.toMatch(
        /\brefus|\bapproved\b|\bgranted\b|\brejected\b|\bdenied\b/i,
      );
      playRound();
    }
  });
});

describe('the report, when the eighth plan lands (§10)', () => {
  /** Play the whole game and stop on the report. */
  function playToTheEnd() {
    renderPlaying();
    for (let round = 1; round <= config.rounds; round++) {
      playRound();
    }
  }

  function column(heading: string) {
    const found = screen
      .getAllByRole('heading', { level: 2 })
      .find((element) => (element.textContent ?? '') === heading);
    if (!found?.parentElement) throw new Error(`no "${heading}" column`);
    return found.parentElement;
  }

  it('shows all three columns at once, in the order §10.2 fixes', () => {
    playToTheEnd();

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((element) => element.textContent);
    expect(headings).toEqual([
      'What you’ll have',
      'What it cost',
      'What you’ll look after',
    ]);
  });

  it('gives one have line per placement', () => {
    playToTheEnd();
    expect(column('What you’ll have').querySelectorAll('.report__item')).toHaveLength(
      config.rounds,
    );
  });

  it('makes what you will look after the longest column (§10.2)', () => {
    playToTheEnd();
    const words = (element: Element) => (element.textContent ?? '').split(/\s+/).length;
    expect(words(column('What you’ll look after'))).toBeGreaterThan(
      words(column('What you’ll have')),
    );
  });

  it('describes the cost in words, never a number (§10.2)', () => {
    playToTheEnd();
    const cost = column('What it cost').textContent ?? '';
    expect(cost.length).toBeGreaterThan('What it cost'.length);
    expect(cost).not.toMatch(/\d/);
  });

  it('closes on one sentence about what kind of house it is (§10.3)', () => {
    playToTheEnd();
    const closing = document.querySelector('.report__closing');
    expect(closing).not.toBeNull();
    expect((closing?.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('gives every member of the household one line about it (§10.4)', () => {
    playToTheEnd();

    const report = document.querySelector('.report');
    if (!report) throw new Error('no report');
    const people = report.querySelectorAll('.household__person');
    expect(people).toHaveLength(household.length);

    for (const [index, person] of household.entries()) {
      const shown = people[index] as HTMLElement;
      expect(shown.querySelector('.household__name')?.textContent).toBe(person.name);
      // A reaction to the finished house, not the setup line from the intro.
      const reaction = shown.querySelector('.household__line')?.textContent ?? '';
      expect(reaction.length).toBeGreaterThan(0);
      expect(reaction).not.toBe(person.line);
    }
  });

  it('shows none of it until the last plan is placed (§10.1)', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      expect(document.querySelector('.report')).toBeNull();
      playRound();
    }

    expect(document.querySelector('.report')).not.toBeNull();
  });

  it('clears the report on Build again (§14)', () => {
    playToTheEnd();
    fireEvent.click(screen.getByRole('button', { name: 'Build again' }));
    expect(document.querySelector('.report')).toBeNull();
  });
});

describe('what the interface must not show (§10.1, §14)', () => {
  it('shows no score, cost or timer at any point during play', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/score|points|£|\$|budget|total/i);
      playRound();
    }

    expect(document.body.textContent ?? '').not.toMatch(
      /score|points|£|\$|budget|total/i,
    );
  });
});
