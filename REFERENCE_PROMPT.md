# Reference Prompt — Build a placement game with AI

This is the **Level 2** path for forkers. Use it two ways:

- **Faithful rebuild** — recreate Building On on a different platform or stack.
- **Creative fork** — use the prompt as a template and change the building, the plans, the
  situations and the writing during generation. Same mechanics, your world.

If you only want to swap text and visuals on an existing copy of this repo,
[FORKING.md](./FORKING.md) (Level 1) is faster.

## When to use Level 2

Choose Level 2 if you want any of:

- A different stack (Next.js, Vue, Svelte, native mobile, whatever's current when you read
  this)
- A **differently shaped plot** — not 5×5, more or fewer than three levels, a fifth
  `where` rule, or multi-cell plans. These are engine constants here, so they are not
  reachable from Level 1
- Substantially different mechanics — a different resolution ladder, more report rows,
  a basement, saved games
- To re-theme during generation rather than after
- A clean codebase without inheriting our git history

Otherwise, Level 1 is the cheaper path.

## How to use this document

Paste the prompt below into your AI builder of choice. It's self-contained — the builder
doesn't need to crawl this repo, though it can if it supports URL references (the link is
at the bottom of the prompt).

The prompt's last section asks the AI to **present a checklist back to you** (the building,
the situations, the plans, the mechanics) and wait for your confirmation before writing
code. Use that moment to change the theme if you're doing a creative fork.

---

## The prompt

````markdown
You will build a no-fail placement game as a single-page web app. The reference theme is
"Building On" — you have inherited a house and are renovating it — but the human pasting
this prompt may want a different building (a community centre, a co-op office, a high
street, a hospice garden, a ship). Confirm the theme with them before you start (see
"Confirmation before you build" at the end).

The player places one thing per round on a grid, can never move it afterwards, and
discovers through what ends up next to what that a building is not a list of rooms but a
set of things they have agreed to look after. There is no score and no way to lose.

## Reference stack (what we tested with — substitute freely)

- React 19 (Vite scaffold), TypeScript
- `useReducer` for game state — no state library; the whole game is one reducer
- Plain CSS with custom properties, so `theme.css` is the single visual-config file
- Vitest + Testing Library for units, Playwright for a real-browser playthrough
- No backend; everything bundled at build time; a seeded RNG so a game is reproducible
  from one number

> If you are an AI reading this and the listed stack is no longer the current standard at
> the time of reading, substitute the current standard. Preserve only the required
> mechanics and the two-file editable architecture, not the specific framework versions.

## Required mechanics (must all be present)

The game is not done until all of these are implemented and working:

1. **A grid plot, on three levels.** 5×5 by default — ground floor, first floor and roof.
   Cells are named by level, column letter and row number (`GA1`…`RE5`), and the player
   sees `A1` with the level named above the board. Show **one level at a time** with a
   switcher; stacking all three shrinks the cells past the point where a name fits, to
   show two levels that are empty for most of the game. The upper levels are the building
   only — they stop where the garden starts. Some ground-floor cells start occupied by the
   inherited building.

2. **Fixed points.** Two inherited cells can never be built on and can never be removed. In
   the reference they are the front door and the stair. Everything else is decided around
   them. The cell directly above the stair is an inherited **landing**, also permanent —
   it is what gives the first floor somewhere to begin, so that the frontier rule (7) works
   upstairs with no special case at all. Derive it rather than writing it in content.

3. **Named inherited cells.** The other inherited cells are ordinary, demolishable cells,
   and each has its own name — *Old scullery*, not *Inherited*. This matters: playtesting
   found that a cell labelled with its provenance reads as scenery and players never work
   out it can be built on. Render every occupied cell the same way — its name at the top,
   same face, same size — and add a small, quiet *inherited* label underneath.

4. **Eight rounds, three plans each.** Deal two from the round's tier and one from anywhere
   left in the pool, then shuffle the three so the free card is not always in the same
   place. **Unchosen plans return to the pool** and can be dealt again; only a plan the
   player actually places leaves it.

5. **A tier schedule.** Four tiers across the rounds, so the building goes up roughly in
   the order a building does: the way in, then daily life, then private rooms, then
   outside. Plus a `wildcard` pool that can appear in any round. The free third card is
   what stops the game feeling on rails.

