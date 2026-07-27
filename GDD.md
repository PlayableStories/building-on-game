# Building On — Prototype GDD

> This is the prototype Game Design Document, written before the build. The README
> will be the quick-start; this file is the fuller design reference. Decisions still
> to be settled are marked **[Open]**. Where a choice needs its reasoning recorded,
> it is marked **[Design note]**.

## 1. Project Summary

**Building On** is a short, no-fail placement game about renovating a house you
inherited.

The player is given a bounded plot with an old house already standing on part of it,
and a front door they did not choose. Each round they are offered **three plans** and
place **one** of them anywhere touching what has already been built. The hand is not
kept — a fresh three are drawn each round, weighted towards the stage of the house
being built.

Nothing can be moved once placed. Nothing is forbidden. But every plan sits next to
other plans, and neighbouring things affect each other: the heat pump next to the
bedroom, the vegetable garden next to the kitchen, the glass roof facing north. Each
placement surfaces one short written observation about what has just been put next
to what.

After a fixed number of rounds the house is finished and reports back — not with a
score, but with what the player will have, what it cost, what they will now look
after, and what the people living there make of it.

This prototype exists to test whether **placement adjacency alone** can carry meaning
without a score, a fail state, or a floor plan.

## 2. Premise

> Someone left you a house.

The player has **inherited an old house** and is renovating it into a home for the
people who will live there now. The building is not a site to be cleared — it is
somebody's house, and it is now the player's.

Three things follow from this, and all three are load-bearing:

- **The front door was chosen by someone else.** So was the position of every wall
  the player keeps.
- **Demolition is not a budget decision.** It is the removal of part of a building a
  person lived in. The game never comments on this. It doesn't need to.
- **The house has things in it that nobody told you about.** See §11.

### Why now

One line, shown at the start, explaining why the work is happening at all:

> *The roof failed in February. You can't put it off any longer.*

**[Design note]** This justifies the eight rounds, the fixed door and the existing
fabric in a single sentence. The player is not building a dream house — they are
responding to something. That framing keeps the game modest, which is what makes the
end report land.

**[Open]** Alternative openings to test: *Your mother is moving in next spring.* /
*You both work from home now, and there is one desk.* / *The lease on the flat ends
in August.* Each changes what the player prioritises without changing a rule.

### The household

Before the first round, the player is shown **who this house is for** — two or three
people, one sentence each.

| Person | Line |
|---|---|
| You | "You work from home three days a week and have never had a door to close." |
| Your daughter, 14 | "She plays drums. She has been promised this will be better than the flat." |
| Your mother | "Moving in next spring. She manages one flight of stairs on a good day." |

The household is never scored and never mentioned again during play. It reappears
only in the report (§10.4), where **each person says one line about the finished
house**.

**[Design note]** This is the motivation the game needs and the only one it can
afford. The player now has someone to satisfy, and the game never measures whether
they did — which is exactly the tension a no-fail game is missing without it.

**[Design note]** It is also the cleanest replay driver in the design. Same deck,
different household, entirely different house. A player who builds for a drummer and
then rebuilds for someone who works nights learns the whole point without being told
it.

## 3. Core Concept

In most building games, a house is a list of rooms you can afford.

In **Building On**, a house is what ended up next to what.

The player chooses rooms, but not the consequences of where they go. The kitchen is a
kitchen; a kitchen beside the garden is a different life from a kitchen beside the
street. The game never blocks a choice and never scores it. It simply describes, one
placement at a time, the house that is accumulating.

> A home isn't a list of rooms. It's what ended up next to what.

The second claim, which arrives only at the end:

> Everything you build, you agree to look after.

## 4. Prototype Scope

**Includes:** a 5×5 plot · four cells of inherited fabric · a fixed front door · a
household of 2–3 people · 8 rounds · a hand of 3 drawn per round · tier-weighted draw ·
orthogonal adjacency placement · demolition onto inherited fabric · a written
observation on each placement · orientation effects (street/garden, north/south) ·
consent flags · a four-part end report.

**Does not include:** costs shown during play · any score or points · removal or
relocation of placed plans · multiple storeys · plans larger than one cell · budgets
the player manages · save/load · multiple plots · a conservation-area variant as a
separate mode (it is a config flag, see §9).

**Staged, not cut:** the discovery system (§11) is fully specified but marked
optional for the first build.

## 5. The Plot

### Grid

