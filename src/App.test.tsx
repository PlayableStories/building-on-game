import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App.tsx';
import type { Where } from './types.ts';
import {
  causeWords,
  config,
  consentLabels,
  deck,
  plot,
  premise,
  rules,
  situations,
  ui,
  whyNow,
} from './content.ts';

/**
 * Everything standing at the start: the fixed entrance, the stair, the landing
 * the stair arrives at, and the old rooms. The landing is derived by the engine
 * rather than written in content, so it is named here rather than imported.
 */
const inherited = [plot.frontDoor, plot.stair, ...plot.fabric];
/**
 * How many *inherited* labels are on screen at once. One level shows at a time
 * (§5), so this is the ground floor's share: the front door, the stair and the
 * old rooms. The landing is inherited too, but it is upstairs.
 */
const INHERITED_LABELS = inherited.length;
const ROOM = plot.fabric[0]!.cell;
const OTHER_ROOM = plot.fabric[1]!.cell;
const DOOR = plot.frontDoor.cell;


afterEach(cleanup);

const planNames = new Set(deck.map((plan) => plan.name));

/** Render, then dismiss the framing (§2) to get to round 1. */
function renderPlaying() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: ui.begin }));
}

/**
 * §5 — the board is three levels now and shows one at a time, so `cells()` is
 * whichever level is on screen. A test that means a particular one switches to
 * it first with `showLevel`.
 */
function cells() {
  return screen.getAllByRole('gridcell');
}

function levelGrid(name: string) {
  return screen.getByRole('grid', { name });
}

/** Click the level switcher. Returns the cells that level turned out to have. */
function showLevel(name: string) {
  fireEvent.click(screen.getByRole('button', { name, pressed: false }));
  return within(levelGrid(name)).getAllByRole('gridcell');
}

