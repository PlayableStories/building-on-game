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
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run validate` | Check the deck against the rules in GDD §16 |

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

**M0 — scaffold.** Toolchain, shared types and the two fork-surface files exist; the game
itself does not yet. The grid, the hand and the eight rounds arrive in M1.