6. **Placement is permanent.** No undo, no move, no drag-to-reposition. This is the point
   of the game, not a limitation of it.

7. **The frontier rule.** A placement must be orthogonally adjacent to something already
   standing. The building grows outward from itself. (Cells holding inherited rooms are the
   exception — always legal, so demolition is never locked away behind building up to it.)

8. **Where a plan goes.** Every plan carries a `where`, and each value is exactly one
   legality rule, composed with the frontier rule:

   | `where` | Legal cells |
   |---|---|
   | `house` | ground floor, upper rows, touching what is standing |
   | `garden` | ground floor, lower rows, touching what is standing |
   | `upstairs` | first floor, **over a cell that holds a room**, touching what is standing up there |
   | `roof` | on top of the building, at whatever height that turns out to be |

   No plan belongs in two places. Selecting a plan lights only the cells it can legally go
   in **and moves the board to that level**, or a player who picks a bedroom sees an empty
   ground floor and reads the rule as the game refusing to work.

   Two consequences to get right. **The roof is playable from round one**, because the
   inherited building already has one — which is also why a hand of roof plans can never
   be unplaceable. And **roofing a cell commits it**: once something stands on the roof at
   a column and row, the first floor beneath it can never be built. That is a second
   irreversible move, so the rules card has to say so.

   The roof deliberately does *not* use the frontier rule. What a roof cell touches is the
   thing underneath it, which is already joined to the building by the rules that let it be
   built.

9. **Demolition, and the one confirmation.** Placing onto an inherited room takes it down,
   permanently. This is the **only** confirmation in the entire game, precisely because it
   is the only irreversible move. It states what will happen and gets out of the way — it
   does not warn and it does not argue. Escape backs out.

10. **One line per placement, maximum.** After a placement, check the orthogonal
    neighbours and resolve in a strict order:
    1. **Explicit pair** — a line written for this exact pairing. More specific writing
       beats less: naming both plans beats naming the old building, which beats a wildcard.
    2. **Quality match** — something one emits meeting something the other is sensitive
       to. Both directions count. Strongest wins, ranked by a list that lives in content.
    3. **Orientation** — nothing next door, but the row it landed in faces somewhere.
    4. **Nothing.** Silence is a valid result and must not be treated as a failure.