function cellsOn(name: string) {
  const grid = screen.queryByRole('grid', { name });
  return grid === null ? showLevel(name) : within(grid).getAllByRole('gridcell');
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

const whereByName = new Map(deck.map((plan) => [plan.name, plan.where]));

/**
 * §5 — a plan in hand that belongs to the given part of the building. Tests that
 * aim at a named cell need one allowed to go there; returns null when this hand
 * has none, which is normal for the garden and the roof in an early round.
 */
function handButtonFor(where: Where): HTMLElement | null {
  return (
    handButtons().find(
      (button) =>
        whereByName.get(button.querySelector('.plan__name')?.textContent ?? '') === where,
    ) ?? null
  );
}

/** The label reads "Ground floor, B2, Old kitchen" — this is the 'B2'. */
function refOf(cell: Element): string {
  return ((cell.getAttribute('aria-label') ?? '').split(',')[1] ?? '').trim();
}

const GRID_FOR_LEVEL: Record<string, string> = {
  G: ui.plot.levels.ground,
  F: ui.plot.levels.first,
  R: ui.plot.levels.roof,
};

/**
 * The one cell with this id. Three grids share the reference 'B2', so a search
 * across the document finds whichever level renders first — which is the roof,
 * and never what a test aiming at the old kitchen meant.
 */
function cellAt(cellId: string): HTMLElement {
  const grid = GRID_FOR_LEVEL[cellId[0] as string] as string;
  const found = cellsOn(grid).find((cell) => refOf(cell) === cellId.slice(1));
  if (!found) throw new Error(`no cell ${cellId}`);
  return found;
}

/** The small quiet label under every cell that came with the house. */
function inheritedCells() {
  return screen.getAllByText(ui.plot.inherited);
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
  if (asking) fireEvent.click(screen.getByRole('button', { name: ui.demolition.confirm }));
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
  it('is three levels of grid, one at a time, with every inherited room named', () => {
    renderPlaying();
    // §5 — the ground floor is the whole plot; the first floor and the roof are
    // the building only, so they stop where the garden starts.
    expect(cellsOn(ui.plot.levels.roof)).toHaveLength(15);
    expect(cellsOn(ui.plot.levels.first)).toHaveLength(15);
    expect(cellsOn(ui.plot.levels.ground)).toHaveLength(25);

    // …and only ever one of them, so a reference like B2 means one cell.
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    expect(cells()).toHaveLength(25);

    // §12 — the old rooms say what they are, in the same face as any placement,
    // and murmur "inherited" underneath. The front door does too, because it is
    // inherited as well; it just cannot be taken down.
    for (const { name } of inherited) {
      expect(screen.getByText(name)).toBeDefined();
    }
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS);

    // §5 — the stair arrives at an inherited landing, which is what seeds the
    // first floor. It is on the first floor, so it is only named up there.
    expect(screen.queryByText(ui.plot.landing)).toBeNull();
    showLevel(ui.plot.levels.first);
    expect(screen.getByText(ui.plot.landing)).toBeDefined();
  });

  /**
   * §5 — the switcher mostly operates itself. Choosing a plan that goes
   * upstairs takes the board upstairs, because the alternative is a player
   * looking at a ground floor with nothing lit and no way to know why.
   */
  it('follows the chosen plan to the level it can go on (§5)', () => {
    renderPlaying();
    expect(levelGrid(ui.plot.levels.ground)).toBeDefined();

    // §6 — the private tier is entirely upstairs and every hand is at least
    // two-thirds its own tier, so one turns up. Playing forward rather than
    // rigging the hand, because App deals its own seed and this has to hold
    // for all of them.
    let upstairs = handButtonFor('upstairs');
    for (let round = 1; upstairs === null && round < config.rounds; round++) {
      playRound();
      upstairs = handButtonFor('upstairs');
    }
    if (upstairs === null) throw new Error('no upstairs plan was ever dealt');

    fireEvent.click(upstairs);
    expect(levelGrid(ui.plot.levels.first)).toBeDefined();
    expect(legalCells().length).toBeGreaterThan(0);
  });

  it('offers no legal cell until a plan is chosen (§13)', () => {
    renderPlaying();
    expect(legalCells()).toHaveLength(0);

    // §5 — where a plan can go depends on which half of the plot it belongs to.
    const indoors = handButtonFor('house');
    if (!indoors) throw new Error('no ground-floor plan in the opening hand');
    fireEvent.click(indoors);
    // The old rooms, plus every empty ground cell touching what is standing.
    // Never the front door or the stair, whichever cells those are.
    expect(legalCells().length).toBeGreaterThanOrEqual(plot.fabric.length);
    expect(legalCells().map(refOf)).not.toContain(plot.frontDoor.cell.slice(1));
    expect(legalCells().map(refOf)).not.toContain(plot.stair.cell.slice(1));
  });

  it('offers a garden plan only the garden (§5)', () => {
    renderPlaying();
    const outdoors = handButtonFor('garden');
    // The garden tier arrives late, so an opening hand may hold none.
    if (!outdoors) return;

    fireEvent.click(outdoors);
    for (const cell of legalCells()) {
      expect(Number(refOf(cell)[1])).toBeGreaterThanOrEqual(4);
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
    expect(screen.getByText(ui.report.finished)).toBeDefined();
    expect(screen.queryByText(`${config.rounds} of ${config.rounds}`)).toBeNull();
  });

  it('shows the finished plot with every placement named on it', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      playRound();
    }

    // §5 — a finished house is spread over three levels and the board shows
    // one, so this counts each in turn. Every placement is named on whichever
    // level it landed on, and none of them is named twice.
    const named = Object.values(ui.plot.levels).flatMap((level) =>
      cellsOn(level)
        .map((cell) => cell.querySelector('.cell__name')?.textContent ?? '')
        .filter((name) => planNames.has(name)),
    );
    expect(named).toHaveLength(config.rounds);
    expect(new Set(named).size).toBe(config.rounds);
  });

  it('starts over from the inherited house on Build again (§14)', () => {
    renderPlaying();

    for (let round = 1; round <= config.rounds; round++) {
      playRound();
    }

    fireEvent.click(screen.getByRole('button', { name: ui.report.again }));

    // A new game is a new round 1, so the framing comes back with it.
    expect(screen.getByText(whyNow)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: ui.begin }));

    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(handButtons()).toHaveLength(3);
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS);
  });
});

