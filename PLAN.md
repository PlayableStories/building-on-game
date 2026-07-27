# Building On — Prototype Implementation Plan

## Context

`/Users/williamthedeveloper/Development/building-on-game` contains exactly one file:
`GDD.md`. It specifies **Building On**, an 8-round, no-fail placement game about
renovating an inherited house — the player places one of three drawn plans per round on
a 5×5 grid, can never move a placement, and gets one short written observation about
what just ended up next to what. After eight placements the house reports back in three
columns: what you'll have, what it cost, and what you'll look after.

The build exists to test the design's central bet: that **placement adjacency alone can
carry meaning without a score, a fail state, or a floor plan** (§1). It is also a
workshop sample, so §16 makes remixability a hard requirement — a participant reskinning
the game for a hospice garden must never open a file that isn't `content.ts` or
`theme.css`.

Target: §18 priorities **1–6**. Discovery (§11) and polish (§18.8) are out.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 8** | Instant dev server, static `dist/`, zero config for TS |
| UI | **React 19 + TypeScript** | §16's fork test needs a stack participants already read |
| State | **`useReducer` in `App.tsx`** | The whole game is one immutable `GameState`; a state library earns nothing at 25 cells and 8 rounds |
| Styling | **Plain CSS + custom properties** in `theme.css` | §16 names the file; every colour, fill, font, spacing value is a `--var` |
| Rendering | **CSS Grid of `<button>` cells** | §12 forbids a floor plan — flat blocks are the correct fidelity, no canvas needed |
| Tests | **Vitest** | Engine is pure functions; also runs the §16 `validate` script |

**Runtime dependencies: `react`, `react-dom`. Nothing else.** No router, no state library,
no CSS framework, no icon package (§12: procedural shapes and colour, placeholder art only).

### Blocking prerequisite — Node version

Default `node` here is **v14.16.1**, which Vite 8 rejects — it needs 20.19 or later. `nvm`
has **v18.20.8, v20.20.2, v24.13.0** installed. M0 adds `.nvmrc` (`20`); every command below
assumes `nvm use` first, and the README says so.

One consequence, settled in M0: `jsdom` is pinned to **^29** rather than the latest 30,
which requires Node 22.22+/24.15+. Pinning keeps the toolchain on the Node 20 line the
`.nvmrc` commits to. Revisit if the target Node moves.

### Keeping the tooling out of the game

The TypeScript config is split in two — `tsconfig.app.json` covers `src/` minus the tests
with **no ambient types at all**, and `tsconfig.node.json` covers the configs, scripts, e2e
and the tests. `npm run build` runs `tsc -b` over both.

Before the split, `"types": ["vitest/globals", "node"]` applied project-wide, which meant a
component could reference `process.env` — `undefined` in a browser — or call `describe()`
and still typecheck. Both now fail to compile in application code. `globals: true` was
dropped from the Vitest config for the same reason; every test imports what it uses.

## The architectural rule that makes §16 work

`src/engine/` imports from `src/types.ts` **only** — never from `content.ts`. Content is
passed in as an argument to every engine function. That single constraint is what turns
the Rung-2 remix in §16 (*change what the third column is*) into a content edit instead of
an engine rewrite. It is established in M1 and audited in M6.

```
src/
├── content.ts          ← FORK SURFACE 1 — all writing, all data
├── theme.css           ← FORK SURFACE 2 — all colour/type/spacing
├── types.ts            ← shared types; the only thing engine/ may import
├── engine/             ← grid · deck · adjacency · report (pure functions)
├── components/         ← Intro · Plot · Hand · Observation · Report
└── App.tsx             ← reducer, phase switch (intro → play → report)
```

---

# Milestones

Seven milestones, each independently verifiable. M1–M6 map onto §18 priorities 1–6.

## M0 — Scaffold and toolchain ✅

**Goal:** a running dev server and a green test command.

- `.nvmrc` → `20`; Vite + React + TS config written directly rather than scaffolded, so
  there is no demo app to strip
- Vitest wired through `vite.config.ts` (imported from `vitest/config`, which Vitest 4
  requires). Scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `validate`