A **5×5 grid**, columns A–E, rows 1–5. Every plan occupies exactly one cell.

**[Design note]** One cell per plan is a deliberate simplification. Variable room
footprints would make this a spatial puzzle, and a spatial puzzle is a different game
— the player would optimise packing instead of thinking about neighbours.

### Orientation

Orientation is fixed and always visible:

| Edge | Is | Means |
|---|---|---|
| Row 1 (north) | The street | Footfall, noise, arrival, the public face |
| Row 5 (south) | The garden | Sun, quiet, growing, the private back |
| Columns A / E | Neighbouring plots | Party walls, overlooking |

Sun comes from the south. A glass roof in row 4 or 5 is bright; the same plan in row
1 or 2 is a cold room with a big window onto the pavement.

**[Design note]** Orientation is one extra rule and it roughly doubles how much
placement matters. Without it, only *which cards* the player picked would matter, and
the game would be a quiz.

### The inherited house

The plot starts with the house already on it, occupying **B2, C2, B3, C3**.

- **B2** carries the **front door**, opening north onto the street.
- The fabric is old: solid walls, small windows, a chimney on C2.
- Fabric cells are marked visually as *inherited* — a different fill from anything
  the player places.

The player never chooses the front door. It is the one thing about the house that was
decided before they arrived, by someone who isn't there to ask.

## 6. Rounds and the Hand

### Rounds

**8 rounds. 8 placements.** The game ends when the eighth plan is placed.

**[Open]** Six was the original figure. Eight gives two placements per tier, which is
where adjacency starts firing often enough to be the point. Build the round count as
a config value and playtest 6 and 8 before deciding.

### Tiers

The deck is staged, so the house is built roughly in the order a house is built.

| Tier | Rounds | Contains |
|---|---|---|
| **Threshold** | 1–2 | Porch, hall, boot room, downstairs WC, bin store |
| **Daily** | 3–4 | Kitchen, living room, dining room, utility, glass-roofed extension |
| **Private** | 5–6 | Bedroom, bathroom, study, gym, spare room |
| **Outside** | 7–8 | Vegetable garden, terrace, shed, lawn, home farm |

### The draw rule

Each round the player is dealt **three plans: two from the current tier, one from any
tier.**

The hand does not carry over. A plan passed over is gone.

**[Design note]** The wildcard is what stops the game feeling on-rails. It also lets
system plans (§8.3) and the garden turn up early, where they are tempting and awkward
— which is exactly when they are interesting.

**[Design note]** Because the hand is fresh each round, the tension is not *should I
hold this* but *this tier will not come back*. Spend the daily round on a utility room
and the kitchen never returns. That matches how real briefs work: the daily rooms get
decided once and everything else arranges itself around them.

## 7. Placement Rules

1. A plan may be placed on any **empty cell orthogonally adjacent** to an occupied
   cell (inherited fabric counts as occupied).
2. A plan may also be placed **on a fabric cell**, which **demolishes** it. This is
   the only destructive move in the game.
3. Placed plans can never be moved or removed.
4. No adjacency is forbidden. Any legal cell is a legal choice.

### Demolition

Demolition is the one irreversible decision the game asks for, and the only one that
is genuinely hard.

- Keeping the old fabric is cheap, slow and awkward — small windows, thick walls,
  rooms the wrong shape.
- Demolishing gets the room the player actually wants, and costs the most money, the
  most consent, and the embodied carbon of a building that already existed.
- Demolishing **B2** removes the front door. The house then needs a new entrance, and
  every subsequent placement is read against that.

**[Design note]** Everything else in this game is additive and forgiving. This move is
not, because in real building it is not — and because it is a house someone left the
player, the weight arrives without the game having to argue for it.

## 8. The Deck

### 8.1 Size

**16–18 plans.** Enough that two playthroughs differ; few enough that the writing
stays good and the hand is readable at a glance.

### 8.2 Plan schema

| Field | Purpose |
|---|---|
| `id`, `name` | Identity |
| `tier` | Which rounds it is likely to appear in |
| `emits` | Qualities it puts into its neighbours |
| `sensitive` | Qualities it suffers from |
| `orientation` | Optional — how it behaves in north vs south rows |
| `consent` | Planning flag (see §9) |
| `have`, `cost`, `care` | One line each, for the end report |

### 8.3 Six worked plans

The remainder of the deck is stubbed (§8.4). These six are specified in full as the
pattern to follow.

