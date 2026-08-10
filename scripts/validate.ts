/**
 * Content validator — GDD §16.
 *
 * `npm run validate`. Exits non-zero with a readable message when `content.ts`
 * has been changed into something the game cannot play.
 *
 * This exists because §16 asks a participant to swap the deck, the plot and the
 * situations for a different building — and a fork that only finds out it is
 * broken eight rounds in, or on the one seed that deals the wrong hand, is a
 * fork nobody finishes. Everything checked here is a mistake a reasonable
 * person makes while rewriting content, and every message says what to do about
 * it rather than only what is wrong.
 *
 * It also guards the two boundaries §16 depends on, which are not content at
 * all: `src/engine/` importing nothing but `types.ts`, and every user-visible
 * word living in `content.ts` rather than in a component.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as content from '../src/content.ts';
import {
  CONSENT_FLAGS,
  COST_BANDS,
  PLAN_TIERS,
  QUALITIES,
  WHERES,
  TIERS,
  type CellId,
  type Quality,
} from '../src/types.ts';
import { TIER_CARDS } from '../src/engine/deck.ts';
import { isGarden, levelOf, orthogonalNeighbours } from '../src/engine/grid.ts';

const problems: string[] = [];
const fail = (message: string) => problems.push(message);

/* ------------------------------------------------------------------ *
 * The vocabulary — §8.5, §9.1
 * ------------------------------------------------------------------ */

function noDuplicates(name: string, values: readonly string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) fail(`${name}: duplicate entry "${value}"`);
    seen.add(value);
  }
}

noDuplicates('qualities', QUALITIES);
noDuplicates('tiers', PLAN_TIERS);
noDuplicates('consent flags', CONSENT_FLAGS);
noDuplicates('cost bands', COST_BANDS);

if (QUALITIES.length !== 9) {
  fail(
    `qualities: §8.5 specifies nine, found ${QUALITIES.length}. ` +
      'Widening this vocabulary makes the game harder to hold in the head.',
  );
}

/* ------------------------------------------------------------------ *
 * The deck — §8.1
 * ------------------------------------------------------------------ */

const { deck } = content;
const ids = new Set(deck.map((plan) => plan.id));
const qualities = new Set<string>(QUALITIES);

noDuplicates('deck', deck.map((plan) => plan.id));

for (const plan of deck) {
  const where = `plan "${plan.id}"`;

  for (const field of ['name', 'have', 'care'] as const) {
    if (typeof plan[field] !== 'string' || plan[field].length === 0) {
      fail(`${where}: needs a ${field}. Every plan says what it is and what it asks.`);
    }
  }

  if (!PLAN_TIERS.includes(plan.tier)) {
    fail(`${where}: tier "${plan.tier}" is not one of ${PLAN_TIERS.join(', ')}.`);
  }
  if (!WHERES.includes(plan.where)) {
    fail(
      `${where}: where must be one of ${WHERES.join(', ')} (§5). Without one the ` +
        'game cannot work out which part of the building it belongs to.',
    );
  }
  if (!COST_BANDS.includes(plan.cost)) {
    fail(`${where}: cost "${plan.cost}" is not one of ${COST_BANDS.join(', ')}.`);
  }
  if (!CONSENT_FLAGS.includes(plan.consent)) {
    fail(
      `${where}: consent "${plan.consent}" is not one of ${CONSENT_FLAGS.join(', ')} ` +
        '(§9.1). Flags are never outcomes — there is no "approved" or "refused".',
    );
  }

  for (const quality of [...plan.emits, ...plan.sensitive]) {
    if (!qualities.has(quality)) {
      fail(`${where}: unknown quality "${quality}". §8.5 fixes the list at nine.`);
    }
  }
}

/**
 * §6 — the draw takes two from the round's tier. A tier that cannot supply them
 * deals short, which is the kind of failure that only shows up on some seeds.
 */
for (const tier of TIERS) {
  const count = deck.filter((plan) => plan.tier === tier).length;
  if (count < TIER_CARDS) {
    fail(
      `tier "${tier}" has ${count} plans and the draw needs ${TIER_CARDS} (§6). ` +
        'Hands from this tier will be dealt short.',
    );
  }
}