- `src/types.ts`: `Quality` (exactly the nine in §8.5), `Tier`, `Consent` (the four in
  §9.1), `CostBand`, `Plan`, `Placement`, `GameState`, `Config`, `Content`. Cells are a
  template-literal `CellId` (`'B2'`), not a `{col,row}` pair — content authoring names
  cells the way the GDD does, and §11's discovery triggers will too. The vocabularies are
  `as const` arrays with types derived from them, so M6's validator has runtime lists.
- `theme.css` with the custom-property block stubbed; `README.md` quick-start
- `scripts/validate.ts` wired up now, checking the vocabulary; deck checks land in M6

**Done when:** `nvm use && npm install && npm run dev` serves a blank page and
`npm test` passes with one placeholder test.

**Verified:** 4 tests pass · `tsc --noEmit` clean · `vite build` clean · dev server
returns 200 for `/`, `/src/main.tsx`, `/src/App.tsx`, `/src/theme.css` · `npm run validate`
exits 0.

## M1 — Core loop (§18.1) ✅

**Goal:** eight placements can be made on a real grid and the game ends. No writing yet.

- `engine/grid.ts` — 5×5, columns A–E, rows 1–5. Fabric at **B2, C2, B3, C3**, front door
  on B2 (§5). `orthogonalNeighbours`, `isOccupied`, `legalCells(state)` = every empty cell
  orthogonally adjacent to an occupied one (fabric counts as occupied), plus every
  still-standing fabric cell (§7.2 — the demolition target path exists here, its
  consequences land in M5).
- `engine/deck.ts` — `drawHand(state, rng)`: two from the current tier, one from any tier
  (§6). Rounds 1–2 threshold, 3–4 daily, 5–6 private, 7–8 outside. A placed plan leaves the
  pool; a passed-over hand returns to it. Injectable `rng` for deterministic tests.
  `ROUNDS` is a config constant so §6's **[Open]** 6-vs-8 playtest is one number.
- `content.ts` — deck skeleton: all 24 plans with `id`, `name`, `tier` only, typed as
  `PlanIdentity` (`Pick<Plan, 'id'|'name'|'tier'>`). The grid and the draw never read the
  writing, so they are typed against that narrower shape and M3/M4 widen the deck to full
  `Plan` without touching engine code.
- Reducer: `SELECT_PLAN`, `PLACE`, `RESTART`. It lives in `engine/game.ts` rather than
  `App.tsx` as originally planned — as a pure function it is directly testable, and
  `createGame(deck, config)` is how it reaches content without importing it. `NEXT_ROUND`
  was dropped: with no adjacency line to stop on yet, `PLACE` advances the round itself,
  and M3 splits it when there is something to dismiss.
- `components/Plot.tsx`, `Hand.tsx` — click a plan, legal cells highlight, click to place
  (§13). Round indicator *3 of 8*.
- Street and garden edge labels landed here rather than in M6: without them the grid can't
  be read, and orientation is the rule §17.9 asks whether players notice.

**Tests:** fabric occupied at start · legal-cell set from the opening position is exactly
right · a placed cell is never legal again · every hand across a seeded 8-round run is
2-from-tier + 1-any · no plan is dealt after being placed.

**Done when:** a full 8-round game can be played to its end in the browser, with correct
legal-cell highlighting throughout, and the grid shows named blocks.

**Verified:** 46 unit tests · 8 end-to-end tests in headless Chrome · `tsc --noEmit` clean ·
`vite build` clean.

Three layers, each catching what the one below cannot:

1. `src/engine/*.test.ts` — the pure functions: the grid, the draw, the reducer.
2. `src/App.test.tsx` — a complete eight-round game through the rendered components in
   jsdom, covering the click wiring.
3. `e2e/play.spec.ts` — the same game in real Chrome, covering layout and paint: that the
   plot lays out as an actual 5×5 grid, that the street sits above row 1 and the garden
   below row 5 by measured position, that the fabric fill and the legal-cell highlight are
   real computed-colour changes rather than just attributes, and that a whole playthrough
   leaves the console clean.

Layer 3 immediately found something the other two structurally could not: a missing
favicon 404ing on every load. Fixed with an inline SVG data URI, so §12's "no image
assets" still holds.

