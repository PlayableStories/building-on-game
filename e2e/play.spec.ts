import { expect, test, type Page } from '@playwright/test';
import { config, plot, premise, ui } from '../src/content.ts';
import type { Where } from '../src/types.ts';

/** Read against whatever plot `content.ts` describes, not against this one. */
const ROOM = plot.fabric[0]!.cell;
/** An empty cell that is legal at the opening — somewhere ordinary to build. */
async function clearCell(page: Page): Promise<string> {
  await handFor(page, 'house').first().click();
  const refs = await legalCells(page).evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute('aria-label') ?? ''),
  );
  // Back to a cell id, which is what everything downstream of this deals in.
  const found = refs
    .map((label) => `G${refFromLabel(label)}`)
    .find((one) => !STANDING.includes(one));
  if (!found) throw new Error('no clear indoor cell at the opening');
  return found;
}
const OTHER_ROOM = plot.fabric[1]!.cell;
const DOOR = plot.frontDoor.cell;
const STANDING: string[] = [DOOR, ...plot.fabric.map((one) => one.cell)];

/**
 * A whole game, in a real browser.
 *
 * The jsdom tests in `src/App.test.tsx` already prove the click wiring works.
 * What they cannot see is layout and paint, which is most of what GDD §12 and
 * §13 are about: whether the plot reads as a grid with a street at the top and a
 * garden at the bottom, and whether "legal cell" is a visible state rather than
 * just a disabled attribute.
 */

const ROUNDS = config.rounds;

/** Load the game and dismiss the framing (§2) to reach round 1. */
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: ui.begin }).click();
}

/** §5 — which grid a cell id belongs to. 'GB2' is the ground floor's B2. */
const LEVEL_NAME: Record<string, string> = {
  G: ui.plot.levels.ground,
  F: ui.plot.levels.first,
  R: ui.plot.levels.roof,
};

/** §5 — move the board to a level. The switcher is above the grid. */
async function showLevel(page: Page, name: string) {
  const tab = page.locator('.plot__level', { hasText: name });
  if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click();
}

/**
 * §5 — the cell with this id. One level is on screen at a time, so a cell on
 * another one simply is not found: a test that means the first floor says so
 * with `showLevel` first. The board opens on the ground floor, which is where
 * almost everything below is aimed.
 */
function cell(page: Page, cellId: string) {
  const level = LEVEL_NAME[cellId[0] as string] as string;
  return page.getByRole('gridcell', {
    name: new RegExp(`^${level}, ${cellId.slice(1)},`),
  });
}

/** The 'B2' out of a cell's "Ground floor, B2, Old kitchen". */
function refFromLabel(label: string): string {
  return (label.split(',')[1] ?? '').trim();
}

function legalCells(page: Page) {
  return page.locator('.cell:not([disabled])');
}

function hand(page: Page) {
  return page.locator('.plan');
}

/**
 * §5 — a plan in hand that belongs to one part of the building. Tests that aim
 * at a named cell need one that is allowed to go there.
 */
function handFor(page: Page, where: Where) {
  return page.locator(`.plan[data-where="${where}"]`);
}

function observation(page: Page) {
  return page.locator('.observation');
}

function demolition(page: Page) {
  return page.locator('.demolition');
}

/**
 * §7.2, §13 — a placement onto the old house stops and asks. Say yes, so that
 * demolition is exercised by these tests rather than avoided by them.
 */
async function confirmDemolition(page: Page) {
  if ((await demolition(page).count()) > 0) {
    await page.getByRole('button', { name: ui.demolition.confirm }).click();
  }
}

/**
 * One round: choose a plan, place it, answer for it if it was the old house, and
 * read past the line if there is one. §8.6 — silence is a valid result, so there
 * is not always a line to dismiss.
 */
async function playRound(page: Page) {
  await hand(page).first().click();
  await legalCells(page).first().click();
  await confirmDemolition(page);
  if ((await observation(page).count()) > 0) await observation(page).click();
}

async function background(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
}

