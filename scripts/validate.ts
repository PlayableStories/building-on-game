/**
 * Deck validator — GDD §16.
 *
 * The full set of checks lands in M6, once `content.ts` holds a deck:
 *   - every quality referenced exists
 *   - every plan has all seven fields
 *   - every tier has enough plans to fill a hand
 *   - every consent flag is one of the four
 *   - every pair line names a real plan id
 *   - no duplicate plan ids
 *
 * In M0 there is no deck yet, so this checks the vocabulary the deck will be
 * written against. It is wired up now so `npm run validate` exists from the
 * start and grows rather than appearing late.
 */
import { CONSENT_FLAGS, COST_BANDS, PLAN_TIERS, QUALITIES } from '../src/types.ts';

const problems: string[] = [];

function noDuplicates(name: string, values: readonly string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) problems.push(`${name}: duplicate entry "${value}"`);
    seen.add(value);
  }
}

noDuplicates('qualities', QUALITIES);
noDuplicates('tiers', PLAN_TIERS);
noDuplicates('consent flags', CONSENT_FLAGS);
noDuplicates('cost bands', COST_BANDS);

if (QUALITIES.length !== 9) {
  problems.push(
    `qualities: §8.5 specifies nine, found ${QUALITIES.length}. ` +
      'Widening this vocabulary makes the game harder to hold in the head.',
  );
}

if (problems.length > 0) {
  console.error('Content validation failed:\n');
  for (const problem of problems) console.error(`  · ${problem}`);
  process.exit(1);
}

console.log(
  `Vocabulary OK — ${QUALITIES.length} qualities, ${PLAN_TIERS.length} tiers, ` +
    `${CONSENT_FLAGS.length} consent flags.`,
);
console.log('Deck checks arrive in M6, once content.ts has a deck to check.');