## M2 — Framing (§18.2) ✅

**Goal:** the player knows who the house is for before they place anything.

- `content.ts`: `premise` and `whyNow` — *"The roof failed in February. You can't put it off
  any longer."* The three §2 **[Open]** alternatives sit beside it in a comment so a
  playtest is a one-line swap. `household` — the three people from §2, each with `id`, a
  name and a setup line.
- The household is typed `HouseholdIntro` (`Omit<HouseholdMember, 'reaction'>`), the same
  move as `PlanIdentity` in M1: the reactions in §10.4 are written against a finished plot,
  so they arrive with the report rather than shipping as placeholder prose now.
- `engine/game.ts` gains an `intro` phase and a `BEGIN` action. The first hand is dealt at
  `initialState`, so dismissing the framing puts the player straight into round 1 rather
  than into a wait. Nothing can be selected or placed while the framing is up.
- `components/Intro.tsx` — shown once, before round 1, then never again (§2).

**Done when:** the intro shows the why-now line and three household members, dismisses to
round 1, and does not reappear.

**One judgement call:** *Build again* returns to the framing rather than straight to round
1. §14 says the framing is shown once before round 1, and a new game is a new round 1 — but
more than that, §2's design note calls the household the cleanest replay driver in the
design. Putting it back in front of the player on replay is what makes that land. Easy to
reverse if it grates in playtesting.

**Verified:** 57 unit and component tests · 9 end-to-end tests in Chrome · `tsc -b` clean ·
`vite build` clean. The framing is asserted at all three layers: that it blocks placement
while up, that it gives way to round 1, and that neither the why-now line nor any household
line appears anywhere on screen across a full eight-round game (§2 — never mentioned again
during play).

## M3 — Adjacency lines (§18.3)

**Goal:** the mechanic the whole prototype exists to test.

- `engine/adjacency.ts` — §8.6 resolution order, **maximum one line per placement**:
  1. explicit pair (matched in either direction)
  2. strongest quality match — an `emits` meeting a neighbour's `sensitive`, ranked by a
     severity order that lives in content
  3. orientation line for the placed plan's row (north = rows 1–2, south = rows 4–5)
  4. `null` — silence is a valid result
- `content.ts` grows the writing: the six §8.3 plans copied **verbatim** (they are the
  pattern), `emits`/`sensitive`/`orientation` on all 24, `pairLines` (the seven from §8.7
  plus kitchen/bin store, bathroom/kitchen, WC/dining room), `qualityLines` for each
  emitted→sensitive pair actually used.
- `components/Observation.tsx` — overlay, dismissed by click, **Space**, or **Enter** (§13).

This is also the one function where §11 Discovery would later slot in as step 0. Not built;
the seam is simply there.

**Tests:** explicit pair beats quality match beats orientation · never more than one line ·
silence when nothing fires · orientation fires on row, not column.

**Done when:** placing the home farm next to the kitchen produces *"A short walk with wet
hands. This is the version that gets used."*, and a placement with no relationship produces
nothing at all.

## M4 — The report (§18.4)

**Goal:** the payoff. Three columns, no numbers.

- `engine/report.ts` — `have` lines in placement order · cost bands aggregated to a phrase,
  **never a number** (§10.2) · `care` lines, the longest column by design · closing line
  selected from dominant qualities across the plot, not from a score (§10.3) · the three
  household reactions (§10.4): the drummer on where her room ended up relative to everyone
  else's, your mother on the distance from front door to bathroom in grid steps, you on
  whether a door you can close exists.
- `content.ts`: `have`/`cost`/`care` on all 24 plans, `costBands` copy (*Modest* /
  *Substantial* / *The kind of project you remortgage for*), `closingLines` with the
  quality profile that selects each, and the `reaction` selectors from M2 filled in.
- `components/Report.tsx` + **Build again** (§14).

**Tests:** no digits in the cost column · care column is assembled in the documented order ·
each household member yields exactly one reaction · closing line is deterministic for a
given board.

**Done when:** the eighth placement shows all three columns at once, a closing line, and
three household reactions — and no score, cost or counter has appeared at any point (§10.1).