/** Fail the test on anything the browser complains about. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('the plot (§5, §12)', () => {
  test('lays out as a 5×5 grid', async ({ page }) => {
    await start(page);
    const cells = page.getByRole('gridcell');
    await expect(cells).toHaveCount(25);

    const boxes = await cells.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      }),
    );

    expect(new Set(boxes.map((box) => box.x)).size).toBe(5);
    expect(new Set(boxes.map((box) => box.y)).size).toBe(5);
  });

  /**
   * §5 — the switcher. Three levels, one on screen, and the ground floor first
   * because that is where a game starts and where most of it happens.
   */
  test('shows one level at a time, and switches between them', async ({ page }) => {
    await start(page);

    const tabs = page.locator('.plot__level');
    await expect(tabs).toHaveCount(3);
    // Top to bottom, the way the building stands.
    await expect(tabs).toHaveText([
      ui.plot.levels.roof,
      ui.plot.levels.first,
      ui.plot.levels.ground,
    ]);
    await expect(page.getByRole('grid')).toHaveCount(1);
    await expect(page.getByRole('grid', { name: ui.plot.levels.ground })).toBeVisible();

    // §5 — the upper levels are the building only, so they stop where the
    // garden starts, and the street and garden labels stay with the ground.
    await showLevel(page, ui.plot.levels.first);
    await expect(page.getByRole('grid', { name: ui.plot.levels.first })).toBeVisible();
    await expect(page.getByRole('gridcell')).toHaveCount(15);
    await expect(page.locator('.plot__edge--street')).toHaveCount(0);
    await expect(page.locator('.plot__edge--garden')).toHaveCount(0);

    // §5 — the stair arrives at an inherited landing. It is what seeds the
    // first floor, so it is standing before anything is built.
    await expect(cell(page, 'FB1')).toContainText(ui.plot.landing);
    await expect(cell(page, 'FB1')).toContainText(ui.plot.inherited);

    await showLevel(page, ui.plot.levels.ground);
    await expect(page.getByRole('gridcell')).toHaveCount(25);
  });

  /**
   * §5 — choosing a plan takes the board to the level it goes on. Without it a
   * player who picks a bedroom sees a ground floor with nothing lit, and the
   * level rule reads as the game refusing to work.
   */
  test('follows the chosen plan to its level, and marks it beforehand', async ({
    page,
  }) => {
    await start(page);

    for (let round = 1; round <= ROUNDS; round++) {
      if ((await handFor(page, 'upstairs').count()) > 0) {
        const marked = page.locator('.plot__level[data-legal="true"]');
        await handFor(page, 'upstairs').first().click();

        await expect(page.getByRole('grid', { name: ui.plot.levels.first })).toBeVisible();
        await expect(marked).toHaveText([ui.plot.levels.first]);
        expect(await legalCells(page).count()).toBeGreaterThan(0);
        return;
      }
      await playRound(page);
    }
    throw new Error('no upstairs plan dealt in a whole game');
  });

  test('puts the street at the top and the garden at the bottom', async ({ page }) => {
    await start(page);

    const street = await page.locator('.plot__edge--street').boundingBox();
    const garden = await page.locator('.plot__edge--garden').boundingBox();
    const row1 = await cell(page, 'GA1').boundingBox();
    const row5 = await cell(page, 'GA5').boundingBox();

    expect(street && row1 && garden && row5).toBeTruthy();
    // Row 1 is north — the street. Row 5 is south — the garden, and the sun.
    expect(street!.y).toBeLessThan(row1!.y);
    expect(row1!.y).toBeLessThan(row5!.y);
    expect(row5!.y).toBeLessThan(garden!.y);
  });

  test('shows the inherited house as named rooms on different fabric (§12)', async ({
    page,
  }) => {
    await start(page);

    // §12 — each old room says what it is, in the same face as any placement,
    // with "inherited" small and quiet underneath.
    for (const room of plot.fabric) {
      await expect(cell(page, room.cell)).toContainText(room.name);
      await expect(cell(page, room.cell)).toContainText(ui.plot.inherited);
    }

    // §7 — the front door, on the street, printed like any other room.
    await expect(cell(page, plot.frontDoor.cell)).toContainText(plot.frontDoor.name);
    await expect(cell(page, plot.frontDoor.cell)).toContainText(ui.plot.inherited);

    // The name is the loud part and "inherited" is the quiet one, not the other
    // way round — the emphasis this milestone exists to swap.
    const sizes = await cell(page, plot.frontDoor.cell).evaluate((element) => ({
      name: parseFloat(
        getComputedStyle(element.querySelector('.cell__name') as Element).fontSize,
      ),
      inherited: parseFloat(
        getComputedStyle(element.querySelector('.cell__inherited') as Element).fontSize,
      ),
    }));
    expect(sizes.inherited).toBeLessThan(sizes.name);

    // A distinct muted fill with a visible edge — not just a different label.
    const fabric = await background(page, '.cell--fabric');
    const empty = await background(page, '.cell--empty');
    expect(fabric).not.toBe(empty);

    const border = await page
      .locator('.cell--fabric')
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopColor);
    expect(border).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('placement (§13)', () => {
  test('highlights legal cells only once a plan is selected, and does so visibly', async ({
    page,
  }) => {
    await start(page);
    await expect(legalCells(page)).toHaveCount(0);

    const before = await background(page, '.cell--empty');
    await handFor(page, 'house').first().click();

    // The old rooms, plus every empty indoor cell touching what is standing —
    // never the front door, whichever cell that is.
    expect(await legalCells(page).count()).toBeGreaterThanOrEqual(plot.fabric.length);
    await expect(cell(page, DOOR)).toBeDisabled();

    const after = await background(page, '.cell--legal');
    expect(after).not.toBe(before);
  });

  test('offers a garden plan the garden, and nothing in the house (§5)', async ({
    page,
  }) => {
    await start(page);

    // The garden tier arrives late, so play on until one is dealt.
    for (let round = 1; round <= ROUNDS; round++) {
      if ((await handFor(page, 'garden').count()) > 0) {
        await handFor(page, 'garden').first().click();

        const labels = await legalCells(page).evaluateAll((cells) =>
          cells.map((cell) => cell.getAttribute('aria-label') ?? ''),
        );
        expect(labels.length).toBeGreaterThan(0);
        for (const label of labels) {
          // §5 — the garden is rows 4 and 5 of the ground floor, and nowhere
          // else. A garden plan never lights an upper level.
          expect(label.startsWith(`${ui.plot.levels.ground},`)).toBe(true);
          expect(Number(refFromLabel(label)[1])).toBeGreaterThanOrEqual(4);
        }
        return;
      }
      await playRound(page);
    }
    throw new Error('no garden plan dealt in a whole game');
  });

  test('places on click and cannot be undone (§7.3)', async ({ page }) => {
    await start(page);

    const ref = await clearCell(page);
    const name = await handFor(page, 'house').first().locator('.plan__name').innerText();
    await cell(page, ref).click();

    // The block is on the plot before the line is read — you see what you did.
    await expect(cell(page, ref)).toContainText(name);
    if ((await observation(page).count()) > 0) await observation(page).click();

    await expect(page.getByText(`2 of ${ROUNDS}`)).toBeVisible();

    // Placed cells are never offered again. A ground-floor plan on purpose:
    // §5 — choosing one that goes upstairs would take the board with it, and
    // the cell this test is about is downstairs.
    await handFor(page, 'house').first().click();
    await expect(cell(page, ref)).toBeDisabled();
  });
});

test.describe('a whole game (§15)', () => {
  test('reaches the finish in eight placements, with nothing in the console', async ({
    page,
  }) => {
    const errors = watchForErrors(page);
    await start(page);

    for (let round = 1; round <= ROUNDS; round++) {
      await expect(page.getByText(`${round} of ${ROUNDS}`)).toBeVisible();
      await expect(hand(page)).toHaveCount(3);

      await playRound(page);
    }

    await expect(page.getByText(ui.report.finished)).toBeVisible();

    // §5 — a finished house is spread over three levels and the board shows
    // one, so count each in turn. All eight are somewhere on the building.
    let placed = 0;
    for (const level of Object.values(ui.plot.levels)) {
      await showLevel(page, level);
      placed += await page.locator('.cell--placed').count();
    }
    expect(placed).toBe(ROUNDS);

    // §10.1 — nothing is totalled or displayed during play.
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['score', 'points', 'budget', 'total', '£', '$']) {
      expect(text).not.toContain(forbidden);
    }

    expect(errors).toEqual([]);
  });

  test('starts over from the inherited house', async ({ page }) => {
    await start(page);

    for (let round = 1; round <= ROUNDS; round++) {
      await playRound(page);
    }

    await page.getByRole('button', { name: ui.report.again }).click();

    // A new game is a new round 1, so the framing comes back with it.
    await expect(page.locator('.intro')).toBeVisible();
    await page.getByRole('button', { name: ui.begin }).click();

    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(plot.fabric.length);
  });
});

