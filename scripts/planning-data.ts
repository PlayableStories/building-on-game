/**
 * Regenerate the planning-data evidence — see PLANNING-DATA.md.
 *
 * `npm run planning-data -- <path to housing_planning.sqlite>`
 *
 * Runs every named block in `data/planning/queries.sql` and writes one CSV per
 * block beside it. The CSVs are committed; the 1.4 GB database is not, and
 * never should be. Anyone with the hackathon export can regenerate them and
 * check that the figures quoted in PLANNING-DATA.md and in the consent
 * comments in `src/content.ts` are what the data actually says.
 *
 * This shells out to the `sqlite3` CLI rather than taking a native SQLite
 * dependency. The game itself has no database and never will; adding a
 * compiled module to `package.json` so that one research script can run would
 * be a bad trade. macOS ships `sqlite3`; on Linux it is `apt install sqlite3`.
 *
 * The queries are the source of truth. If a figure looks wrong, fix the SQL and
 * regenerate — do not edit a CSV, because then nothing can be checked against
 * anything.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const QUERIES = 'data/planning/queries.sql';

const database = process.argv[2];
if (!database) {
  console.error('Usage: npm run planning-data -- <path to housing_planning.sqlite>');
  process.exit(2);
}

/** Split the file on `-- @name:` markers, keeping each block's own comments. */
function blocks(sql: string): { name: string; query: string }[] {
  const found: { name: string; query: string }[] = [];
  const parts = sql.split(/^-- @name:\s*(\S+)\s*$/m);

  // parts[0] is the file header, then [name, body, name, body, …].
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i] as string;
    const query = (parts[i + 1] ?? '').trim();
    if (query) found.push({ name, query });
  }
  return found;
}

/**
 * Opened read-only, and immutably.
 *
 * `mode=ro` refuses every write at the connection level. `immutable=1` goes
 * further: SQLite is told the file cannot change under it, so it takes no
 * locks and creates no journal, WAL or shm side-files next to it. Nothing this
 * script does can alter a byte of the export, and nothing it leaves behind can
 * either.
 *
 * Worth the two words. This analysis reads someone's only copy of a 1.4 GB
 * file, and the difference between "I only wrote SELECTs" and "the connection
 * could not have written" is the difference between a promise and a guarantee.
 */
function uri(path: string): string {
  return `file:${resolve(path)}?mode=ro&immutable=1`;
}

function run(query: string): string {
  // The query goes in on stdin rather than as an argument: every block here
  // opens with its own `--` comment, and sqlite3 reads a leading dash as an
  // option flag.
  return execFileSync('sqlite3', ['-csv', '-header', uri(database as string)], {
    input: query,
    encoding: 'utf8',
    // The category and card queries scan every row of a 1.4 GB file.
    maxBuffer: 64 * 1024 * 1024,
  });
}

const here = dirname(QUERIES);
const sql = readFileSync(QUERIES, 'utf8');
const named = blocks(sql);

if (named.length === 0) {
  console.error(`${QUERIES}: no '-- @name:' blocks found.`);
  process.exit(1);
}

for (const { name, query } of named) {
  const csv = run(query);
  const rows = csv.trimEnd().split('\n').length - 1;
  writeFileSync(join(here, `${name}.csv`), csv);
  console.log(`${name}.csv — ${rows} row${rows === 1 ? '' : 's'}`);
}

console.log(`\nWrote ${named.length} files to ${here}/ from ${database}.`);
