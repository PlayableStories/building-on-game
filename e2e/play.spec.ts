import { expect, test, type Page } from '@playwright/test';

/**
 * A whole game, in a real browser.
 *
 * The jsdom tests in `src/App.test.tsx` already prove the click wiring works.
 * What they cannot see is layout and paint, which is most of what GDD §12 and
 * §13 are about: whether the plot reads as a grid with a street at the top and a
 * garden at the bottom, and whether "legal cell" is a visible state rather than
 * just a disabled attribute.
 */

const ROUNDS = 8;

/** Load the game and dismiss the framing (§2) to reach round 1. */
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
}

function cell(page: Page, ref: string) {
  return page.getByRole('gridcell', { name: new RegExp(`^${ref}[,$]`) });
}

function legalCells(page: Page) {
  return page.locator('.cell:not([disabled])');
}

function hand(page: Page) {
  return page.locator('.plan');
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
    await page.getByRole('button', { name: 'Take it down' }).click();
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

  test('puts the street at the top and the garden at the bottom', async ({ page }) => {
    await start(page);

    const street = await page.locator('.plot__edge--street').boundingBox();
    const garden = await page.locator('.plot__edge--garden').boundingBox();
    const row1 = await cell(page, 'A1').boundingBox();
    const row5 = await cell(page, 'A5').boundingBox();

    expect(street && row1 && garden && row5).toBeTruthy();
    // Row 1 is north — the street. Row 5 is south — the garden, and the sun.
    expect(street!.y).toBeLessThan(row1!.y);
    expect(row1!.y).toBeLessThan(row5!.y);
    expect(row5!.y).toBeLessThan(garden!.y);
  });

  test('shows the inherited house as visibly different fabric (§12)', async ({ page }) => {
    await start(page);

    for (const ref of ['B2', 'C2', 'B3', 'C3']) {
      await expect(cell(page, ref)).toContainText('Inherited');
    }
    await expect(page.getByText('front door')).toBeVisible();

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
    await hand(page).first().click();

    // Four fabric cells plus the eight touching them.
    await expect(legalCells(page)).toHaveCount(12);

    const after = await background(page, '.cell--legal');
    expect(after).not.toBe(before);
  });

  test('places on click and cannot be undone (§7.3)', async ({ page }) => {
    await start(page);

    const name = await hand(page).first().locator('.plan__name').innerText();
    await hand(page).first().click();
    await cell(page, 'C1').click();

    // The block is on the plot before the line is read — you see what you did.
    await expect(cell(page, 'C1')).toContainText(name);
    if ((await observation(page).count()) > 0) await observation(page).click();

    await expect(page.getByText(`2 of ${ROUNDS}`)).toBeVisible();

    // Placed cells are never offered again.
    await hand(page).first().click();
    await expect(cell(page, 'C1')).toBeDisabled();
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

    await expect(page.getByText('The house is finished.')).toBeVisible();
    await expect(page.locator('.cell--placed')).toHaveCount(ROUNDS);

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

    await page.getByRole('button', { name: 'Build again' }).click();

    // A new game is a new round 1, so the framing comes back with it.
    await expect(page.locator('.intro')).toBeVisible();
    await page.getByRole('button', { name: 'Begin' }).click();

    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(4);
  });
});

