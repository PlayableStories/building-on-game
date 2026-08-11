# Forking Building On

Building On is a small, opinionated, no-fail placement game about renovating a building
you inherited. This document is for **forkers who want to re-skin it** — keep the
mechanics, swap the building.

Everything player-facing lives in **two files**:

| File | What's in it | Who edits it |
|---|---|---|
| **`src/content.ts`** | All text: the plot, 31 plans, 6 situations, every observation, the rules card, the report, every UI string | Writers, designers, game designers |
| **`src/theme.css`** | All visuals: palette, tier colours, type scale, spacing, measures | Designers, themers |

Both are plain declarations — objects and arrays of strings, and CSS custom properties.
The dev server hot-reloads on save.

The engine never imports either of them. `src/engine/` imports `src/types.ts` and nothing
else, and content is handed to it as an argument. `npm run validate` **fails** if that
stops being true, which is what makes "you only need to change two files" a fact rather
than a claim.

If you instead want to **rebuild the game from scratch with AI assistance** on a different
stack, that's a separate path (Level 2) — see [REFERENCE_PROMPT.md](./REFERENCE_PROMPT.md)
for a ready-to-paste prompt and platform notes.

New to the game? [GAME-FLOW.md](./GAME-FLOW.md) walks through a round with screenshots.

## Workflow

```bash
git clone <your fork>
cd building-on-game
nvm use              # reads .nvmrc → 20. Vite 8 refuses anything below 20.19
npm install
npm run dev          # localhost:5173, hot-reload
# Edit src/content.ts and/or src/theme.css
npm run validate     # checks content is still playable, and the fork surface intact
npm run build        # production build sanity check
```

---

## `src/content.ts` — the text

One file, one export per thing. Edit values in place, save, hot-reload.

### `config` — the two dials

```ts
export const config: Config = {
  rounds: 8,            // how many plans get placed
  conservation: false,  // §9.2 — the one flag that changes the whole game
};
```

Set `conservation: true` and build the same building again. Same plans, same pleasures,
same cost — different obligations. That is the argument the game is making, and it is one
boolean.

### `plot` — the building you inherited

```ts
export const plot: PlotContent = {
  frontDoor: { cell: 'GC1', name: 'Front door' }, // permanent: never legal, never removable
  stair: { cell: 'GB1', name: 'Stairs' },         // permanent too, and the way upstairs
  fabric: [                                        // demolishable, and named
    { cell: 'GB2', name: 'Old kitchen' },
    { cell: 'GC2', name: 'Old sitting room' },
    { cell: 'GB3', name: 'Old scullery' },
    { cell: 'GC3', name: 'Old back room' },
  ],
  gardenFromRow: 4,      // rows 4–5 are the garden; rows above are the building
};
```

**Cell ids carry their level.** `G` is the ground floor, `F` the first, `R` the roof, so
`GB2` is the ground floor's B2. Every inherited cell above must be on the ground floor —
the validator checks it. The **landing** on `FB1`, directly above the stair, is derived
by the engine rather than written here; it is named by `ui.plot.landing`.

**Name every inherited cell.** The validator insists, because playtesting found that a
cell labelled *Inherited* reads as scenery and nobody works out it can be built on. A cell
that says *Old scullery* reads as a room, and rooms can go.

`frontDoor` does not have to be a door. It is whatever this building has that the person
who inherited it does not get to decide about — a chimney stack, a party wall, a memorial
bench, a protected tree. `stair` is whatever gets you to the level above; if your building
has only one level, it is still the cell that cannot move.

### `deck` — 31 plans

```ts
{
  id: 'porch',                  // unique; pair lines and situations refer to it
  name: 'Porch',                // printed on the block
  tier: 'threshold',            // threshold | daily | private | outside | roof | wildcard
  where: 'house',               // house | garden | upstairs | roof — the rule for
                                // which cells it may go in (see below)
  consent: 'permitted',         // permitted | householder | sensitive | demolition
  cost: 'low',                  // very-low | low | moderate | high
  have: 'Somewhere to stand while you find your keys, out of the rain.',
  care: 'Gutters, a light that keeps failing, and a step that collects leaves.',
  emits: ['footfall'],          // qualities it pushes into its neighbours
  sensitive: [],                // qualities it suffers from
  orientation: {                // optional, per compass direction
    north: 'Facing the street, which is where a door is usually pleased to be.',
    south: 'A front door onto the garden. You will use the other one.',
  },
}
```

`have` and `care` are the two halves of a report row: what you gain, and what it will ask
of you for as long as you have it. Write them as a pair. A `care` line that is a warning
rather than an obligation makes the game moralise, which is not what it is for.

### `situations` — six, one drawn per game

```ts
{
  id: 'door',
  line: 'You work from home now, and there has never been a door you could close.',
  reaction: (house) => { … },   // one sentence about the finished building
}
```

The `reaction` receives a read-only summary of the finished plot and returns a string:

