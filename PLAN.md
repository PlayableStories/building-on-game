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
| State | **`useReducer` in `App.tsx`** | The whole game is one immutable `GameState`; a state library earns nothing at 75 cells and 10 rounds |
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

## M3 — Adjacency lines (§18.3) ✅

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

**Three things the GDD did not settle, decided here:**

1. **The boot room emits a quality that does not exist.** §8.3 gives it `emits: damp,
   clutter`, but §8.5 fixes the vocabulary at nine and clutter is not among them. Resolved
   as `damp, work` — the boot room's own care line says as much: *"It only works if you keep
   it emptied. Most people don't."* Flagged rather than silently widened, because §8.5's
   smallness is the point.
2. **Two of §8.7's lines are not plan-to-plan.** Air conditioning speaks "beside anything",
   and insulation reacts to the original solid walls rather than to a room. `PairLine.b`
   therefore accepts a plan id, `'*'`, or `'fabric'`, and resolution prefers the most
   specific match — so a wildcard rule can be added to a deck without drowning everything
   near it.
3. **Nothing in the GDD emits `shade`,** though the home farm suffers from it. Full-height
   rooms now emit it: the glass extension, living and dining rooms, bedroom, bathroom,
   study, gym, spare room and shed. That is what makes the garden tier's placement matter at
   all, and it is a content decision, reversible in `content.ts`.

**Also:** `QualityLine` became `{ quality, line }`. The M0 guess had separate `emits` and
`sensitive` fields, but §8.6 only ever fires a quality against its own sensitivity, so the
second axis had nothing to key on.

**Verified:** 90 unit and component tests · 12 end-to-end tests in Chrome · `tsc -b` clean ·
`vite build` clean. The resolution order is asserted step by step — a pair beating a live
quality match *and* a live orientation line, a quality match beating orientation, the
strongest quality winning when several fire, and silence when nothing does. Two content
checks are worth keeping: every sensitivity in the deck is emitted by something (otherwise
it is dead weight), and no line is written twice.

## M4 — The report (§18.4) ✅

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

**Two things the build settled that the plan had left vague:**

1. **The household reactions needed a way to ask questions of the finished plot** without
   `content.ts` importing engine code — which is the constraint the whole fork surface
   rests on. `HouseSummary` is the answer: `has`, `cellOf`, `distance`, `fromFrontDoor`,
   `dominant`, `fabricRemaining`, `frontDoor`. A `reaction` is now `(house) => string`, so
   a forked household can measure whatever its own building cares about.
2. **`closingLines` needed two axes, not one.** The plan said "selected from dominant
   qualities", but two of §10.3's own four examples are about how much of the old house
   survived, not about qualities. `ClosingLine` is `{ line, dominant?, fabric? }`, resolved
   most-specific-wins, with exactly one unconditional fallback.

**Also:** cost is banded by *share of the dearest house the same number of plans could have
been*, then indexed into `costPhrases`. Adding a fourth phrase makes the scale finer without
the engine knowing how many there are — and there is never a number to show.

**Verified:** 116 unit and component tests · 17 end-to-end tests in Chrome · `tsc -b` clean ·
`vite build` clean. The §10.1 guarantee is asserted twice over: no digit reaches the cost
column across thirty seeded games, and `.report` does not exist in the DOM until the eighth
plan lands. The care column is measured against the have column in words, in both jsdom and
a real browser, because "the longest column, deliberately" is a design requirement rather
than an accident of the writing. The closing line is checked for determinism *and* for
independence from build order — the same house reached by a different route says the same
thing about itself.

## M5 — Demolition, consent, conservation (§18.5) ✅

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

**Two readings of the GDD that had to be settled, both flagged rather than silently
chosen:**

1. **"Demolition of any fabric cell becomes `sensitive`" (§9.2).** Read as a *replacement*
   it would make conservation weaken the obligation — `sensitive` is a lighter flag than
   `demolition` — which contradicts the same sentence asking for a much longer care line.
   So it is read as an *addition*: a demolition under conservation carries both. A
   placement therefore carries a set of flags, not one. The single flag §14 asks for on a
   plan in hand is unaffected: that is the plan's own, because where it lands and what it
   lands on are exactly what the player has not decided yet.