describe('the framing, before round 1 (§2, §14)', () => {
  it('says why the work is happening, and gives exactly one situation', () => {
    render(<App />);

    expect(screen.getByText(premise)).toBeDefined();
    expect(screen.getByText(whyNow)).toBeDefined();

    // §2 — one, not three. Three were forgotten by round three.
    const shown = situations.filter(
      (situation) => screen.queryByText(situation.line) !== null,
    );
    expect(shown).toHaveLength(1);
  });

  it('says how the game works before it asks for a placement (§13)', () => {
    render(<App />);

    expect(screen.getByText(rules.objective)).toBeDefined();
    for (const point of rules.points) {
      expect(screen.getByText(point)).toBeDefined();
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
      for (const situation of situations) {
        expect(screen.queryByText(situation.line)).toBeNull();
      }
      playRound();
    }
  });
});

/**
 * §13 — the fix for a first-time player not knowing what they were being asked
 * to do. The rules are a lookup available for the whole game, not a tutorial
 * shown once, and looking them up is not a move.
 */
describe('the rules, during play (§13)', () => {
  function rulesCard() {
    return document.querySelector('.rules--open');
  }

  function rulesButton() {
    return screen.getByRole('button', { name: ui.rules.open });
  }

  it('is not up until it is asked for', () => {
    renderPlaying();
    expect(rulesCard()).toBeNull();
    expect(rulesButton()).toBeDefined();
  });

  it('opens on the button and shows every rule', () => {
    renderPlaying();
    fireEvent.click(rulesButton());

    const card = rulesCard();
    if (!card) throw new Error('the rules did not open');
    expect(card.textContent).toContain(rules.objective);
    for (const point of rules.points) {
      expect(card.textContent).toContain(point);
    }
  });

  it('closes again, on the button, on Back, and on Escape', () => {
    renderPlaying();

    fireEvent.click(rulesButton());
    fireEvent.click(rulesButton());
    expect(rulesCard()).toBeNull();

    fireEvent.click(rulesButton());
    fireEvent.click(screen.getByRole('button', { name: ui.rules.close }));
    expect(rulesCard()).toBeNull();

    fireEvent.click(rulesButton());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(rulesCard()).toBeNull();
  });

  it('leaves the round exactly where it was — reading is not a move', () => {
    renderPlaying();

    // Mid-round, with a plan chosen and cells highlighted.
    fireEvent.click(handButtons()[0] as HTMLElement);
    const before = legalCells().length;
    const chosen = document.querySelector('.plan--selected .plan__name')?.textContent;

    fireEvent.click(rulesButton());
    fireEvent.click(screen.getByRole('button', { name: ui.rules.close }));

    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(legalCells()).toHaveLength(before);
    expect(document.querySelector('.plan--selected .plan__name')?.textContent).toBe(
      chosen,
    );
  });

  it('is still there in the last round (§13)', () => {
    renderPlaying();
    for (let round = 1; round < config.rounds; round++) playRound();

    expect(screen.getByText(`${config.rounds} of ${config.rounds}`)).toBeDefined();
    fireEvent.click(rulesButton());
    expect(rulesCard()).not.toBeNull();
  });
});