## M5 — Demolition, consent, conservation (§18.5)

**Goal:** the only irreversible decision in the game, and the obligations it creates.

- Demolition path: placing on a fabric cell asks for **one** confirmation — the only
  confirmation in the game (§13). Demolishing **B2** removes the front door, and every
  subsequent placement plus the report reads against that (§7).
- `consent` flag on all 24 plans; flag shown on each plan in hand (§14).
- `content.ts`: `consentCare` — one care line per flag. Consent lands **inside** *what
  you'll look after*, not as its own section (§9.3).
- `conservationOverrides` — the four §9.2 deltas behind a single `conservation: true` config
  flag: north-elevation openings become `sensitive`, the heat pump becomes `householder`,
  fabric demolition becomes `sensitive` with a much longer care line, the glass-roofed
  extension gains its ridge-height line.

**Tests:** demolishing B2 clears the front door · demolition appears in the care column ·
`conservation: true` changes exactly the four documented things and nothing else.

**Done when:** a house can be built by demolishing, and playing the same deck twice —
once with `conservation: true` — produces visibly different obligations.

## M6 — Fork surface and validator (§18.6)

**Goal:** the §16 test passes for real, not by intention.

- `scripts/validate.ts`, `npm run validate` — non-zero exit with a readable message on: an
  unknown quality, a plan missing any of the seven fields, a tier with fewer than 3 plans
  (can't fill a hand), a consent flag outside the four, a pair line naming an unknown plan
  id, a duplicate plan id.
- Audit every `engine/` import: `types.ts` only. Move any stray copy out of components and
  into `content.ts`.
- `theme.css` finished — every colour, fill, font and spacing value as a `:root` custom
  property. Inherited fabric in a distinct muted fill with a visible edge; street edge (row 1)
  and garden edge (row 5) labelled; sun direction indicated once (§12).
- README gains a "what to fork" section covering the two files and the two remix rungs.

**Done when — the actual test:** swap the deck and household in `content.ts` for a different
building and change values in `theme.css`, and nothing else needs opening.

## M7 — Playtest pass

Not a build milestone; the reason the build exists. Play it through against §17's twelve
questions, with §17.6 (is 8 rounds right, does 6 leave adjacency underfired) settled by
flipping the `ROUNDS` constant from M1, and §17.7 (does anyone demolish) watched closely.

---

## Deck size — a GDD discrepancy, flagged

§8.1 asks for "16–18 plans", but the document actually names **24**: the §6 tier table
lists five per tier (Threshold, Daily, Private, Outside), and §8.3/§8.4 add four wildcards
— heat pump, solar array, internal wall insulation, air conditioning unit. Per your answer
I am writing **all 24 in full**, five per tier plus four wildcards. That is the version
satisfying §16's validator rule that every tier can fill a hand, and it drops none of the
named content. The 16–18 figure reads as stale against the rest of the document; noting it
rather than silently trimming.

## Verification

Per-milestone gates are above. Full check at the end:

```bash
nvm use            # .nvmrc → 20; default v14 will not run Vite
npm install
npm run validate   # deck integrity, must exit 0
npm test           # unit tests and the jsdom playthrough
npm run test:e2e   # the same game in real Chrome, plus screenshots
npm run dev        # manual playthrough
```

`npm run test:e2e` uses the system Google Chrome via Playwright's `channel: 'chrome'`, so
nothing has to download a browser. It writes screenshots to `e2e/screenshots/` (gitignored)
— the fastest way to see what a playthrough actually looks like without playing one.

Manual playthrough checklist: intro appears once before round 1 · eight placements end the
game · a B2 demolition asks for confirmation and surfaces in *what you'll look after* ·
`conservation: true` changes the four §9.2 items · no cost, score, counter or timer appears
at any point · the fork test in M6.

**What automated tests cannot settle.** Every question in §17 is a human one. The suites
prove the game is playable and the rules hold; whether the adjacency line reads as an
observation rather than a score, or whether the household is forgotten by round three, only
a playtest answers. M7 is where that happens.

## Explicitly out of scope

Discovery (§11) · placement animation and polish (§18.8) · save/load · multiple storeys ·
multi-cell plans · a visible budget · any score.