---

**Boot room** · *Threshold*

- `emits`: damp, clutter
- `sensitive`: —
- `consent`: permitted
- `have`: "Wet coats and muddy boots stop at the door."
- `cost`: low
- `care`: "It only works if you keep it emptied. Most people don't."

---

**Kitchen** · *Daily*

- `emits`: heat, smell, footfall
- `sensitive`: damp, noise
- `orientation`: south — "It will be warm in the afternoon, and you will eat there."
- `consent`: permitted
- `have`: "The room everyone ends up in, whatever you intended."
- `cost`: high
- `care`: "Extraction, drains, and the slow replacement of everything in it."

---

**Glass-roofed extension** · *Daily*

- `emits`: light, heat
- `sensitive`: —
- `orientation`:
  - south — "Light all afternoon. Unusable in July without shade you haven't drawn yet."
  - north — "The light is even and cold. You will heat this room more than any other."
- `consent`: householder application
- `have`: "A bright room that changes with the weather."
- `cost`: high
- `care`: "Glass to clean, blinds to fit, and a room that is never quite the right temperature."

---

**Study** · *Private*

- `emits`: —
- `sensitive`: noise, footfall, smell
- `consent`: permitted
- `have`: "A door you can close on the rest of the house."
- `cost`: low
- `care`: "Only stays a study if the household agrees it is one."

---

**Air-source heat pump** · *Wildcard — any tier*

- `emits`: noise (low, constant)
- `sensitive`: —
- `consent`: permitted, unless conservation (see §9)
- `have`: "Heat without a gas bill, and a house that runs warm and slow."
- `cost`: high up front, low after
- `care`: "An annual service, radiators sized for it, and a hum you stop hearing after a month."

---

**Home farm** · *Outside*

- `emits`: smell, work
- `sensitive`: shade
- `orientation`: north — "Too little sun. It will be a hobby rather than a crop."
- `consent`: permitted
- `have`: "Food you grew, and a reason to be outside every day."
- `cost`: very low
- `care`: "Twenty minutes a day, every day, forever. This is the largest commitment on the plot."

---

### 8.4 Remaining deck (stubbed)

*Threshold:* porch · hall · downstairs WC · bin store
*Daily:* living room · dining room · utility room
*Private:* bedroom · bathroom · gym · spare room
*Outside:* terrace · shed · lawn
*Wildcards:* solar array · internal wall insulation · air conditioning unit

Each needs the same seven fields. The system plans are deliberately in the wildcard
pool rather than a tier of their own — see §8.7.

### 8.5 The quality vocabulary

Nine qualities, kept small on purpose so participants can hold them in their head:

`heat` · `damp` · `noise` · `smell` · `light` · `work` · `quiet` · `footfall` · `shade`

### 8.6 How a line is chosen

When a plan is placed, the game checks each orthogonal neighbour and resolves in this
order:

1. **Explicit pair** — a written line for this exact pair of plans. Best writing, used
   for the handful of pairs that deserve it.
2. **Quality match** — an emitted quality meeting a neighbour sensitive to it, with a
   generic line for that quality pair.
3. **Orientation** — the plan's row triggers its orientation line.
4. **Nothing** — silence is a valid result. Not every placement needs a comment.

**One line per placement, maximum.** If several fire, the explicit pair wins, then the
strongest quality match, then orientation.

**[Design note]** This is the Memory of Home fragment mechanic doing the same job: a
short piece of writing as the payoff for a mechanical event. It keeps the storytelling
in the content file, where a participant can rewrite all of it without opening engine
code.

### 8.7 Systems as plans

Heat pumps, solar, insulation and air conditioning are ordinary plans occupying
ordinary cells. They are not a separate card type attached to the house.

**[Design note]** One rule is worth a great deal in a workshop sample, and this one
happens to be physically true: a heat pump needs somewhere to stand, and it makes
noise. Making systems into a second subsystem would double the engine and halve the
remixability.

| Placement | Line |
|---|---|
| Heat pump beside a bedroom | "Quiet enough now. Less so at five in the morning in January." |
| Heat pump beside the terrace | "The one place you sit outside is the one place that hums." |
| Air conditioning beside anything | "Cool this summer, and every summer after, at a price that rises." |
| Insulation against original solid walls | "Warmer. And a damp risk you will be managing for a decade." |
| Solar on a north row | "A lovely gesture. Very little electricity." |
| Home farm beside the kitchen | "A short walk with wet hands. This is the version that gets used." |
| Home farm beside a bedroom | "Compost, and something starting at six in the morning." |