test.describe('the one confirmation (§7.2, §13)', () => {
  /** Choose a plan for the house and aim it at a named cell. */
  async function aimAt(page: Page, ref: string): Promise<string> {
    await start(page);
    const chosen = handFor(page, 'house').first();
    const name = await chosen.locator('.plan__name').innerText();
    await chosen.click();
    await cell(page, ref).click();
    return name;
  }

  test('asks before taking any of the old house down, and not otherwise', async ({
    page,
  }) => {
    await aimAt(page, ROOM);
    await expect(demolition(page)).toBeVisible();
    // Nothing has happened yet — all four cells of the old house are standing.
    await expect(page.locator('.cell--fabric')).toHaveCount(plot.fabric.length);
    await expect(page.locator('.cell--placed')).toHaveCount(0);
  });

  test('does not ask for an ordinary placement', async ({ page }) => {
    await start(page);
    await aimAt(page, await clearCell(page));
    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--placed')).toHaveCount(1);
  });

  test('keeps the plot visible, so you can see what you are about to take down', async ({
    page,
  }) => {
    await aimAt(page, ROOM);
    await expect(page.getByRole('gridcell')).toHaveCount(25);
    // The hand waits until it has an answer.
    await expect(hand(page)).toHaveCount(0);
  });

  test('takes it down on Take it down', async ({ page }) => {
    const name = await aimAt(page, ROOM);
    await page.getByRole('button', { name: ui.demolition.confirm }).click();

    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(plot.fabric.length - 1);
    await expect(cell(page, ROOM)).toContainText(name);
  });

  test('leaves it standing on Put it somewhere else, and on Escape', async ({ page }) => {
    await aimAt(page, ROOM);
    await page.getByRole('button', { name: ui.demolition.cancel }).click();

    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(plot.fabric.length);
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    // Still round 1, still holding the plan, so it can go somewhere else.
    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
    await expect(page.locator('.plan--selected')).toHaveCount(1);

    await cell(page, ROOM).click();
    await expect(demolition(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(plot.fabric.length);
  });

  test('names the room coming down rather than its grid reference (§12)', async ({
    page,
  }) => {
    await aimAt(page, OTHER_ROOM);
    await expect(demolition(page)).toContainText(
      new RegExp(plot.fabric[1]!.name, 'i'),
    );
    await page.keyboard.press('Escape');

    await cell(page, ROOM).click();
    await expect(demolition(page)).toContainText(
      new RegExp(plot.fabric[0]!.name, 'i'),
    );
  });

  test('never asks about the front door, because it never offers it (§7)', async ({
    page,
  }) => {
    await start(page);
    await handFor(page, 'house').first().click();

    // Not merely unhighlighted — not clickable at all. The one cell in the game
    // that is never a decision.
    await expect(cell(page, DOOR)).toBeDisabled();
    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
  });

  test('keeps the front door standing through a whole game (§7)', async ({ page }) => {
    await start(page);
    for (let round = 1; round <= ROUNDS; round++) await playRound(page);

    await expect(cell(page, DOOR)).toContainText(plot.frontDoor.name);
    await expect(cell(page, DOOR)).toContainText(ui.plot.inherited);
  });
});

test.describe('the consent flag in hand (§9.1, §14)', () => {
  test('shows one flag per plan, in words', async ({ page }) => {
    await start(page);

    const flags = page.locator('.plan__consent');
    await expect(flags).toHaveCount(3);
    for (let index = 0; index < 3; index++) {
      const text = await flags.nth(index).innerText();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test('never reads as an outcome, through a whole game (§9.1)', async ({ page }) => {
    await start(page);

    for (let round = 1; round <= ROUNDS; round++) {
      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const forbidden of ['refused', 'approved', 'granted', 'rejected', 'denied']) {
        expect(text).not.toContain(forbidden);
      }
      await playRound(page);
    }

    // Including the report, where the obligations are actually written out.
    const finished = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['refused', 'approved', 'granted', 'rejected', 'denied']) {
      expect(finished).not.toContain(forbidden);
    }
  });
});

test.describe('the report (§10)', () => {
  async function playToTheEnd(page: Page) {
    await start(page);
    for (let round = 1; round <= ROUNDS; round++) {
      await playRound(page);
    }
    await expect(page.locator('.report')).toBeVisible();
  }

  /**
   * §10.2 — the layout is the argument, so this is the layer that can check it.
   * jsdom can prove the pairs exist; only a browser can prove that on a wide
   * screen the obligation is genuinely level with the benefit it belongs to,
   * and that on a narrow one it is directly underneath it rather than regrouped
   * into a list of its own.
   */
  test('puts what it asks level with what you have (§10.2)', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await playToTheEnd(page);

    const rows = page.locator('.report__pair');
    await expect(rows).toHaveCount(3);

    for (let index = 0; index < 3; index++) {
      const row = rows.nth(index);
      const have = await row.locator('.report__have').boundingBox();
      const care = await row.locator('.report__care').boundingBox();
      expect(have && care).toBeTruthy();
      // Side by side, on the same line, benefit on the left.
      expect(have!.y).toBe(care!.y);
      expect(have!.x).toBeLessThan(care!.x);
    }
  });

  test('keeps them together when the columns collapse (§10.2)', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 1400 });
    await playToTheEnd(page);

    const rows = page.locator('.report__pair');
    await expect(rows).toHaveCount(3);

    for (let index = 0; index < 3; index++) {
      const row = rows.nth(index);
      const have = await row.locator('.report__have').boundingBox();
      const care = await row.locator('.report__care').boundingBox();
      // Stacked now — but its own obligation, immediately under it.
      expect(care!.y).toBeGreaterThan(have!.y);
    }

    // And nothing has regrouped them into two lists, which would be the old
    // report again in a taller shape.
    const order = await page.locator('.report__have, .report__care').evaluateAll(
      (elements) => elements.map((element) => element.className),
    );
    expect(order).toEqual([
      'report__have',
      'report__care',
      'report__have',
      'report__care',
      'report__have',
      'report__care',
    ]);
  });

  test('is short enough to read to the end (§10.2)', async ({ page }) => {
    await playToTheEnd(page);

    await expect(page.locator('.report__pair')).toHaveCount(3);
    expect(await page.locator('.report__obligation').count()).toBeLessThanOrEqual(2);
  });

  test('describes the cost in words, never a number (§10.2)', async ({ page }) => {
    await playToTheEnd(page);
    const cost = await page
      .locator('.report__note')
      .filter({ hasText: ui.report.cost })
      .locator('.report__note-line')
      .innerText();
    expect(cost).not.toMatch(/\d/);
    expect(cost.trim().length).toBeGreaterThan(0);
  });

  test('closes on a line, and answers the situation it opened on (§10.3, §10.4)', async ({
    page,
  }) => {
    // §2 — capture the situation before it goes, so the answer can be checked
    // against the question rather than merely for being non-empty.
    await page.goto('/');
    const question = await page.locator('.intro__situation').innerText();
    await page.getByRole('button', { name: ui.begin }).click();
    for (let round = 1; round <= ROUNDS; round++) await playRound(page);

    await expect(page.locator('.report__closing')).toBeVisible();
    const closing = await page.locator('.report__closing').innerText();
    expect(closing.trim().length).toBeGreaterThan(0);

    // One answer, not three — and a reaction to the house, not the setup line.
    await expect(page.locator('.report__answer')).toHaveCount(1);
    const answer = await page.locator('.report__answer').innerText();
    expect(answer.trim().length).toBeGreaterThan(0);
    expect(answer.trim()).not.toBe(question.trim());
  });

  test('shows none of it before the last plan lands, with a clean console (§10.1)', async ({
    page,
  }) => {
    const errors = watchForErrors(page);
    await start(page);

    for (let round = 1; round <= ROUNDS; round++) {
      await expect(page.locator('.report')).toHaveCount(0);
      await playRound(page);
    }

    await expect(page.locator('.report')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('the framing (§2, §13, §14)', () => {
  test('comes before the plot, and does not come back', async ({ page }) => {
    await page.goto('/');

    // Why the work is happening at all, and the one situation it is for.
    await expect(page.getByText(premise)).toBeVisible();
    await expect(page.locator('.intro__situation')).toHaveCount(1);

    // Nothing to play with yet.
    await expect(page.getByRole('grid')).toHaveCount(0);
    await expect(page.locator('.plan')).toHaveCount(0);

    await page.getByRole('button', { name: ui.begin }).click();

    await expect(page.getByRole('grid')).toBeVisible();
    await expect(page.locator('.intro')).toHaveCount(0);

    // §2 — never mentioned again during play.
    for (let round = 1; round <= ROUNDS; round++) {
      await expect(page.locator('.intro__situation')).toHaveCount(0);
      await playRound(page);
    }
  });

  test('draws a different situation from game to game (§2)', async ({ page }) => {
    // The whole argument for replacing the fixed household. A stuck draw would
    // be the old three-people problem with fewer people.
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.goto('/');
      seen.add((await page.locator('.intro__situation').innerText()).trim());
      if (seen.size > 1) break;
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test('says how the game works, and keeps saying it (§13)', async ({ page }) => {
    await page.goto('/');

    // The two things playtesting found a first-time player did not know.
    const intro = (await page.locator('.intro').innerText()).toLowerCase();
    expect(intro).toContain('no way to lose');
    expect(intro).toContain('taken down');

    await page.getByRole('button', { name: ui.begin }).click();
    await expect(page.locator('.rules--open')).toHaveCount(0);

    // Mid-round, with a plan chosen: the rules open over the top and the round
    // underneath is untouched when they close.
    await hand(page).first().click();
    const legal = await legalCells(page).count();

    await page.getByRole('button', { name: ui.rules.open }).click();
    const card = page.locator('.rules--open');
    await expect(card).toBeVisible();
    await expect(card).toContainText('no way to lose');
    await expect(card).toContainText('taken down');
    // The plot stays visible behind it — this is a lookup, not a screen change.
    await expect(page.getByRole('grid')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
    await expect(legalCells(page)).toHaveCount(legal);
    await expect(page.locator('.plan--selected')).toHaveCount(1);
  });
});

test.describe('the line (§8.6, §13)', () => {
  /** Play until a placement actually says something, then stop on it. */
  /**
   * Play until a placement actually says something.
   *
   * §8.6 — silence is a valid result, and the M7 measurements put a completely
   * silent playthrough at about 3 games in 400. The seed is fresh on every page
   * load, so a single attempt would leave every test that calls this with a
   * ~0.75% chance of failing for a reason that is not a bug. Three attempts
   * puts that below one in a million; still bounded, so a deck that genuinely
   * never speaks fails rather than hangs.
   */
  async function playUntilLine(page: Page) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await start(page);
      for (let round = 1; round <= ROUNDS; round++) {
        await hand(page).first().click();
        await legalCells(page).first().click();
        await confirmDemolition(page);
        if ((await observation(page).count()) > 0) return;
      }
    }
    throw new Error('no placement in three whole games said anything');
  }

  test('holds the round, keeps the plot visible, and reads as one sentence', async ({
    page,
  }) => {
    await start(page);
    await playUntilLine(page);

    await expect(observation(page)).toBeVisible();
    // The plot stays up: seeing the block you just placed while reading the
    // line about it is the whole transaction.
    await expect(page.getByRole('grid')).toBeVisible();
    // The hand for the next round waits.
    await expect(hand(page)).toHaveCount(0);

    const text = await observation(page).locator('.observation__line').innerText();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  /**
   * §8.6 — the fix for the line landing as atmosphere. jsdom can prove the
   * classes are on the right cells; only a real browser can prove the dimming
   * actually paints, which is the whole mechanism.
   */
  test('names its cause and lights the cells it is about (§8.6)', async ({ page }) => {
    await start(page);
    await playUntilLine(page);

    // The cause, above the line and quieter than it.
    const cause = await observation(page).locator('.observation__cause').innerText();
    expect(cause.trim().length).toBeGreaterThan(0);

    // Exactly one placement is the subject, and it is named in the cause.
    const subject = page.locator('.cell--subject');
    await expect(subject).toHaveCount(1);
    await expect(subject).toHaveClass(/cell--placed/);
    const name = await subject.locator('.cell__name').innerText();
    expect(cause).toContain(name);

    // …and everything the line is not about is actually dimmed on screen.
    const opacity = await page.evaluate(() => {
      const lit = document.querySelector('.cell--subject') as Element;
      const other = document.querySelector(
        '.cell:not(.cell--subject):not(.cell--cause)',
      ) as Element;
      return {
        lit: Number(getComputedStyle(lit).opacity),
        other: Number(getComputedStyle(other).opacity),
      };
    });
    expect(opacity.lit).toBe(1);
    expect(opacity.other).toBeLessThan(1);
  });

  test('stops dimming the plot once the line has been read (§8.6)', async ({ page }) => {
    await start(page);
    await playUntilLine(page);
    await observation(page).click();

    await expect(page.locator('.plot--reading')).toHaveCount(0);
    await expect(page.locator('.cell--subject')).toHaveCount(0);

    const opacity = await page
      .locator('.cell')
      .first()
      .evaluate((cell) => Number(getComputedStyle(cell).opacity));
    expect(opacity).toBe(1);
  });

  test('is dismissed by click, Space and Enter (§13)', async ({ page }) => {
    for (const dismiss of ['click', 'Space', 'Enter'] as const) {
      await start(page);
      await playUntilLine(page);

      if (dismiss === 'click') await observation(page).click();
      else await page.keyboard.press(dismiss);

      await expect(observation(page)).toHaveCount(0);
      await expect(hand(page)).toHaveCount(3);
    }
  });

  test('says something at least once in a game', async ({ page }) => {
    await start(page);
    let spoken = 0;

    for (let round = 1; round <= ROUNDS; round++) {
      await hand(page).first().click();
      await legalCells(page).first().click();
      await confirmDemolition(page);
      if ((await observation(page).count()) > 0) {
        spoken++;
        await observation(page).click();
      }
    }

    expect(spoken).toBeGreaterThan(0);
  });
});

test.describe('screenshots', () => {
  test('captures the opening, a game in progress, and the finish', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1100 });

    await page.goto('/');
    await page.screenshot({ path: 'e2e/screenshots/00-framing.png', fullPage: true });

    await page.getByRole('button', { name: ui.begin }).click();
    await page.screenshot({ path: 'e2e/screenshots/01-opening.png', fullPage: true });

    // Selected but not yet placed: this is the frame that shows the highlight,
    // and with it the placement rule — a house plan lights the ground floor
    // and not the garden (§5).
    await handFor(page, 'house').first().click();
    await page.screenshot({ path: 'e2e/screenshots/02-selected.png', fullPage: true });

    // §13 — the rules looked up mid-round, over a game in progress.
    await page.getByRole('button', { name: ui.rules.open }).click();
    await page.screenshot({ path: 'e2e/screenshots/02b-rules.png', fullPage: true });
    await page.keyboard.press('Escape');

    // §7.2, §13 — the one question the game asks. Aimed at the old kitchen,
    // which is the room the player is most likely to want the space of.
    await cell(page, OTHER_ROOM).click();
    await page.screenshot({ path: 'e2e/screenshots/03-demolition.png', fullPage: true });
    await page.keyboard.press('Escape');

    await legalCells(page).first().click();
    await confirmDemolition(page);
    if ((await observation(page).count()) > 0) await observation(page).click();

    // Play on until something is actually said, and capture that — the line is
    // the whole point of the prototype (§8.6).
    for (let round = 2; round <= ROUNDS; round++) {
      await hand(page).first().click();
      await legalCells(page).first().click();
      await confirmDemolition(page);
      if ((await observation(page).count()) > 0) {
        await page.screenshot({ path: 'e2e/screenshots/04-line.png', fullPage: true });
        await observation(page).click();
        break;
      }
    }
    await page.screenshot({ path: 'e2e/screenshots/05-midway.png', fullPage: true });

    while ((await page.getByText(ui.report.finished).count()) === 0) {
      await playRound(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/06-finished.png', fullPage: true });
  });
});