| Helper | Gives you |
|---|---|
| `house.has(id)` | Was this plan placed at all? |
| `house.cellOf(id)` | Where it went, or `null` |
| `house.distance(a, b)` | Steps between two plans, or `null` |
| `house.fromFrontDoor(id)` | Steps from the fixed cell, or `null` |
| `house.dominant` | The strongest qualities across the whole plot |
| `house.placed` | Every placement, in order |
| `house.fabricRemaining` | Inherited cells still standing |

This is the highest-leverage thing to change. The situation is what the whole building is
being judged against, and it is the last thing the player reads.

**Write the answer for when they missed.** *There is still no kitchen* is a better ending
than a congratulation, and a situation with only a happy answer is not a situation.

### The writing that fires during play

| Export | What it is |
|---|---|
| `pairLines` | `{ a, b, line }`, plus optional `over: true`. Two plan ids, or a plan and `'fabric'` (the old building) or `'*'` (anything). Matched in either direction; the most specific wins. |
| `qualityLines` | One line per quality, fired when something emitting it meets something sensitive to it. Fires through a floor as readily as through a wall — no separate vertical writing needed. |
| `qualitySeverity` | All nine qualities, strongest first. Decides which line wins when several fire. |
| `causeWords` | The connecting words that name a cause — `beside`, `above`, `below`, `and`, what to call the old building, and one phrase per band of the plot for orientation lines. |

**`over` is how a pair line goes vertical.** A placement is read against six cells: the
four beside it, the one under it and the one over it. A pair line without `over` is about
a shared wall and fires sideways only; one with `over` fires only when `a` sits directly
on `b`, and it is directional — *bathroom over living room* is not *living room over
bathroom*. That default is deliberate: every line written before the house had levels
means "beside", and letting them fire through a ceiling would put existing writing in a
situation nobody wrote it for.

The cause phrase groups by relationship, so a line reads *"Bedroom above Kitchen"* rather
than calling everything "beside". If your fork's building has no levels, give no plan
`where: 'upstairs'` or `'roof'` and none of this ever fires.

### The framing and the report

| Export | What it is |
|---|---|
| `premise`, `whyNow` | Two sentences before the game starts. |
| `rules` | `{ objective, points[] }` — the card shown first and reopenable from the header. |
| `ui` | Every other word: title, buttons, headings, the prompt above the hand, the plot's edge labels, the demolition question. |
| `costPhrases` | Cost as a phrase, never a figure. The validator rejects any with a digit in it. |
| `closingLines` | `{ line, dominant?, fabric? }` — one sentence about the finished building. **At least one must carry no conditions**, or there are houses the game has nothing to say about. |
| `consentCare`, `consentLabels`, `consentOrder` | One obligation line and one short label per flag, and the order that decides which two obligations the report has room for. |
| `demolitionCare` | The obligation that arrives when something came down. |
| `conservationOverrides` | What changes when `config.conservation` is on. |

### What you can change freely

Every string, every id, every plan, every situation, the whole plot, the round count, and
the order of `qualitySeverity` and `consentOrder`. Reordering those last two changes what
the game emphasises without a line of engine code moving.

### What to leave alone

Four vocabularies in `src/types.ts` are ids the engine matches on, not text:

| Vocabulary | Values |
|---|---|
| `QUALITIES` | `heat` `damp` `noise` `smell` `light` `work` `quiet` `footfall` `shade` |
| `CONSENT_FLAGS` | `permitted` `householder` `sensitive` `demolition` |
| `TIERS` | `threshold` `daily` `private` `outside` `roof` (+ `wildcard` for plans) — the order is the order they are dealt in |
| `COST_BANDS` | `very-low` `low` `moderate` `high` |

**The labels for all four are content.** `consentLabels` decides that `householder` prints
as *application*; nothing stops you printing it as *you'll need to ask the co-op*. It is
the id that has to stay put. Adding a tenth quality means touching `types.ts` — Level 2.

---

## `src/theme.css` — the visuals

Every colour, fill, font, size, spacing step and measure is a `:root` custom property. No
component stylesheet hard-codes a value.

| Block | What it controls |
|---|---|
| Surface | Page, ink, rules |
| The plot | Empty cells, the garden band, the legal-cell highlight, inherited fill, the front door |
| Tiers | One colour per tier — the six that make the plot readable at a glance |
| Selection and controls | The selected plan, focus rings, buttons |
| The adjacency line | The observation panel |
| Consent | One colour per flag. A scale of process, not a traffic light: nothing here should read as a warning |
| Demolition | The one confirmation |
| The report | Headings, and the emphasis on the obligation column |
| Type, spacing, measure | The scale, the grid steps, and how wide prose is allowed to get |

**One documented exception.** CSS cannot read a custom property inside a media query, so
the breakpoint in `src/app.css` (`@media (min-width: 44rem)`, where the report's two
columns separate) is a literal and has to stay that way. It is the only size in the game
not declared in `theme.css`.

**No web fonts.** The game uses `ui-serif` and `ui-sans-serif` stacks, so there is nothing
to load and nothing to swap in `index.html`. Point `--font-body` and `--font-ui` at
whatever you like; if you want a hosted font you will need to add the `<link>` yourself.

---

## Validation

Run these before committing your re-skin:

```bash
npm run validate     # content is playable, and the fork surface is intact
npm test             # 223 unit and component tests
npm run build        # type-check and production build
npm run test:e2e     # plays a whole game in your own Chrome
```

