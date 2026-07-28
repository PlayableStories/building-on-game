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

/**
 * §5 — a plan in hand for one half of the plot. Tests that aim at a named cell
 * need one that is allowed to go there.
 */
function handFor(page: Page, zone: 'indoor' | 'outdoor') {
  return page.locator(`.plan[data-zone="${zone}"]`);
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

  test('shows the inherited house as named rooms on different fabric (§12)', async ({
    page,
  }) => {
    await start(page);

    // §12 — each old room says what it is, in the same face as any placement,
    // with "inherited" small and quiet underneath.
    const rooms: Record<string, string> = {
      B2: 'Old kitchen',
      C2: 'Old sitting room',
      B3: 'Old scullery',
      C3: 'Old back room',
    };
    for (const [ref, name] of Object.entries(rooms)) {
      await expect(cell(page, ref)).toContainText(name);
      await expect(cell(page, ref)).toContainText('inherited');
    }

    // §7 — the front door, on the street, printed like any other room.
    await expect(cell(page, 'C1')).toContainText('Front door');
    await expect(cell(page, 'C1')).toContainText('inherited');

    // The name is the loud part and "inherited" is the quiet one, not the other
    // way round — the emphasis this milestone exists to swap.
    const sizes = await cell(page, 'C1').evaluate((element) => ({
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
    await handFor(page, 'indoor').first().click();

    // Four old rooms plus the six empty indoor cells touching the house. Not
    // the front door, which is never on offer to anything.
    await expect(legalCells(page)).toHaveCount(10);
    await expect(cell(page, 'C1')).toBeDisabled();

    const after = await background(page, '.cell--legal');
    expect(after).not.toBe(before);
  });

  test('offers a garden plan the garden, and nothing in the house (§5)', async ({
    page,
  }) => {
    await start(page);

    // The garden tier arrives late, so play on until one is dealt.
    for (let round = 1; round <= ROUNDS; round++) {
      if ((await handFor(page, 'outdoor').count()) > 0) {
        await handFor(page, 'outdoor').first().click();

        const refs = await legalCells(page).evaluateAll((cells) =>
          cells.map((cell) => (cell.getAttribute('aria-label') ?? '').slice(0, 2)),
        );
        expect(refs.length).toBeGreaterThan(0);
        for (const ref of refs) expect(Number(ref[1])).toBeGreaterThanOrEqual(4);
        return;
      }
      await playRound(page);
    }
    throw new Error('no garden plan dealt in a whole game');
  });

  test('places on click and cannot be undone (§7.3)', async ({ page }) => {
    await start(page);

    const chosen = handFor(page, 'indoor').first();
    const name = await chosen.locator('.plan__name').innerText();
    await chosen.click();
    await cell(page, 'D2').click();

    // The block is on the plot before the line is read — you see what you did.
    await expect(cell(page, 'D2')).toContainText(name);
    if ((await observation(page).count()) > 0) await observation(page).click();

    await expect(page.getByText(`2 of ${ROUNDS}`)).toBeVisible();

    // Placed cells are never offered again.
    await hand(page).first().click();
    await expect(cell(page, 'D2')).toBeDisabled();
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
  /** Choose a plan for the house and aim it at a named cell. */
  async function aimAt(page: Page, ref: string): Promise<string> {
    await start(page);
    const chosen = handFor(page, 'indoor').first();
    const name = await chosen.locator('.plan__name').innerText();
    await chosen.click();
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
    await aimAt(page, 'D2');
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

  test('names the room coming down rather than its grid reference (§12)', async ({
    page,
  }) => {
    await aimAt(page, 'B2');
    await expect(demolition(page)).toContainText(/old kitchen/i);
    await page.keyboard.press('Escape');

    await cell(page, 'C3').click();
    await expect(demolition(page)).toContainText(/old back room/i);
  });

  test('never asks about the front door, because it never offers it (§7)', async ({
    page,
  }) => {
    await start(page);
    await handFor(page, 'indoor').first().click();

    // Not merely unhighlighted — not clickable at all. The one cell in the game
    // that is never a decision.
    await expect(cell(page, 'C1')).toBeDisabled();
    await expect(demolition(page)).toHaveCount(0);
    await expect(page.locator('.cell--placed')).toHaveCount(0);
    await expect(page.getByText(`1 of ${ROUNDS}`)).toBeVisible();
  });

  test('keeps the front door standing through a whole game (§7)', async ({ page }) => {
    await start(page);
    for (let round = 1; round <= ROUNDS; round++) await playRound(page);

    await expect(cell(page, 'C1')).toContainText('Front door');
    await expect(cell(page, 'C1')).toContainText('inherited');
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

  test('closes on a line, and answers the situation it opened on (§10.3, §10.4)', async ({
    page,
  }) => {
    // §2 — capture the situation before it goes, so the answer can be checked
    // against the question rather than merely for being non-empty.
    await page.goto('/');
    const question = await page.locator('.intro__situation').innerText();
    await page.getByRole('button', { name: 'Begin' }).click();
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
    await expect(page.getByText('Someone left you a house.')).toBeVisible();
    await expect(page.locator('.intro__situation')).toHaveCount(1);

    // Nothing to play with yet.
    await expect(page.getByRole('grid')).toHaveCount(0);
    await expect(page.locator('.plan')).toHaveCount(0);

    await page.getByRole('button', { name: 'Begin' }).click();

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

    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.rules--open')).toHaveCount(0);

    // Mid-round, with a plan chosen: the rules open over the top and the round
    // underneath is untouched when they close.
    await hand(page).first().click();
    const legal = await legalCells(page).count();

    await page.getByRole('button', { name: 'How this works' }).click();
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

    // Selected but not yet placed: this is the frame that shows the highlight,
    // and with it the zone rule — a house plan lights the house and not the
    // garden (§5).
    await handFor(page, 'indoor').first().click();
    await page.screenshot({ path: 'e2e/screenshots/02-selected.png', fullPage: true });

    // §13 — the rules looked up mid-round, over a game in progress.
    await page.getByRole('button', { name: 'How this works' }).click();
    await page.screenshot({ path: 'e2e/screenshots/02b-rules.png', fullPage: true });
    await page.keyboard.press('Escape');

    // §7.2, §13 — the one question the game asks. Aimed at the old kitchen,
    // which is the room the player is most likely to want the space of.
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
