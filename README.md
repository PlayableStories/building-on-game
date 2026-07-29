# Building On

An 8-round placement game in which you renovate a house you inherited, choosing one of
three plans each round and never being able to move it again — discovering, one neighbour
at a time, that a home is not a list of rooms but a set of things you have agreed to
look after.

> A home isn't a list of rooms. It's what ended up next to what.

The full design is in [`GDD.md`](GDD.md). The build is staged across milestones M0–M12 in
[`PLAN.md`](PLAN.md), which also records what the §17 playtest found and what changed
because of it.

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
| `npm run validate` | Check the content, and the fork surface itself, against GDD §16 |

`npm run test:e2e` drives the Google Chrome already on your machine (Playwright's
`channel: 'chrome'`), so there is no browser download. It starts the dev server itself and
leaves screenshots of a full playthrough in `e2e/screenshots/`.

## Hosting

The game is a static bundle. There is no server, no database and no API key — the whole
of a playthrough lives in the page, and a seed is the only state it has. So it can be
served from anywhere that serves files.

`.github/workflows/deploy.yml` publishes it to GitHub Pages on every push to `main`,
gated on `npm run validate` and `npm test`. A project page is served from `/<repo>/`
rather than the domain root, so the workflow passes `--base=/<repo>/` at build time. It
reads that name from the repository itself, which means **a fork needs no edit to
deploy** — push to `main` and it lands under the fork's own name.

The base path is set at build time rather than in `vite.config.ts` on purpose: `npm run
dev`, `npm run preview` and the e2e suite all keep serving from `/`, and hosting this
somewhere other than Pages needs no change to the source.

## What to fork

This is a workshop sample, so remixability is a design requirement rather than a nicety.
**Two files hold everything you would want to change**, and `npm run validate` checks that
this is still true rather than merely intended.

### `src/content.ts` — everything anyone can read

| What | Change it to |
|---|---|
| `plot` | The building you inherited: which cells are already standing, what each is called, which one can never be built on, and where the ground behind it starts. |
| `deck` | The 24 plans. Each has a tier, a **zone** (`indoor`/`outdoor`), what it emits and suffers from, a consent flag, and one line each for what you'll have and what it asks. |
| `situations` | Six circumstances, one drawn per game. Each answers the finished plot in one line. This is the single highest-leverage thing to change. |
| `pairLines`, `qualityLines`, `causeWords` | Every observation, and the words that name what caused one. |
| `rules`, `ui`, `premise`, `whyNow` | The objective, and every other word the interface says — button labels, headings, the prompt above the hand. |
| `closingLines`, `costPhrases`, `consentCare` | What the report says. |
| `config` | Round count, and the one conservation flag. |

### `src/theme.css` — everything anyone can see

Every colour, fill, font size, spacing step and measure is a `:root` custom property. No
component stylesheet hard-codes a value. (The one exception is the media-query breakpoint
in `app.css`: CSS cannot read a custom property inside `@media`, and it is commented.)

### What you should not need to open

`src/engine/` — grid, draw, adjacency, consent, report. It imports `src/types.ts` and
nothing else; content is handed to it as an argument. `npm run validate` fails if that
stops being true, and fails again if a sentence gets written into a component where a fork
cannot reach it. Those two checks are the fork surface: without them "you only need to
change two files" is a claim rather than a fact.

**The test:** swap the deck, the plot and the situations for a community centre, a co-op
office, a high street or a hospice garden, change some values in `theme.css`, and nothing
else needs opening. This is run against a real fork before each release — validator,
type-check, build, the component suite and the whole game in Chrome, all green on content
that describes a different building.

One honest caveat about the test suites. `src/App.test.tsx` and `e2e/play.spec.ts` test
*behaviour*, read their labels and cell references out of `content.ts`, and will pass on
your fork unchanged. The engine tests in `src/engine/` assert particular sentences from
this deck — that the home farm beside the kitchen says *"A short walk with wet hands"* —
so they are fixtures rather than a contract, and you should expect to rewrite or delete
them along with the writing they check.

### Two remix dials

1. **Reskin** — swap the plot, the deck and the situations. Same engine, different
   building, different people, entirely different game.
2. **Remix** — change what the second half of each report row *is*. Replace *what it asks*
   with *who this excludes*, or *what this costs the street*, and the game makes a
   completely different argument with identical code.

## Status

**M12 — the fork surface and the validator.** The game is finished to the scope §18 sets
out, and the playtest that M7 ran has been answered in full.

It opens on why the work is happening, one situation drawn from six, and a short account
of how the game works that stays available from the header for the whole game. Then the
5×5 plot: the front door on C1 that came with the house and cannot be changed, four named
old rooms behind it, and the garden across rows 4–5. Rooms go in the house and garden
things go in the garden. Eight placements, each checked against its neighbours, and each
one with something to say naming what caused it and lighting the two cells it is about.

Placing onto an old room asks once, and only once: the one move that cannot be taken back.
Every plan carries a consent flag in hand — a fact about the plan, never an outcome.

When the eighth plan lands, the house reports back in three rows. Each thing you gained
sits beside the thing it will ask of you, for as long as you have it; underneath, the cost
as a phrase and the two obligations the house itself has taken on. Then one sentence about
what kind of house it turned out to be, and the situation you started with, answered.
There is no score anywhere, and no number.

**Play it twice.** Set `conservation: true` in `src/content.ts` and build the same house
again. Same plans, same pleasures, same cost — and different obligations. That is the
argument §9 is making, and it is one config flag.

Out of scope by design: discovery (§11), placement animation and polish (§18.8), save and
load, a seed in the URL, multiple storeys, multi-cell plans, and any score at all.
