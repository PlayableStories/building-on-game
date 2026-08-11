/**
 * The published screenshots — the ones in the README.
 *
 * `npm run screenshots`. Builds the game, serves it, plays it in real Chrome
 * and writes seven frames to `docs/screenshots/`.
 *
 * This is not the same job as the `screenshots` block in `e2e/play.spec.ts`.
 * That one dumps full-page frames into a gitignored folder so a failing run can
 * be looked at. This one is the shop window: it crops to the app, it waits for
 * the moment worth showing rather than whatever round it happens to be on, and
 * what it writes is committed.
 *
 * Four frames need a particular thing to happen rather than just a round to
 * pass — the demolition question, a plan that goes upstairs, an adjacency line
 * that reads one room against another, and one that reads a room against the
 * floor below. The deck is dealt from a random seed, so all four are played for
 * rather than assumed, and the whole game is restarted if a run does not
 * produce them.
 *
 * **The numbers are reading order, not capture order.** They are the order the
 * frames appear in `GAME-FLOW.md`; an upstairs plan can turn up in any round,
 * and the demolition question is always photographed in the first.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { config, ui } from '../src/content.ts';
import type { Where } from '../src/types.ts';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const OUT = 'docs/screenshots';
/** Wide enough for the report's two columns to sit side by side (§10.2). */
const WIDTH = 900;

/* ------------------------------------------------------------------ *
 * Serving the built game
 * ------------------------------------------------------------------ */

const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
);
const stopServer = () => server.kill();
process.on('exit', stopServer);

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The preview server never came up on ${URL}.`);
}

/* ------------------------------------------------------------------ *
 * Playing
 * ------------------------------------------------------------------ */

const hand = (page: Page) => page.locator('.plan');
const handFor = (page: Page, where: Where) => page.locator(`.plan[data-where="${where}"]`);
const legalCells = (page: Page) => page.locator('.cell:not([disabled])');
const observation = (page: Page) => page.locator('.observation');
const demolition = (page: Page) => page.locator('.demolition');

/** Crop to the game rather than the window — no acre of empty page below. */
const shot = (page: Page, name: string) =>
  page.locator('.app').screenshot({ path: `${OUT}/${name}.png`, scale: 'device' });

async function confirmDemolition(page: Page): Promise<void> {
  if (await demolition(page).count()) {
    await page.getByRole('button', { name: ui.demolition.confirm }).click();
  }
}

/**
 * Choose a plan, unless one is already chosen — clicking a selected plan
 * deselects it, and after backing out of the demolition question the plan the
 * player aimed is still in their hand.
 */
async function choose(page: Page): Promise<void> {
  if (await page.locator('.plan--selected').count()) return;
  await hand(page).first().click();
}

async function playRound(page: Page): Promise<void> {
  await choose(page);
  await legalCells(page).first().click();
  await confirmDemolition(page);
  if (await observation(page).count()) await observation(page).click();
}

/**
 * One attempt at a whole game. Returns false if the run did not reach a frame
 * we need, and the caller restarts — cheaper and more honest than steering the
 * deck, which would photograph a game nobody can be dealt.
 */
async function capture(page: Page): Promise<boolean> {
  await page.goto(URL, { waitUntil: 'networkidle' });

  // §2 — the premise, the situation this house has to answer, and the rules.
  await shot(page, '1-the-situation');

  await page.getByRole('button', { name: ui.begin }).click();

  // §5 — a house plan selected, so the highlight shows the rule: the ground
  // floor lights, rows 1–3, and the garden stays dark.
  await handFor(page, 'house').first().click();
  await shot(page, '2-where-it-can-go');

  // §7.2 — the only question the game asks. Aim at an old room and stop there.
  const fabric = page.locator('.cell--fabric:not([disabled])').first();
  if (!(await fabric.count())) return false;
  await fabric.click();
  if (!(await demolition(page).count())) return false;
  await shot(page, '4-the-one-question');
  await page.keyboard.press('Escape');

  // Three frames that have to be played for.
  //
  // §5 — a plan that goes upstairs, which takes the board up with it and lights
  // only the cells sitting over a room. It is the whole level rule in one
  // picture, and no amount of prose does the same job.
  //
  // §8.6 — the frame the prototype is for. A line that reads one room against
  // another lights both cells, so wait for a pair rather than the orientation
  // line, which has only the one cell to light.
  //
  // §8.6 again — and the same thing through a floor, which about half of games
  // produce. That is exactly why it is played for rather than assumed.
  let gotUpstairs = false;
  let gotPair = false;
  let gotVertical = false;
  for (let round = 1; round <= config.rounds; round += 1) {
    if (!gotUpstairs && (await handFor(page, 'upstairs').count())) {
      await handFor(page, 'upstairs').first().click();
      await shot(page, '3-going-up');
      gotUpstairs = true;
    }

    await choose(page);
    await legalCells(page).first().click();
    await confirmDemolition(page);

    if (await observation(page).count()) {
      if (!gotPair && (await page.locator('.cell--cause').count())) {
        await shot(page, '5-what-it-noticed');
        gotPair = true;
      }
      // §8.6 — and the one the levels made possible: a line whose other end is
      // on a floor that is not on screen, with the switcher marking which. That
      // mark is the whole answer to "a sentence about two cells, one of which
      // you cannot see", so the frame is of the mark rather than of the line.
      if (!gotVertical && (await page.locator('.plot__level[data-cause="true"]').count())) {
        await shot(page, '6-through-the-floor');
        gotVertical = true;
      }
      await observation(page).click();
    }
  }
  if (!gotUpstairs || !gotPair || !gotVertical) return false;

  while (!(await page.getByText(ui.report.finished).count())) await playRound(page);

  // §10 — what you have, beside what it asks of you, and the situation answered.
  await shot(page, '7-the-house-you-built');
  return true;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

await waitForServer();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
// Twice the pixels, because these are read on a retina display in a README at
// roughly half the width they are taken at.
const page = await browser.newPage({
  viewport: { width: WIDTH, height: 1000 },
  deviceScaleFactor: 2,
});

let done = false;
for (let attempt = 1; attempt <= 20 && !done; attempt += 1) {
  done = await capture(page);
  if (!done) console.log(`Deal ${attempt} did not offer every frame — restarting.`);
}

await browser.close();
stopServer();

if (!done) {
  console.error('Could not reach every frame in 20 games. Nothing was written.');
  process.exit(1);
}

console.log(`Wrote ${readdirSync(OUT).length} screenshots to ${OUT}/.`);