/**
 * §5 — every part of the building needs something that can go there.
 *
 * This used to demand a whole hand's worth per zone, on the reasoning that a
 * round could otherwise deal three plans with nowhere to put them. With two
 * zones that was over-strict but harmless; with four it is simply wrong, since
 * a `where` holding two plans can never fill a hand on its own anyway.
 *
 * What it actually guards now is deadness: a `where` with no plans at all means
 * a level of the building nothing can ever be placed on, and copy written for
 * it that no player will read. Real deadlock — a hand with no legal cell for
 * any of its three — is a property of the plot rather than of the counts, and
 * it is checked by playing 400 games rather than by arithmetic here.
 */
for (const place of WHERES) {
  const count = deck.filter((plan) => plan.where === place).length;
  if (count === 0) {
    fail(
      `where "${place}" has no plans (§5). That is a part of the building ` +
        'nothing can ever be placed on.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * The plot — §5, §7
 * ------------------------------------------------------------------ */

const { plot } = content;
const standing: CellId[] = [
  plot.frontDoor.cell,
  plot.stair.cell,
  ...plot.fabric.map((one) => one.cell),
];

noDuplicates('plot', standing);

for (const one of [plot.frontDoor, plot.stair, ...plot.fabric]) {
  if (!one.name) {
    fail(
      `plot: the cell at ${one.cell} has no name (§12). Playtesting found that ` +
        'an unnamed inherited cell reads as scenery nobody may touch.',
    );
  }
  if (isGarden(one.cell, plot.gardenFromRow)) {
    fail(
      `plot: ${one.cell} is in the garden (§5). What you inherited is a ` +
        'building, and the rows below `gardenFromRow` are the ground behind it.',
    );
  }
  if (levelOf(one.cell) !== 'ground') {
    fail(
      `plot: ${one.cell} is not on the ground floor (§5). What was standing ` +
        'when the player arrived is the ground floor and the stair; the levels ' +
        'above it are theirs to build.',
    );
  }
}

/** §7.1 — every placement has to touch something, so the start has to connect. */
const first = standing[0];
if (first === undefined) fail('plot: nothing is standing at all (§5).');
const connected = new Set<CellId>(first === undefined ? [] : [first]);
for (let pass = 0; pass < standing.length; pass++) {
  for (const cell of standing) {
    if (connected.has(cell)) continue;
    if (orthogonalNeighbours(cell).some((near) => connected.has(near))) {
      connected.add(cell);
    }
  }
}
if (connected.size !== standing.length) {
  const stranded = standing.filter((cell) => !connected.has(cell));
  fail(
    `plot: ${stranded.join(', ')} does not touch the rest of what is standing ` +
      '(§7.1). Placements grow outwards from the building, so it has to be one ' +
      'building.',
  );
}

/** §5 — and there has to be somewhere outdoors to start from, on turn one. */
const outdoorFrontier = standing.some((cell) =>
  orthogonalNeighbours(cell).some((near) => isGarden(near, plot.gardenFromRow)),
);
if (!outdoorFrontier) {
  fail(
    'plot: nothing standing touches the garden (§5). A garden plan dealt in ' +
      'round 1 would have nowhere legal to go.',
  );
}

/* ------------------------------------------------------------------ *
 * The writing — §8.6, §8.7
 * ------------------------------------------------------------------ */

for (const line of content.pairLines) {
  if (!ids.has(line.a)) fail(`pair line: no plan "${line.a}" in the deck.`);
  if (line.b !== '*' && line.b !== 'fabric' && !ids.has(line.b)) {
    fail(`pair line: no plan "${line.b}" in the deck ("${line.a}" names it).`);
  }
}

for (const line of content.qualityLines) {
  if (!qualities.has(line.quality)) {
    fail(`quality line: unknown quality "${line.quality}".`);
  }
}

if (new Set(content.qualitySeverity).size !== QUALITIES.length) {
  fail(
    'qualitySeverity: has to rank every quality exactly once (§8.6). A quality ' +
      'missing from it can never win a tie, so its line never fires.',
  );
}

/**
 * §8.6 — a quality something emits and something else suffers from will fire,
 * and needs a line. One that nothing emits can never fire at all.
 */
const emitted = new Set<Quality>(deck.flatMap((plan) => plan.emits));
const suffered = new Set<Quality>(deck.flatMap((plan) => plan.sensitive));
for (const quality of emitted) {
  if (!suffered.has(quality)) continue;
  if (!content.qualityLines.some((line) => line.quality === quality)) {
    fail(
      `quality "${quality}" can fire but has no line (§8.6). Something emits it ` +
        'and something next to it suffers from it, and the game would say nothing.',
    );
  }
}
for (const quality of suffered) {
  if (!emitted.has(quality)) {
    fail(
      `quality "${quality}": something in the deck suffers from it and nothing ` +
        'produces it. That sensitivity can never react to anything.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * The report and the framing — §2, §9, §10
 * ------------------------------------------------------------------ */

if (content.costPhrases.length === 0) {
  fail('costPhrases: needs at least one (§10.2). Cost is a phrase, never a number.');
}
for (const phrase of content.costPhrases) {
  if (/\d/.test(phrase)) {
    fail(`costPhrases: "${phrase}" contains a number. §10.2 — a phrase, never a figure.`);
  }
}

if (!content.closingLines.some((line) => !line.dominant && !line.fabric)) {
  fail(
    'closingLines: needs one line with no conditions on it (§10.3). Without a ' +
      'fallback there are finished houses the game has nothing to say about.',
  );
}

if (content.situations.length === 0) {
  fail('situations: needs at least one (§2). The game draws one per seed.');
}
noDuplicates('situations', content.situations.map((one) => one.id));

for (const flag of CONSENT_FLAGS) {
  if (!content.consentCare[flag]) {
    fail(`consentCare: no line for the "${flag}" flag (§9.3).`);
  }
  if (!content.consentLabels[flag]) {
    fail(`consentLabels: no label for the "${flag}" flag (§14).`);
  }
}
if (new Set(content.consentOrder).size !== CONSENT_FLAGS.length) {
  fail(
    'consentOrder: has to rank every consent flag exactly once (§9.1). It is ' +
      'what decides which obligations the report has room for.',
  );
}

if (!content.rules.objective || content.rules.points.length === 0) {
  fail(
    'rules: needs an objective and at least one point (§13). A no-fail game has ' +
      'no failure to teach through, so it has to say what it is.',
  );
}

/* ------------------------------------------------------------------ *
 * The fork surface itself — §16
 * ------------------------------------------------------------------ */

const root = new URL('..', import.meta.url).pathname;

/**
 * The rule the whole of §16 rests on: engine code is handed content as an
 * argument and never imports it. Break this and a fork stops being a content
 * edit, however good the content files look.
 */
const engineDir = join(root, 'src/engine');
for (const file of readdirSync(engineDir)) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
  const source = readFileSync(join(engineDir, file), 'utf8');
  for (const [, spec] of source.matchAll(/from\s+'([^']+)'/g)) {
    const allowed = spec === '../types.ts' || /^\.\/[a-z]+\.ts$/.test(spec ?? '');
    if (!allowed) {
      fail(
        `src/engine/${file} imports "${spec}". Engine code may import ` +
          "'../types.ts' and its own siblings, and nothing else (§16).",
      );
    }
  }
}

/**
 * …and the corollary: a component that hard-codes a sentence is a sentence a
 * fork cannot reach. This catches text sitting directly in JSX; it is a coarse
 * check, and a coarse check that runs beats a careful one that does not.
 */
const componentsDir = join(root, 'src/components');
for (const file of [...readdirSync(componentsDir).map((f) => `components/${f}`), 'App.tsx']) {
  if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
  const source = readFileSync(join(root, 'src', file), 'utf8');
  for (const [, text] of source.matchAll(/>\s*([A-Za-z][^<>{}\n]{7,})\s*</g)) {
    fail(
      `src/${file}: the words "${(text ?? '').trim()}" are written into the component. ` +
        'Everything a player can read belongs in content.ts (§16).',
    );
  }
}

/* ------------------------------------------------------------------ */

if (problems.length > 0) {
  console.error(`Content validation failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  · ${problem}\n`);
  process.exit(1);
}

console.log(
  `Content OK — ${deck.length} plans (` +
    WHERES.map((w) => `${deck.filter((p) => p.where === w).length} ${w}`).join(', ') +
    `), ` +
    `${standing.length} inherited cells, ${content.situations.length} situations, ` +
    `${content.pairLines.length} pair lines, ${content.closingLines.length} closing lines.`,
);
console.log('Fork surface OK — engine imports types only, no copy in components.');