The insulation and solar lines are where preservation and decarbonisation genuinely
conflict. The game states what happens and does not editorialise.

## 9. Consent and Preservation

### 9.1 Flags, not outcomes

Consent never succeeds or fails. There is no roll.

| Flag | Meaning |
|---|---|
| `permitted` | Permitted development. No application. |
| `householder` | A householder application. Weeks, a fee, a neighbour consultation. |
| `sensitive` | Likely to attract a condition or a request to change. |
| `demolition` | A heavier process, and a longer one. |

**[Design note]** A consent dice roll at the end would turn a reflective game into a
gamble and undo the no-fail framing. Flags are honest and they accumulate into an
obligation rather than a verdict.

### 9.2 Preservation

A single config flag, `conservation: true`, changes the character of the whole game
without touching the engine:

- New openings in the north (street) elevation become `sensitive`
- The heat pump's outdoor unit becomes `householder`
- Demolition of any fabric cell becomes `sensitive` and gains a much longer `care` line
- The glass-roofed extension gains a line about ridge height

Same deck, different house, different obligations. A participant learns why by playing
twice.

### 9.3 Where consent lands

Consent appears in the report inside **what you'll look after**, not as a separate
section.

**[Design note]** Planning is not a cost paid once. It is a relationship the household
now has with the local authority, and it belongs with the other ongoing obligations.

## 10. The Report

### 10.1 No running totals

Nothing is totalled or displayed during play — no cost, no score, no counter. The only
feedback during a round is the adjacency line.

**[Design note]** The moment a cost counter is visible, the player optimises, and the
conversation is lost to arithmetic. This matters most in the intended use — an
architect sitting with a client — but it is the right call for the workshop sample too.

### 10.2 The three columns

Shown all at once when the eighth plan lands, in this order:

1. **What you'll have** — the `have` lines, in placement order. The pleasures, plainly.
2. **What it cost** — the `cost` bands aggregated into a rough description, never a
   number. *Modest* / *Substantial* / *The kind of project you remortgage for.*
3. **What you'll look after** — the `care` lines, plus every consent obligation, plus
   any demolition. **The longest column, deliberately.**

**[Design note]** Cost and benefit are what an estate agent tells you. Responsibility
is the thing nobody mentions, and it is the reason this game is worth making.

### 10.3 The closing line

One sentence naming what kind of house it turned out to be. Derived from the dominant
qualities across the plot, not from a score.

> A house that asks a lot of you in spring.

> A quiet house that will be cold in five years.

> You kept almost all of it, and it will keep asking you for things.

> There is very little of the old house left. It is warm, and it is yours.

### 10.4 What the household says

Below the columns, **each person from §2 says one line** about the finished house.

- The drummer, on where her room ended up relative to everyone else's.
- Your mother, on the distance from the front door to the bathroom.
- You, on whether you got the door you can close.

These are reactions, not verdicts. Nobody says the house is good or bad. They say what
it will be like to live in it.

**[Design note]** This is where the motivation set up in §2 is paid off. It is also
the moment the game is at its most useful in the architect-and-client use: three
people responding to a plan is a conversation, where a score would have been an
argument.

## 11. Discovery — What the House Was Hiding

**[Open — specified, optional for the first build]**

A small table of **conditions** attached to specific fabric cells, revealed when a
placement touches or demolishes that cell. Some are gifts. Some are obligations. All
of them are things the player now has.

| Trigger | Reveal |
|---|---|
| Anything placed adjacent to C2 (the chimney) | "There is a fireplace behind the plasterboard. It has been bricked up since before you were born." |
| Demolishing B3 | "The joists are gone at the back. This was always going to be found." |
| Anything placed south of C3 | "There is a well under the garden. It is on no drawing you have." |
| Anything adjacent to B2 (the door) | "The original tiles are under the lino, and mostly intact." |

A reveal fires **once**, in place of that placement's adjacency line, and adds a line
to the report — to `have` if it is a gift, to `care` if it is an obligation.

**[Design note]** Discovery is the strongest motivator in the reference game
(*Blue Prince*) and it costs very little here: a lookup table and one trigger. It is
also the mechanic that most rewards the inheritance premise — the house had a life
before the player, and the game lets them find some of it.