test.describe('the one confirmation (§7.2, §13)', () => {
  /** Choose the first plan in hand and aim it at a named cell. */
  async function aimAt(page: Page, ref: string): Promise<string> {
    await start(page);
    const name = await hand(page).first().locator('.plan__name').innerText();
    await hand(page).first().click();
    await cell(page, ref).click();
    return name;
  }

  test('asks before taking any of the old house down, and not otherwise', async ({
    page,
  }) => {
    await aimAt(page, 'C3');
    await expect(demolition(page)).toBeVisible();
    // Nothing has happened yet — all four cells of the old house are standing.
    await expect(page.locator('.cell--fabric')).toHaveCount(4);
    await expect(page.locator('.cell--placed')).toHaveCount(0);
  });

  test('does not ask for an ordinary placement', async ({ page }) => {
    await aimAt(page, 'C1');
    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--placed')).toHaveCount(1);
  });

  test('keeps the plot visible, so you can see what you are about to take down', async ({
    page,
  }) => {
    await aimAt(page, 'C3');
    await expect(page.getByRole('gridcell')).toHaveCount(25);
    // The hand waits until it has an answer.
    await expect(hand(page)).toHaveCount(0);
  });

  test('takes it down on Take it down', async ({ page }) => {
    const name = await aimAt(page, 'C3');
    await page.getByRole('button', { name: 'Take it down' }).click();

    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(3);
    await expect(cell(page, 'C3')).toContainText(name);
  });

  test('leaves it standing on Put it somewhere else, and on Escape', async ({ page }) => {
    await aimAt(page, 'C3');
    await page.getByRole('button', { name: 'Put it somewhere else' }).click();

    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(4);
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    // Still round 1, still holding the plan, so it can go somewhere else.
    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
    await expect(page.locator('.plan--selected')).toHaveCount(1);

    await cell(page, 'C3').click();
    await expect(demolition(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(4);
  });

  test('says what goes with the front door, and only there (§7)', async ({ page }) => {
    await aimAt(page, 'B2');
    await expect(demolition(page).locator('.demolition__door')).toBeVisible();
    await page.keyboard.press('Escape');

    await cell(page, 'C3').click();
    await expect(demolition(page)).toBeVisible();
    await expect(demolition(page).locator('.demolition__door')).toHaveCount(0);
  });

  test('removes the front door once B2 is gone (§7)', async ({ page }) => {
    await aimAt(page, 'B2');
    await page.getByRole('button', { name: 'Take it down' }).click();

    await expect(page.getByText('front door')).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(3);
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

  function column(page: Page, heading: string) {
    return page.locator('.report__column').filter({ hasText: heading });
  }

  test('shows all three columns at once, side by side (§10.2)', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await playToTheEnd(page);

    const columns = page.locator('.report__column');
    await expect(columns).toHaveCount(3);

    // All three visible together — the payoff arrives in one moment, not as a
    // sequence of screens.
    const boxes = await columns.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      }),
    );
    // On a wide screen they sit in a row: same top, increasing left.
    expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
  });

  test('gives what you will look after the most room (§10.2)', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1200 });
    await playToTheEnd(page);

    const widths = await page
      .locator('.report__column')
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width),
      );
    expect(widths[2]!).toBeGreaterThan(widths[0]!);
  });

  test('describes the cost in words, never a number (§10.2)', async ({ page }) => {
    await playToTheEnd(page);
    const cost = await column(page, 'What it cost').innerText();
    expect(cost).not.toMatch(/\d/);
    expect(cost.length).toBeGreaterThan('What it cost'.length);
  });

  test('closes on a line, and the household answers it (§10.3, §10.4)', async ({
    page,
  }) => {
    await playToTheEnd(page);

    await expect(page.locator('.report__closing')).toBeVisible();
    const closing = await page.locator('.report__closing').innerText();
    expect(closing.trim().length).toBeGreaterThan(0);

    const people = page.locator('.report .household__person');
    await expect(people).toHaveCount(3);
    for (let index = 0; index < 3; index++) {
      const line = await people.nth(index).locator('.household__line').innerText();
      expect(line.trim().length).toBeGreaterThan(0);
    }
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

test.describe('the framing (§2, §14)', () => {
  test('comes before the plot, and does not come back', async ({ page }) => {
    await page.goto('/');

    // Who the house is for, and why the work is happening at all.
    await expect(page.getByText('Someone left you a house.')).toBeVisible();
    await expect(page.locator('.household__person')).toHaveCount(3);

    // Nothing to play with yet.
    await expect(page.getByRole('grid')).toHaveCount(0);
    await expect(page.locator('.plan')).toHaveCount(0);

    await page.getByRole('button', { name: 'Begin' }).click();

    await expect(page.getByRole('grid')).toBeVisible();
    await expect(page.locator('.intro')).toHaveCount(0);

    // §2 — never mentioned again during play.
    for (let round = 1; round <= ROUNDS; round++) {
      await expect(page.locator('.household')).toHaveCount(0);
      await playRound(page);
    }
  });
});

test.describe('the line (§8.6, §13)', () => {
  /** Play until a placement actually says something, then stop on it. */
  async function playUntilLine(page: Page) {
    for (let round = 1; round <= ROUNDS; round++) {
      await hand(page).first().click();
      await legalCells(page).first().click();
      await confirmDemolition(page);
      if ((await observation(page).count()) > 0) return;
    }
    throw new Error('no placement in a whole game said anything');
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

    await page.getByRole('button', { name: 'Begin' }).click();
    await page.screenshot({ path: 'e2e/screenshots/01-opening.png', fullPage: true });

    // Selected but not yet placed: this is the frame that shows the highlight.
    await hand(page).first().click();
    await page.screenshot({ path: 'e2e/screenshots/02-selected.png', fullPage: true });

    // §7.2, §13 — the one question the game asks. Aimed at the front door,
    // because that is the version of it that carries the most.
    await cell(page, 'B2').click();
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

    while ((await page.getByText('The house is finished.').count()) === 0) {
      await playRound(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/06-finished.png', fullPage: true });
  });
});