2. **"New openings in the north (street) elevation" (§9.2)** needed a definition of an
   opening. A plan has one on an elevation if it has orientation writing for it — §8.3's
   orientation lines are precisely the writing about light, view and exposure, so a plan
   with a north line is a plan with a window on the street. This makes the rule
   placement-dependent, which is right: the same bedroom on the street and in the garden
   are not the same application.

**Also:** consent obligations are deduplicated. Three householder applications are one
ongoing relationship with the local authority, not three — §9.3's design note is explicit
that planning is a relationship rather than a cost paid once, and the care column would
read as a tally if it repeated. They are ordered by the flag vocabulary rather than by
placement, so the same house always reads the same way.

The deck is a full `Plan` from here — the staged plan types are gone. `PlanIdentity` and
`PlanAdjacency` stay, because the grid, the draw and the adjacency resolution genuinely do
not read the report writing or the consent flag, and typing them against what they use is
what stops a content change breaking them.

**Verified:** 160 unit and component tests · 26 end-to-end tests in Chrome · `tsc -b` clean ·
`vite build` clean. The confirmation is asserted from both sides — that it appears for
fabric and for nothing else, that backing out leaves the plot untouched and the plan still
selected so it can go elsewhere, and that nothing else in the game can happen while it is
waiting. §9.2 is tested as an exclusion as well as an inclusion: for every plan the
overrides do not name, away from the street, conservation changes nothing at all. And the
same finished plot is reported both ways and compared — identical plans, identical
pleasures, identical cost, and an obligation list that grows from twelve lines to fourteen.

## M6 — Fork surface and validator (§18.6)

**Moved to M12.** It has to run *after* the playtest revisions rather than before them:
its whole job is to audit and validate the fork surface, and M8–M11 add four new things
to that surface (`zone`, `plot`, `situations`, the paired report). Validating the shape
that is about to change would be work done twice. See Part two.

## M7 — Playtest pass — **done**

Not a build milestone; the reason the build exists. Played through against §17's twelve
questions, split into the half a simulation can answer and the half only a player can.

**The measured half** — a harness driving the real engine over 400 seeded games per
condition, with three simulated players (never demolish, always demolish, choose at
random), because anything that depends on choice is not one number:

- **§17.6 — is 8 rounds right? Yes, and 6 underfires exactly as §6's [Open] suspected.**
  *(Superseded by M17: the roof tier made it ten, on the same arithmetic of two placements
  per tier. The finding below is why it was not six.)*
  At six rounds a line fires on 38.7% of placements, the median game gets **2** lines, and
  17 of 400 games are silent from start to finish. At eight: 45.8%, median **4**, and only
  3 of 400 silent. Six rounds does not shave a quarter off the adjacency, it halves the
  median and makes a silent playthrough five times more likely — a player who gets two
  lines in six rounds has not seen the mechanic the prototype exists to test.
  **`config.rounds` stays 8, and §6's [Open] is closed.**
- **§17.4 — the free third card.** 87.3% of hands hold something off the current tier, so
  the disruption is nearly always live. System plans reach 20.9% of hands, about 1.7 times
  a game — present without dominating.
- **§17.7 — demolition is never unavailable.** The old house is a legal target in 100% of
  games from the opening move; all four cells, before anything else exists. Never-demolish
  0.00 cells/game, always 4.00, random 2.07 (front door gone in 52.3%). So if real players
  don't demolish, it is the inheritance framing doing it, not cost or availability — which
  makes §17.7 and §17.8 the same question.
- **§17.9 — orientation gets talked over.** Of lines that fire: quality 56.4%, orientation
  31.1%, pair 12.5%. Sharper: orientation *had something to say* on 1.9 placements a game
  and got to say it 60.6% of those times; the rest were outranked by a pair or quality
  match. Not invisible, but a player who never notices the rule has had it explained to
  them about twice a game.
- **§17.12 — two games diverge without trying.** Two random playthroughs share 36.6% of
  their plans and land on the same closing line 32.0% of the time.
- **§9 — the conservation flag.** Off: 12.3 care lines/game (householder 3.8 · permitted
  3.8 · demolition 2.1 · sensitive 0.4). On: 14.1 (sensitive jumps to 3.2). **A content
  finding rather than a bug: without conservation, `sensitive` fires 0.4 times a game —
  the glass extension is effectively its only source.** Three of the four flags do real
  work and one barely appears. Decide in M12 whether that is thinness or intent.

**The played half** is what Part two is. Every finding there came from playing the build
at `89fc509` cold, then reading the report, then building again.

---

