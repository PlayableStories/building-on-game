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

function cell(page: Page, ref: string) {
  return page.getByRole('gridcell', { name: new RegExp(`^${ref}[,$]`) });
}

function legalCells(page: Page) {
  return page.locator('.cell:not([disabled])');
}

function hand(page: Page) {
  return page.locator('.plan');
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
    await page.goto('/');
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
    await page.goto('/');

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
    await page.goto('/');

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
    await page.goto('/');
    await expect(legalCells(page)).toHaveCount(0);

    const before = await background(page, '.cell--empty');
    await hand(page).first().click();

    // Four fabric cells plus the eight touching them.
    await expect(legalCells(page)).toHaveCount(12);

    const after = await background(page, '.cell--legal');
    expect(after).not.toBe(before);
  });

  test('places on click and cannot be undone (§7.3)', async ({ page }) => {
    await page.goto('/');

    const name = await hand(page).first().locator('.plan__name').innerText();
    await hand(page).first().click();
    await cell(page, 'C1').click();

    await expect(cell(page, 'C1')).toContainText(name);
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
    await page.goto('/');

    for (let round = 1; round <= ROUNDS; round++) {
      await expect(page.getByText(`${round} of ${ROUNDS}`)).toBeVisible();
      await expect(hand(page)).toHaveCount(3);

      await hand(page).first().click();
      await legalCells(page).first().click();
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
    await page.goto('/');

    for (let round = 1; round <= ROUNDS; round++) {
      await hand(page).first().click();
      await legalCells(page).first().click();
    }

    await page.getByRole('button', { name: 'Build again' }).click();

    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    await expect(page.locator('.cell--fabric')).toHaveCount(4);
  });
});

test.describe('screenshots', () => {
  test('captures the opening, a game in progress, and the finish', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.screenshot({ path: 'e2e/screenshots/01-opening.png', fullPage: true });

    // Selected but not yet placed: this is the frame that shows the highlight.
    await hand(page).first().click();
    await page.screenshot({ path: 'e2e/screenshots/02-selected.png', fullPage: true });

    await legalCells(page).first().click();
    for (let round = 2; round <= 4; round++) {
      await hand(page).first().click();
      await legalCells(page).first().click();
    }
    await page.screenshot({ path: 'e2e/screenshots/03-midway.png', fullPage: true });

    for (let round = 5; round <= ROUNDS; round++) {
      await hand(page).first().click();
      await legalCells(page).first().click();
    }
    await page.screenshot({ path: 'e2e/screenshots/04-finished.png', fullPage: true });
  });
});