11. **The line must show its cause.** Print what caused it above it (*"Utility room beside
    Living room"*) and light the placed cell and the neighbours involved while it is on
    screen, dimming the rest of the plot. Without this the sentence reads as atmosphere
    rather than as a consequence of the move just made — this was the single clearest
    playtest finding.

12. **Consent flags.** Every plan carries one of four: `permitted`, `householder`,
    `sensitive`, `demolition`. They are **flags, never outcomes** — nothing is ever
    refused, nothing is blocked, and nothing is a warning. Show the plan's own flag on the
    card in hand; compute the real one from where it actually landed.

13. **A report, and its exact budget.** When the last plan lands:
    - **Exactly three** benefit/obligation pairs — not all eight. Pick the three that ask
      the most, ranked by cost plus the heaviest consent flag taken on, ties to the later
      placement. Print what you gain **beside** what it will ask of you, so neither is
      readable without the other. On narrow screens they stack, obligation directly under
      its benefit — never reordered away from it.
    - **One cost line, as a phrase with no digit in it.** *The kind of project you
      remortgage for.*
    - **At most two obligations**, heaviest first, deduplicated — three applications are
      one ongoing relationship with the authority, not three.
    - **One closing line** about the building as a whole.
    - **The situation, answered.**

    Three and two is a cut, and it is deliberate: the earlier version printed everything
    and playtested as *"too complicate and too long."*

14. **One situation per game**, drawn from six by the same seed as the deck. It is shown
    before round one and answered at the very end, and it is the only thing the finished
    building is judged against. Write the answer for when the player missed — *"There is
    still no kitchen"* is a better ending than a congratulation.

15. **A rules card**, shown before round one and **reopenable at any point during play**
    from the header. A no-fail game has no failure to teach through, so it has to say what
    it is. Playtesters who could not look the rules up did not learn them.

16. **No score, no failure, no totals.** Nothing is counted, ranked or graded. There is no
    unplaceable hand and no dead end. The first quantity of any kind the player sees is the
    report.

## Two-file customization (this is the key design)

All player-facing text in **one** file; all visuals in **one** file. This is the
load-bearing architectural choice — it splits the project into a clean engine and an
editable surface, so a writer can re-skin the whole game without opening the engine.

### `src/content.ts` — everything anyone can read

One export per thing:

- `config` — round count, and one flag that changes the character of the whole game (in
  the reference: a conservation area, which makes demolition heavier and adds conditions)
- `plot` — the fixed cells, the demolishable cells (all named, all on the ground floor),
  and where the garden rows start
- `deck` — 24 plans, each with `id`, `name`, `tier`, `where`, `cost`, `consent`, `emits[]`,
  `sensitive[]`, optional `orientation` per compass direction, and the two report lines
  `have` and `care`
- `situations` — 6, each a line plus a function that receives a read-only summary of the
  finished plot and returns one sentence
- `pairLines`, `qualityLines`, `qualitySeverity`, and the connecting words used to name a
  cause
- `premise`, `rules`, and every remaining interface string
- `costPhrases`, `closingLines`, and one obligation line and short label per consent flag

### `src/theme.css` — everything anyone can see

Every colour, fill, font, size, spacing step and reading measure as a `:root` custom
property. **No component stylesheet may hard-code a colour or a size.** (CSS cannot read a
custom property inside a media query, so breakpoints are the one documented exception.)

### The boundary that makes it real

Engine code — the grid, the draw, the adjacency resolution, consent, the report — **must
not import the content file.** It imports the type definitions only, and content is passed
in as an argument. Without this, "you only need to change two files" is a claim rather than
a fact, and it quietly stops being true the first time someone reaches for a plan id.

## Validation script

Ship a script that exits non-zero with a readable message when the content has been changed
into something that cannot be played. At minimum it should catch:

- A plan missing a required field, or with an unknown tier / cost / quality / consent flag
- Duplicate ids
- A tier with fewer plans than the draw takes from it, or a `where` with no plans at all
- An unnamed inherited cell, or one above the ground floor
- A plot that is not one connected building, or one that does not touch the garden rows
- A pair line naming a plan that is not in the deck
- A quality that can fire but has no line written for it
- A cost phrase containing a digit
- No unconditional closing line, so some finished buildings would end in silence
- **Engine code importing the content file** — the boundary above
- **A sentence hard-coded into a component** where a fork cannot reach it

The last two are what make the fork surface real. A validator that only checks the content
files is checking the easy half.

## Starter content

Seed the content file with:

- The agreed building and premise
- A plot with two permanent cells and at least 4 named demolishable ones
- **24 plans** across 4 tiers plus a wildcard pool, at least 3 per tier, and at least one
  plan for every `where`
- **6 situations**, each with an answer written for the case where the player missed
- **At least 8 pair lines** and one line per quality that can fire
- Closing lines including at least one with no conditions on it
- The rules card, and every interface string

## Aesthetic (default theme)

Flat coloured blocks on a grid. **No floor plan** — no wall thicknesses, no doors drawn, no
furniture, no scale bar. Blocks keep it about relationships, which is the useful part. A
warm paper background, muted earth and green tones, one colour per tier, a serif for prose
and a sans for interface furniture. The whole game is text and coloured rectangles: no
images, no icons, no illustration.

## Done definition

- The dev server opens a playable game
- Every required mechanic is observable in a single playthrough
- A garden plan cannot be placed in the house; an upstairs plan lights only first-floor
  cells that sit over a room; the fixed cells never highlight
- Demolishing asks exactly once, and nothing else in the game asks anything
- At least one adjacency line fires, names its cause, and lights its cells
- The report shows three pairs, one cost phrase, at most two obligations, a closing line
  and the situation answered
- The validation script passes, and fails when you deliberately break the content
- Editing the content or theme file and saving hot-reloads the running game

## Confirmation before you build

Before writing code, present the following checklist to the user as your reply and **wait
for confirmation or changes**:

```
Here's the game I'll build. Tell me which to change.

- Building: <a house, or the user-requested theme>
- Premise: <why it has to change — one sentence>
- Grid: 5×5 on three levels — house rows 1–3, garden rows 4–5, first floor and roof above
- The fixed cells: <front door at GC1 and stair at GB1, or your equivalents> — never
  placeable, never removable, plus the derived landing above the stair
- Inherited rooms: <4 named, demolishable>
- Rounds: 8, three plans dealt each, two from the round's tier
- Deck: 24 plans across 4 tiers + wildcards
- Situations: 6, one drawn per game, answered at the end
- Stack I plan to use: <state your stack>
- Two-file architecture: content file (text) + theme file (visuals), engine imports
  neither — confirm
- Required mechanics I will implement:
  - Permanent placement, no undo
  - Frontier rule, the four `where` rules, and the roof committing the cell beneath it
  - Demolition with the single confirmation
  - Resolution ladder: pair → quality → orientation → silence
  - The line names its cause and lights its cells
  - Consent flags that never refuse anything
  - Report: 3 pairs, 1 cost phrase, ≤2 obligations, closing line, situation answered
  - Rules card, reopenable during play
  - No score, no failure, no totals before the report
- Aesthetic: <state your visual direction>

Confirm or tell me what to change before I start.
```

Only proceed when the user confirms.

---

Structural reference (if your builder can browse repos):
https://github.com/PlayableStories/building-on-game
````

---

## Platform notes

**Nobody has run this prompt yet.** The table below is the shape for findings, not
findings. If you test it on a builder, fill your row in and open a PR — that is exactly how
[boardroom-game's table](https://github.com/PlayableStories/boardroom-game/blob/main/REFERENCE_PROMPT.md#platform-notes)
got written.

That table is the nearest thing to evidence we have, and it is for a different game: a
swipe-card game with no grid and a much smaller state space. Treat it as a hint about each
builder's habits — stack defaults, roughly how much content they generate, whether they
respect a prescribed file architecture — and not as a prediction about this prompt. This
game asks for more that a builder can quietly skip: the strict resolution order, silence
as a valid result, the report's exact budget, and the engine/content boundary.

| Builder | First tested | What we observed | Suggested approach |
|---|---|---|---|
| Replit Agent | — | Not yet tested for this prompt | Paste the prompt verbatim |
| Bolt.new | — | Not yet tested for this prompt | Paste the prompt verbatim |
| v0.app | — | Not yet tested for this prompt | Use the confirmation step to push back on stack and file-architecture choices |
| Lovable.dev | — | Not yet tested for this prompt | As with v0 |
| Cursor / Claude Code | — | Not yet tested for this prompt | Paste the prompt and let them clone the reference repo as well |

## After generation

Once your builder produces a playable game, sanity-check it:

1. Walk through the AI's pre-build confirmation reply and make sure every required
   mechanic is on its list. If something's missing, say so before it starts.
2. Run the validation script and confirm it passes. Then break the content on purpose — an
   unknown quality, a pair line naming a plan that isn't there — and confirm it *fails*. A
   validator nobody has seen fail is not evidence of anything.
3. Play a full game. Check specifically for the things a builder is most likely to have
   quietly dropped:
   - Does a placement ever produce **no** line at all? (Silence must be allowed.)
   - Does a line ever fire that names **two** things, with both cells lit?
   - Does the report show **exactly three** pairs, not all eight?
   - Is there a number anywhere before the report?
   - Can a garden plan be placed in the house? Can an upstairs plan land on a cell with
     nothing under it? Can a roofed cell still be built on from the first floor?
4. Try to demolish something. Confirm it asks once, and that nothing else in the game does.
5. Edit a colour in the theme file and a line in the content file; confirm both hot-reload.
6. Grep the engine for an import of the content file. If it's there, the two-file
   architecture is decorative and will not survive a re-skin.

If any of these fail, paste the failure back into the same chat with your builder — they
usually fix it in a follow-up turn.

---

## Improvements welcome

The prompt evolves as we learn what builders do well and where they stumble. If you tested
it on a builder not in the table, or discovered a refinement that landed reliably, open a
PR.

Issues and PRs welcome at the upstream repo:
<https://github.com/PlayableStories/building-on-game>.