# Part two — playtest revisions (M8–M12)

## What the playtest changed

M0–M5 are built and merged. The measured half above settled the open questions and
changed nothing. The played half changed six things:

| Finding, as reported | Becomes |
|---|---|
| "We do not know inherited can be replaced." Wants a short objective and rules up front, recallable during play | **M9** |
| The household is gone by round 3. Doesn't want three people; wants **one** situation drawn from six, all common to most people | **M9** |
| "I do not aware the line is directly related to my placement and/or the neighbour" — no sense of cause and consequence | **M10** |
| The inherited cells are confusing: they occupy squares with no function of their own. *Inherited* should be the small light label; the room's own name should sit at the top of the cell and read exactly like any other room | **M8** |
| The report is too complicated and too long — three per group at most. And responsibility never resolved into a felt sense of long-term benefit | **M11** |
| Move the front door B2 → C1 · rows 4–5 become garden · indoor and outdoor plans stay in their zones | **M8** |

§17.3 came back clean — the tiers already feel like building a house. No change.

## Decisions taken

Settled before writing this, so they are not re-opened mid-build:

1. **The front door at C1 is permanent.** Inherited, never a legal placement, cannot come
   down. The four old rooms behind it stay demolishable. This deletes the "there is no
   front door" ending and everything written against it.
2. **Strict indoor/outdoor.** Every plan is one or the other; there is no "either" zone.
3. **The report pairs benefit with obligation** — three rows, each showing what you gain
   beside what it asks, with cost and obligations as short lines underneath.
4. **Six fresh situations**, one per game, replacing you/daughter/mother entirely.

## One consequence, flagged rather than silently patched

Strict zoning puts every outdoor plan in rows 4–5, and both are `south` under the current
`orientationOf`. That makes the north orientation lines on the vegetable garden, terrace,
lawn and home farm **unreachable** — four written lines that can never fire again — and
leaves a garden in which all ten cells are the same cell.

The fix costs nothing structurally. Change `orientationOf` in `src/engine/grid.ts` from
*rows 1–2 north / rows 4–5 south* to:

| Row | Faces | Zone |
|---|---|---|
| 1 | `north` — the street | indoor |
| 2 | — | indoor |
| 3 | `south` — backs onto the garden | indoor |
| 4 | — in the shadow of the house | outdoor |
| 5 | `south` — open garden, full sun | outdoor |

Same mechanism, no type changes, and both zones keep a real front-to-back choice: indoors,
row 1 faces the street and row 3 faces the garden; outdoors, row 4 sits in the building's
shadow and row 5 does not. The four unreachable north lines are rewritten as row-4 shadow
lines rather than deleted.

## M8 — The plot: fixed door, zones, named fabric

**Goal:** the grid everything else is read against.

**The plot becomes content.** `src/engine/grid.ts` hard-codes `FABRIC_CELLS` and
`FRONT_DOOR_CELL`. Both move into `content.ts` and are passed through `createGame` — the
plot of an inherited *building* is exactly what a fork changes (§16):

```ts
export const plot: PlotContent = {
  frontDoor: { cell: 'C1', name: 'Front door' },   // permanent, never legal
  fabric: [                                         // demolishable
    { cell: 'B2', name: 'Old kitchen' },
    { cell: 'C2', name: 'Old sitting room' },
    { cell: 'B3', name: 'Old scullery' },
    { cell: 'C3', name: 'Old back room' },
  ],
  gardenFromRow: 4,
};
```

Naming the old rooms is the fix for "they occupied the square without any function of
themselves". A room called *Old kitchen* reads as replaceable in a way *Inherited* never
did — which is also half the answer to "we do not know inherited can be replaced".

**Zones.** `Plan` gains `zone: 'indoor' | 'outdoor'`; `PlanIdentity` widens to include it
so `Plot.tsx` can ask the selected plan. Outdoor (7): vegetable garden, terrace, shed,
lawn, home farm, bin store, heat pump. Indoor (17): everything else, including the solar
array (it is on the roof) and the AC unit (the room it cools). `legalCells(state, zone)`
intersects the existing frontier rule with the zone's rows and excludes the front door
cell unconditionally; `game.ts` passes the selected plan's zone through `propose`/`place`.

**No deadlock is possible, and it gets a test.** A demolished fabric cell is replaced by a
placement, so B3/C3 are occupied either way — B4/C4 are therefore legal from round one and
the outdoor frontier never closes. The same argument holds indoors.