describe('the line, through the interface (§8.6, §13)', () => {
  /** Play until a placement actually says something, then stop on it. */
  /**
   * §8.6 — silence is a valid result, and about 3 games in 400 say nothing at
   * all. The seed is fresh on every render, so one attempt would leave every
   * test here with a small chance of failing for a reason that is not a bug.
   */
  function playUntilLine(): Element {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        cleanup();
        renderPlaying();
      }
      for (let round = 1; round <= config.rounds; round++) {
        fireEvent.click(handButtons()[0] as HTMLElement);
        fireEvent.click(legalCells()[0] as HTMLElement);
        confirmDemolition();
        const line = observation();
        if (line) return line;
      }
    }
    throw new Error('no placement in three whole games said anything');
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

    // §5 — one level is on screen, and it is the one the line is about: the
    // sentence and the cells it names have to be readable together.
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    expect(document.querySelector('.cell--subject')).not.toBeNull();
  });

  /**
   * §8.6 — the fix for "I do not aware the line is directly related to my
   * placement and/or the neighbour". Every line names its cause above itself,
   * and the plot lights the cells that cause is about.
   */
  it('names what caused it, above the line', () => {
    renderPlaying();
    const line = playUntilLine();

    const cause = line.querySelector('.observation__cause')?.textContent ?? '';
    expect(cause.trim().length).toBeGreaterThan(0);

    // It names the plan the line is about. Anchored on the lit cell rather than
    // on document order, which is not placement order — the grid is laid out in
    // rows and a placement can land anywhere in it.
    const subject = document.querySelector('.cell--subject');
    expect(subject).not.toBeNull();
    expect(cause).toContain(subject?.querySelector('.cell__name')?.textContent);
  });

  it('lights the placement the line is about, and dims the rest', () => {
    renderPlaying();
    playUntilLine();

    expect(document.querySelector('.plot--reading')).not.toBeNull();
    const lit = cells().filter((cell) => cell.classList.contains('cell--subject'));
    expect(lit).toHaveLength(1);

    // …and it is a placement, not an empty cell — the thing that just moved.
    const subject = lit[0] as HTMLElement;
    expect(subject.classList.contains('cell--placed')).toBe(true);

    // The cause above the line names it, so the words and the board agree.
    const cause =
      document.querySelector('.observation__cause')?.textContent ?? '';
    expect(cause).toContain(subject.querySelector('.cell__name')?.textContent);
  });

  it('lights the neighbour too, whenever a neighbour caused it', () => {
    // Some games say nothing but orientation lines, which are about the row
    // rather than about anything next door. Three fresh games rather than one,
    // for the same reason `playUntilLine` takes three.
    for (let attempt = 1; attempt <= 3; attempt++) {
      cleanup();
      renderPlaying();

      for (let round = 1; round <= config.rounds; round++) {
        fireEvent.click(handButtons()[0] as HTMLElement);
        fireEvent.click(legalCells()[0] as HTMLElement);
        confirmDemolition();

        const line = observation();
        if (!line) continue;

        const causes = cells().filter((cell) => cell.classList.contains('cell--cause'));
        const cause = line.querySelector('.observation__cause')?.textContent ?? '';
        if (causes.length > 0) {
          for (const lit of causes) {
            // §8.6 — a placed neighbour is named; the old house is named
            // collectively, because 'beside the old kitchen and the old
            // scullery' is a list, and what it is beside is one building.
            const expected = lit.classList.contains('cell--inherited')
              ? causeWords.fabric
              : (lit.querySelector('.cell__name')?.textContent ?? '');
            expect(cause).toContain(expected);
          }
          return;
        }
        // An orientation line lights nothing next door — and says so, by naming
        // what it faces instead of what it is beside. Read on.
        fireEvent.click(line);
      }
    }
    throw new Error('no line in three whole games was caused by a neighbour');
  });

  it('stops dimming the plot once the line has been read', () => {
    renderPlaying();
    fireEvent.click(playUntilLine());

    expect(document.querySelector('.plot--reading')).toBeNull();
    expect(document.querySelector('.cell--subject')).toBeNull();
    expect(document.querySelector('.cell--cause')).toBeNull();
  });
});