`npm run validate` catches:

- A plan missing any required field, or with an unknown tier, cost, quality or consent flag
- Duplicate plan ids, situation ids, or inherited cells
- **A tier with fewer than 2 plans** — the draw takes two from the round's tier and would
  deal short, which only shows up on some seeds
- **A `where` with no plans at all** — a value nothing uses is a legality rule with no
  cards, which is a fork surface that silently does nothing
- An unnamed inherited cell, one placed in the garden, or one above the ground floor
- **A plot that is not one connected building**, or one that does not touch the garden —
  a garden plan dealt in round 1 would have nowhere legal to go
- A pair line naming a plan that is not in the deck
- **A pair line whose two plans can never meet** — a garden plan written "beside" an
  upstairs one, or an `over` line pointing at something the geometry never stacks. This
  is the check that would have caught four lines going quietly dead when the private
  rooms moved upstairs, and it names which two `where` values are the problem
- A quality that can fire but has no line, or a sensitivity nothing in the deck produces
- A `qualitySeverity` or `consentOrder` that does not rank every value exactly once
- A cost phrase containing a digit
- **No unconditional closing line**, so some finished buildings would end in silence
- No situations, or a `rules` with no objective
- **Engine code importing anything but `types.ts`** and its own siblings
- **A sentence written into a component** where a fork cannot reach it

---

## Known friction

Honest list of what a re-skin will run into.

1. **The engine tests are fixtures, not a contract.** `src/App.test.tsx` and
   `e2e/play.spec.ts` test behaviour, read their labels and cell references out of
   `content.ts`, and pass on your fork unchanged. The tests in `src/engine/*.test.ts`
   assert particular sentences from *this* deck — that the home farm beside the kitchen
   says *"A short walk with wet hands"*. Expect to rewrite or delete those alongside the
   writing they check. They are not testing the engine's contract; they are testing this
   content against it.

2. **The grid is 5×5 on three levels, in the engine.** `ROWS`, `COLUMNS` and `LEVELS`
   live in `src/types.ts`, and the row→position map and the four `where` rules in
   `src/engine/grid.ts`. A differently shaped plot, a fourth level, or a fifth `where` is
   Level 2. `gardenFromRow` *is* content, so where the building stops and the garden
   starts is yours — just not how many rows or levels there are.

   A single-storey fork is a re-skin, not an engine edit: give no plan `where: 'upstairs'`
   or `'roof'` and the upper levels are simply never legal. The switcher still shows them,
   which is the honest cost of doing it this way.

3. **The resolution ladder is fixed.** Explicit pair → quality match → orientation →
   silence, one line per placement, in `src/engine/adjacency.ts`. You can change every
   line it selects and the order of `qualitySeverity`; you cannot make quality beat an
   explicit pair without editing the engine.

4. **`REPORT_PAIRS = 3` and `OBLIGATION_LINES = 2`** are constants in
   `src/engine/report.ts`, not in `config`. They were a playtest decision — the earlier
   version printed everything and got *"too complicate and too long"*. Changing them is a
   one-line edit, but it is an engine edit.

5. **The favicon is inline.** It is an SVG data URI in `index.html`, not a file. Nothing
   to replace; edit the two rectangles if you want a different mark.

6. **`name` in `package.json`** is cosmetic, invisible to players, and unrelated to
   deployment — the Pages workflow reads the repository name at build time, so a fork
   deploys under its own name with no edit at all.

---

## Re-skin checklist

A copy-paste checklist for your fork's PR description.

### The building (`src/content.ts`)
- [ ] `plot` — the fixed cell, the demolishable rooms, all named, `gardenFromRow`
- [ ] `premise` and `whyNow` — why this building has to change
- [ ] `rules` — the objective and the points, in your building's language
- [ ] All 31 plans: `name`, `have`, `care`, `orientation`, and their `tier` / `where` / `cost` / `consent`
- [ ] All 6 situations, each with an answer written for when the player missed
- [ ] `pairLines` — the specific pairings worth a sentence
- [ ] `qualityLines` — one per quality that can fire
- [ ] `closingLines` — including at least one with no conditions on it
- [ ] `costPhrases`, `consentCare`, `consentLabels`, `demolitionCare`
- [ ] `causeWords.facing` — one phrase per band of your plot
- [ ] `ui` — every remaining string

### The look (`src/theme.css`)
- [ ] Page palette
- [ ] The garden band and the legal-cell highlight
- [ ] Six tier colours
- [ ] Four consent colours — a scale of process, not a traffic light
- [ ] (Optional) `--font-body` / `--font-ui`, and the type scale

### Before you ship
- [ ] `npm run validate` green
- [ ] `npm run build` green
- [ ] `npm test` — engine fixtures rewritten or removed, behaviour suites still passing
- [ ] Played a full game in the browser, including one demolition
- [ ] Played it again with `conservation: true`
- [ ] (Optional) `npm run screenshots` to regenerate the five frames in `GAME-FLOW.md`

---

Issues and PRs welcome at the upstream repo:
<https://github.com/PlayableStories/building-on-game>.