**[Design note]** Marked optional because it is the only part of the design that needs
real engine work beyond the core loop. Decide after the first playtest.

## 12. Visual Direction

Flat coloured cells on a grid. An icon and a name per plan. Inherited fabric in a
distinct muted fill with a visible edge. The street edge and garden edge labelled. Sun
direction indicated once, simply.

**No floor plan.** No wall thicknesses, no doors drawn, no furniture, no scale bar.

**[Design note]** The moment it looks like a floor plan, a client critiques it as a
floor plan and the conversation goes to millimetres. Blocks keep it about
relationships, which is the useful part — the same reason architects show massing
before renders.

Placeholder art only for the prototype: procedural shapes and colour, no image assets.

## 13. Interaction

Mouse and touch first. Click a plan in the hand to select it, click a legal cell to
place it. Legal cells highlight on selection. The adjacency line appears as a short
overlay or inline caption and is dismissed by clicking, **Space**, or **Enter**.

A demolition placement asks for one confirmation. It is the only confirmation in the
game.

## 14. Interface Elements

Title · the "why now" line and the household, shown once before round 1 · the 5×5 plot
with orientation labels · the hand of three · round indicator (*3 of 8*) · consent flag
on each plan in hand · adjacency line overlay · the end report · a **Build again**
button.

No cost display. No score. No timer.

## 15. Win Condition

There is no win condition, no fail state, no score and no timer. The game ends when the
eighth plan is placed. Every house that gets built is a finished house.

*The game is about what you agree to live with, not what you achieve.*

## 16. Fork Surface

This is a workshop sample, so remixability is a design requirement rather than a nicety.

### Two files

- **`content.ts`** — the household, the "why now" line, the deck, the qualities, every
  adjacency line, all consent flags, the discovery table, the report copy, the closing
  lines. Everything a participant would change.
- **`theme.css`** — every colour, fill, font and spacing value.

The engine — grid, hand, tier-weighted draw, adjacency lookup, report assembly — should
never need opening.

**The test:** a participant swapping the deck for a community centre, a co-op office, a
high street or a hospice garden should never open a file that isn't one of those two.

### The remix dials

- **Rung 1 (reskin):** swap the deck and the household. Same engine, different building,
  different people.
- **Rung 2 (remix):** change what the third column *is*. Replace *what you'll look after*
  with *who this excludes*, or *what this costs the street*, and the game makes a
  completely different argument with identical code.

A `validate` script checks the deck: every quality referenced exists, every plan has all
seven fields, every tier has enough plans to fill a hand, every consent flag is one of
the four, and every discovery trigger names a real cell.

## 17. Design Questions to Test

1. Is "place it next to something, you can't move it" understood without explanation?
2. Does the household create pressure, or does it get forgotten by round three?
3. Does the tier progression feel like building a house, or like being led?
4. Is one wildcard in three the right amount of disruption?
5. Do adjacency lines land as observations, or do players read them as scores?
6. Is 8 rounds right? Does 6 leave adjacency underfired?
7. Does anyone demolish? If nobody does, the cost is set too high — or the inherited
   fabric isn't in the way enough.
8. Does the inheritance premise change how people treat the old fabric, compared to a
   plot they were told they bought?
9. Does the orientation rule get noticed, or does it need to be more visible?
10. Does **what you'll look after** land as the point, or as an afterthought?
11. Do the household's closing lines feel like reactions or like judgements?
12. Two playthroughs — does the second one feel meaningfully different?

## 18. Development Priorities

1. **Core loop** — grid, inherited fabric, hand of three, tier-weighted draw,
   adjacency-legal placement, 8 rounds, end.
2. **Framing** — the "why now" line and the household, shown once before round 1.
3. **Adjacency lines** — the resolution order in §8.6, the overlay, the six worked plans
   as seed content.
4. **The report** — three columns, aggregation, the closing line, the household lines.
5. **Demolition and consent** — the fabric-cell placement path, the flags, the
   conservation config.
6. **Fork surface** — the two-file split and the `validate` script.
7. **Discovery (§11)** — only if the first playtest says the core loop holds.
8. **Polish** — placement animation, orientation indicator, responsive layout, touch
   targets.

## 19. One-Sentence Description

**Building On** is an 8-round placement game in which the player renovates a house they
inherited, choosing one of three plans each round and never being able to move it again
— discovering, one neighbour at a time, that a home is not a list of rooms but a set of
things they have agreed to look after.