describe('the one confirmation (§7.2, §13)', () => {
  /**
   * Choose a plan for the house and aim it at a named cell. Returns the plan
   * chosen — captured before aiming, because the hand is not on screen once the
   * game has stopped to ask.
   */
  function aimAt(cellId: string): string {
    renderPlaying();
    const chosen = handButtonFor('house');
    if (!chosen) throw new Error('no ground-floor plan in the opening hand');
    const name = chosen.querySelector('.plan__name')?.textContent ?? '';
    fireEvent.click(chosen);

    fireEvent.click(cellAt(cellId));
    return name;
  }

  /**
   * An empty cell that is legal at the opening — somewhere an ordinary
   * placement can go. Derived rather than named, so this reads against whatever
   * plot `content.ts` describes.
   */
  function clearCell(): string {
    renderPlaying();
    const chosen = handButtonFor('house');
    if (!chosen) throw new Error('no ground-floor plan in the opening hand');
    fireEvent.click(chosen);
    const found = legalCells()
      .map((cell) => `G${refOf(cell)}`)
      .find((one) => !plot.fabric.some((room) => room.cell === one));
    cleanup();
    if (!found) throw new Error('no clear ground-floor cell at the opening');
    return found;
  }

  function asking() {
    const found = demolition();
    if (!found) throw new Error('the game did not ask');
    return found;
  }

  it('asks before taking any of the old house down', () => {
    aimAt(ROOM);
    expect(demolition()).not.toBeNull();
    // Nothing has happened yet — the old house is still on the plot.
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS);
  });

  it('does not ask for any other placement', () => {
    aimAt(clearCell());
    expect(demolition()).toBeNull();
  });

  it('says plainly that it cannot be undone', () => {
    aimAt(ROOM);
    expect(screen.getByText(ui.demolition.note)).toBeDefined();
  });

  it('names the room that is coming down, rather than its grid reference (§12)', () => {
    aimAt(ROOM);
    expect(asking().textContent?.toLowerCase()).toContain(
      (plot.fabric[0] as { name: string }).name.toLowerCase(),
    );

    cleanup();
    aimAt(OTHER_ROOM);
    expect(asking().textContent?.toLowerCase()).toContain(
      (plot.fabric[1] as { name: string }).name.toLowerCase(),
    );
  });

  it('never asks about the front door, because it is never on offer (§7)', () => {
    aimAt(DOOR);
    expect(demolition()).toBeNull();
    // Still round 1, and nothing has been placed — the click did nothing at all.
    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS);
    expect(screen.getByText(plot.frontDoor.name)).toBeDefined();
  });

  it('takes it down on Take it down', () => {
    aimAt(ROOM);
    fireEvent.click(screen.getByRole('button', { name: ui.demolition.confirm }));

    expect(demolition()).toBeNull();
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS - 1);
  });

  it('leaves it standing on Put it somewhere else, with the plan still chosen', () => {
    const chosen = aimAt(ROOM);
    fireEvent.click(screen.getByRole('button', { name: ui.demolition.cancel }));

    expect(demolition()).toBeNull();
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS);
    expect(screen.getByText(`1 of ${config.rounds}`)).toBeDefined();
    // The plan is still in hand and still selected, so it can go elsewhere.
    expect(document.querySelector('.plan--selected .plan__name')?.textContent).toBe(
      chosen,
    );
    expect(legalCells().length).toBeGreaterThan(0);
  });

  it('backs out on Escape', () => {
    aimAt(ROOM);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(demolition()).toBeNull();
    expect(inheritedCells()).toHaveLength(INHERITED_LABELS);
  });

  it('hides the hand while it is waiting for an answer', () => {
    aimAt(ROOM);
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

  function pairs() {
    return Array.from(document.querySelectorAll('.report__pair'));
  }

  it('is three rows, each pairing a benefit with what it asks (§10.2)', () => {
    playToTheEnd();

    const rows = pairs();
    expect(rows).toHaveLength(3);

    for (const row of rows) {
      const name = row.querySelector('.report__name')?.textContent ?? '';
      const have = row.querySelector('.report__have')?.textContent ?? '';
      const care = row.querySelector('.report__care')?.textContent ?? '';

      expect(planNames.has(name)).toBe(true);
      expect(have.length).toBeGreaterThan(0);
      expect(care.length).toBeGreaterThan(0);
      // The whole point of the shape: they are in the same element, so there is
      // no reading order in which one arrives without the other.
      expect(row.contains(row.querySelector('.report__care'))).toBe(true);
    }
  });

  it('only reports plans that are on the finished plot', () => {
    playToTheEnd();

    // §5 — across all three levels, because the report is about the house and
    // the house is not one floor.
    const onPlot = new Set(
      Object.values(ui.plot.levels).flatMap((level) =>
        cellsOn(level)
          .map((cell) => cell.querySelector('.cell__name')?.textContent ?? '')
          .filter((name) => planNames.has(name)),
      ),
    );
    for (const row of pairs()) {
      expect(onPlot.has(row.querySelector('.report__name')?.textContent ?? '')).toBe(
        true,
      );
    }
  });

  it('is short enough to read to the end (§10.2)', () => {
    playToTheEnd();

    // The finding this milestone exists for: "too complicate and too long".
    // Three rows, a cost line, at most two obligations, a closing and an answer.
    expect(pairs()).toHaveLength(3);
    expect(
      document.querySelectorAll('.report__obligation').length,
    ).toBeLessThanOrEqual(2);
    expect(document.querySelectorAll('.report__note')).toHaveLength(2);
  });

  it('describes the cost in words, never a number (§10.2)', () => {
    playToTheEnd();

    const notes = Array.from(document.querySelectorAll('.report__note'));
    const cost = notes.find(
      (note) => note.querySelector('.report__note-label')?.textContent === 'Cost',
    );
    const line = cost?.querySelector('.report__note-line')?.textContent ?? '';
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toMatch(/\d/);
  });

  /**
   * §10.5 — what you would actually have to submit. Between the obligations
   * and the closing line: it is the same subject one step further out, and the
   * closing line is the last word.
   */
  it('says what you would have to apply for, before it closes (§10.5)', () => {
    playToTheEnd();

    const planning = document.querySelector('.planning');
    expect(planning).not.toBeNull();
    expect(planning?.querySelector('.planning__needed')?.textContent?.length).toBeGreaterThan(0);

    // …and the attribution is on the page with the figures, never separated
    // from them: a rate with no visible denominator is a prediction (§9.1).
    const record = planning?.querySelector('.planning__record')?.textContent ?? '';
    if (record.length > 0) {
      expect(planning?.querySelector('.planning__source')?.textContent ?? '').not.toBe('');
    }

    // Order on the page: obligations, then this, then the closing line.
    const order = Array.from(
      document.querySelectorAll('.report__notes, .planning, .report__closing'),
    ).map((node) => node.className.split(' ')[0]);
    expect(order).toEqual(['report__notes', 'planning', 'report__closing']);
  });

  it('closes on one sentence about what kind of house it is (§10.3)', () => {
    playToTheEnd();
    const closing = document.querySelector('.report__closing');
    expect(closing).not.toBeNull();
    expect((closing?.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('answers the one situation it opened on, in one line (§10.4)', () => {
    playToTheEnd();

    const answer = document.querySelector('.report__answer')?.textContent ?? '';
    expect(answer.length).toBeGreaterThan(0);
    // A reaction to the finished house, not the setup line from the intro.
    expect(situations.map((situation) => situation.line)).not.toContain(answer);
    // One answer, not six.
    expect(document.querySelectorAll('.report__answer')).toHaveLength(1);
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
    fireEvent.click(screen.getByRole('button', { name: ui.report.again }));
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