**The front door stops being nullable.** `state.frontDoor` becomes `CellId`, not
`CellId | null`. The null branches in `report.ts`, `game.ts`, the `isFrontDoor` prop and
`.demolition__door` branch in `Demolition.tsx`, and their tests all go.

**Rendering.** Every occupied cell — placed, fabric or door — renders its name at the top
of the cell in the same treatment. Inherited cells add a small light `inherited` label
beneath, styled as `.cell__door` is today; the `.cell__door` special case is deleted. Add
a visible garden band behind rows 4–5.

**Done when:** an outdoor plan highlights only rows 4–5 and an indoor plan only rows 1–3 ·
C1 shows *Front door* like any other room and never highlights · the four old rooms show
their own names with *inherited* small and light beneath · 400 simulated games complete
with no unplaceable hand.

## M9 — Teaching the game, and one situation

**Goal:** a first-time player is told what they are doing, can look it up again mid-game,
and is given one reason to care rather than three they will forget.

**The rules card** — new `src/components/Rules.tsx`, copy in `content.ts` as
`rules: { objective: string; points: string[] }`:

> **The objective** — Ten rounds. Turn the house you inherited into one that works for
> the situation you are in. There is no score and no way to lose.
>
> - Each round you are dealt three plans. Choose one. The other two are gone.
> - It must touch something already built, and you can never move it.
> - Rooms go in the house, rows 1–3. Garden things go in the garden, rows 4–5.
> - **The old rooms can be taken down.** Place on one and it goes, for good.
> - The front door is fixed. It came with the house.

Shown as part of the intro before round 1, and reopenable at any point from a `Rules`
button in the header. Open/closed is `useState` in `App.tsx` — UI, not game state, so the
engine is untouched. Escape and click-outside close it, reusing `Demolition.tsx`'s keydown
pattern.

**Six situations, one per game.** `HouseholdMember` becomes
`Situation { id, line, reaction(house) }` — `name` goes, there is no "Your daughter, 14"
any more. `GameState` gains `situationId`, chosen from the seeded rng in `initialState` so
a game is still reproducible from one number. Draft six: no door to close · a parent
moving in and the stairs · a teenager who needs somewhere loud · a baby in the spring ·
two of you cook and one tidies · on your own, and people visit. Each gets a
`reaction(house)` written against the existing `HouseSummary` helpers. The three current
reactions are deleted, but their *shapes* are worth reusing — front-door distance for the
stairs, bedroom-to-living-room distance for the teenager, `has('study')` for the door.

**Done when:** the intro shows one situation and the rules · the rules reopen mid-round
without disturbing it · the same seed always gives the same situation · the report answers
that one situation and no other.

## M10 — Cause and consequence in the line

**Goal:** the fix for *"I do not aware the line is directly related to my placement"*. The
line currently appears as an unattributed caption. It has to name what caused it and light
the cells involved.

`observationFor` stops returning `string | null` and returns:

```ts
export interface Observation {
  line: string;
  kind: 'pair' | 'quality' | 'orientation';
  /** The cell just placed. */
  cell: CellId;
  /** The neighbours that caused it. Empty for an orientation line. */
  because: CellId[];
  /** 'Kitchen beside the bin store' · 'Terrace, at the bottom of the garden' */
  cause: string;
}
```

`Neighbour` gains `cell: CellId` so `explicitPair` and `qualityMatch` can report *which*
neighbour fired rather than only that one did. `GameState.observation` becomes
`Observation | null`; the §8.6 resolution order does not change. `Observation.tsx` renders
`cause` above `line` in the small light UI face so the line keeps its weight. **The
load-bearing part:** `Plot.tsx` takes `highlight: CellId[]` and marks the placed cell plus
its causes with `.cell--cause` while the line is up, so the player sees the two blocks lit
while reading the sentence about them.

**Done when:** placing the home farm beside the kitchen shows *"Home farm beside the
kitchen"* above *"A short walk with wet hands…"* with both cells lit, and an orientation
line names the row instead of a neighbour.

## M11 — The report, paired and shortened

**Goal:** three rows, and responsibility sitting where the benefit cannot be read without it.

```ts
export interface Report {
  /** §10.2 — the three that ask the most, benefit beside obligation. */
  pairs: { name: string; have: string; care: string }[];
  cost: string;
  /** §9.3 — condensed to at most two lines, heaviest first. */
  obligations: string[];
  closing: string;
  /** §10.4 — the one situation, answered. */
  answer: string;
}
```

