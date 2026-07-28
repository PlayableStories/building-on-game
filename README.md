# Building On

An 8-round placement game in which you renovate a house you inherited, choosing one of
three plans each round and never being able to move it again — discovering, one neighbour
at a time, that a home is not a list of rooms but a set of things you have agreed to
look after.

> A home isn't a list of rooms. It's what ended up next to what.

The full design is in [`GDD.md`](GDD.md). The build is staged across milestones M0–M7 in
[`PLAN.md`](PLAN.md).

## Quick start

Node **20.19 or later** is required (Vite 8 will refuse anything older). There is an
`.nvmrc`, so:

```bash
nvm use            # reads .nvmrc → 20
npm install
npm run dev        # http://localhost:5173
```

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm test` | Run the unit and component tests once |
| `npm run test:watch` | Run those in watch mode |
| `npm run test:e2e` | Play a whole game in real Chrome, and write screenshots |
| `npm run validate` | Check the deck against the rules in GDD §16 |

`npm run test:e2e` drives the Google Chrome already on your machine (Playwright's
`channel: 'chrome'`), so there is no browser download. It starts the dev server itself and
leaves screenshots of a full playthrough in `e2e/screenshots/`.

## What to fork

This is a workshop sample, so remixability is a design requirement rather than a nicety.
**Two files hold everything you would want to change:**

- **`src/content.ts`** — the household, the "why now" line, the deck, the qualities, every
  adjacency line, all consent flags, the report copy and the closing lines.
- **`src/theme.css`** — every colour, fill, font and spacing value.

The engine — grid, hand, tier-weighted draw, adjacency lookup, report assembly — lives in
`src/engine/` and should never need opening. It imports from `src/types.ts` only, never
from `content.ts`; content is passed in as an argument. That is what keeps the fork
surface honest.

**The test:** swapping the deck for a community centre, a co-op office, a high street or a
hospice garden should never require opening a file that isn't one of those two.

### Two remix dials

1. **Reskin** — swap the deck and the household. Same engine, different building,
   different people.
2. **Remix** — change what the third report column *is*. Replace *what you'll look after*
   with *who this excludes*, or *what this costs the street*, and the game makes a
   completely different argument with identical code.

## Status

**M5 — demolition, consent and conservation.** The game is playable end to end and every
mechanic the design argues for is now in it. It opens with why the work is happening and
who the house is for; then the 5×5 plot with the inherited house on B2/C2/B3/C3, a hand of
three drawn fresh each round and weighted to the tier, and eight placements — each one
checked against its neighbours, and each one that has something to say saying it in a
single line.

Placing onto the old house asks once, and only once: it is the only confirmation in the
game, because it is the only move that cannot be taken back. Taking down B2 removes the
front door, and the rest of the game reads against that. Every plan carries a consent flag
in hand — a fact about the plan, never an outcome; nothing here succeeds or fails.

When the eighth plan lands the house reports back in three columns: what you'll have, what
it cost, and what you'll look after. The third is the longest, deliberately, and it is
where the consent obligations land. Below it, one sentence about what kind of house it
turned out to be, and each member of the household saying one thing about living in it.
There is no score, and the cost is a phrase rather than a number.

**Play it twice.** Set `conservation: true` in `src/content.ts` and build the same house
again. The plans are identical, the pleasures are identical, the cost is identical — and
the obligations are not. That is the argument §9 is making, and it is one config flag.

Not yet: the deck validator and the finished fork surface (M6), the playtest pass (M7).