**Which three:** ranked by what the thing asks of you — `COST_WEIGHT[plan.cost]` plus the
plan's index in `consentOrder`, ties broken by later placement. The three that ask most are
the three the report is about, which is the same argument the pairing is making.

**Obligations:** `consentCare` can emit four lines plus `demolitionCare`. Keep the two
heaviest present by `consentOrder` and drop the rest; the deduplication in
`engine/consent.ts` stays, only the cap is new.

`Report.tsx` renders two columns of three rows, cost and obligations as labelled lines
beneath, then the closing line and the situation's answer. The household `<dl>` goes. On
narrow screens the columns stack with each obligation directly under its own benefit,
never reordered away from it.

**Done when:** the report is at most three pairs, one cost line, two obligation lines, a
closing line and one answer — and no benefit is readable without its obligation beside it.

## M12 — Fork surface and validator (was M6, §18.6)

**Goal:** the §16 test passes for real, not by intention. Unchanged in intent, extended to
everything M8–M11 added to the surface.

- `scripts/validate.ts`, `npm run validate` — non-zero exit with a readable message on: an
  unknown quality · a plan missing any required field · **a missing or invalid `zone`** ·
  **a zone too thin to fill a hand** · a tier with fewer than 3 plans · a consent flag
  outside the four · a pair line naming an unknown plan id · a duplicate plan id · **a
  `plot` whose fabric is not orthogonally connected, or whose front door does not touch
  it** · **fewer than one situation** · **no unconditional closing line**.
- Audit every `engine/` import: `types.ts` only — still true after `plot` and the
  situations were threaded through `createGame`.
- `theme.css` finished — every colour, fill, font and spacing value a `:root` custom
  property, including the garden band and `.cell--cause`.
- README gains "what to fork": the two files, the two remix rungs, and the fact that the
  plot itself is now content.
- Settle the `sensitive` finding from M7: one flag firing 0.4 times a game is either
  thinness to fix with a second `sensitive` plan, or intent to document.

**Settled as thinness.** The air conditioning unit moves from `householder` to
`sensitive` — an external condenser running in the evenings is exactly what a
condition gets attached to, and it is the only plan in the deck where that is
defensible without making §9 dishonest to buy a nicer distribution. A player now
meets the flag in **45.0%** of games rather than 37.5% (0.48 per game, up from
0.38). Still the rarest of the four, which is right: most domestic work is
permitted development or a householder application, and the flag is a scale of
process rather than a spread to balance.

**Done when — the actual test:** swap the deck, the plot and the situations in
`content.ts` for a different building and change values in `theme.css`, and nothing else
needs opening.

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

Manual playthrough checklist, as of Part two: the rules card appears before round 1 and
reopens mid-play · one situation, answered once at the end · a garden plan cannot be
placed in the house and a house plan cannot be placed in the garden · an upstairs plan
lights only first-floor cells that sit over a room · the front door at GC1 and the stair
at GB1 never highlight · demolishing an old room asks once and surfaces in the obligations ·
every line names its cause and lights the cells that caused it · a bedroom placed over a
kitchen says *above* rather than *beside*, and the level switcher marks the floor the other
end of the line is on · the report is three pairs,
a cost line, two obligations, a closing line and one answer · no cost, score, counter or
timer appears before the report · the fork test in M12.

Each of M8–M11 also extends the simulation harness that ran M7: 400 seeded games complete
with no unplaceable hand and no placement outside its zone (M8) · the situation is stable
for a seed and spread across all six (M9) · every fired line carries a non-empty `cause`,
and a non-empty `because` for every pair and quality line (M10) · no report exceeds its
line budget (M11).

**What automated tests cannot settle.** Every question in §17 is a human one. The suites
prove the game is playable and the rules hold; whether the adjacency line reads as an
observation rather than a score, or whether the household is forgotten by round three, only
a playtest answers. M7 was where that happened, and Part two is what it returned.

## Explicitly out of scope

Discovery (§11) · placement animation and polish (§18.8) · save/load · a seed URL
parameter · a basement · multi-cell plans · a visible budget · any score.

*Multiple storeys was on this list until M15. See GDD §4 for what changed the decision —
the short version is 187,492 roof applications in `PLANNING-DATA.md`.*
