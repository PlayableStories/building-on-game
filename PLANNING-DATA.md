# What London actually applies for

The game's consent flags (GDD §9.1) were written from judgement. This document is the
evidence they should answer to.

**Source.** Planning applications collected at the [House London Data
Hackathon](https://luma.com/160gn1gj), 1 August 2026. One SQLite table, one row per
application, the interesting fields inside a JSON `payload`. The file is 1.4 GB and is not
in this repository. The queries are, and so are their results:

| | |
|---|---|
| [`data/planning/queries.sql`](data/planning/queries.sql) | Every query, with its reasoning |
| `data/planning/*.csv` | What they returned, a few KB in total |
| `npm run planning-data -- <path to housing_planning.sqlite>` | Regenerates the CSVs |

Every figure below appears in one of those CSVs. Nothing here is remembered or rounded by
hand. Figures generated 3 August 2026.

## Coverage

**343,141 applications · 33 London boroughs · February 2016 – March 2026.**
89% are classified "Small" — householder-scale work, which is exactly the deck's subject.

**308,015 of them reached a decision.** Withdrawn (16,849) and undecided (15,554) are
excluded from every rate below: an application nobody ruled on is not evidence of how
rulings go.

## Two things this data cannot tell you

Stated first, because they bound everything after.

1. **It only contains applications that were submitted.** It can never establish the base
   rate of work that genuinely needed no permission, so it can never prove a `permitted`
   flag right — only reveal that people are applying anyway.
2. **Categories are matched on description text**, and one description routinely says
   *"demolition of garage and erection of a single storey rear extension with rear
   dormer"*. The counts therefore overlap and do not sum to the total. Each row answers
   only: of the applications that mention this, how did they go?

A third caveat retired itself: the export carries a `relates_to_hi` classifier flag, but it
fires on only 2,259 rows and on inspection selects condition-discharge applications rather
than housing work. It is unused here.

---

## The headline

| | Count | Share |
|---|---|---|
| **Approved** | 246,423 | **80.0%** |
| — clean permission | 172,576 | 56.0% |
| — **approved with conditions** | 73,847 | **24.0%** |
| **Refused** | 61,592 | **20.0%** |

A deterministic 6.5% sample (20,070 rows) returns 24.1% / 20.0%, so the sample and the full
table agree and neither is an artefact of the other.

**The number that matters to the game is 24.0%.** A quarter of all decisions are approvals
that arrive carrying obligations. That is precisely what the `sensitive` flag —
*conditions likely* — describes, and it is the normal case rather than an unusual one.

## What can be submitted

Two answers, because the question has two.

**The short one: ten.** Planit normalises every application to one of nine types, plus a
blank. Source: `app_types.csv`.

| Type | Applications | Share |
|---|---|---|
| Full | 172,696 | 50.3% |
| Outline | 110,878 | 32.3% |
| Conditions | 35,426 | 10.3% |
| Amendment | 18,355 | 5.3% |
| (blank) | 2,903 | 0.8% |
| Heritage | 1,318 | 0.4% |
| Telecoms | 539 | 0.2% |
| Other | 531 | 0.2% |
| Trees | 374 | 0.1% |
| Advertising | 121 | 0.0% |

**The long one: 795**, which is what the 33 boroughs actually write on the form. In full in
`application_types.csv`. The 25 most common:

| Label | Applications |
|---|---|
| Householder Application | 38,310 |
| Full Planning Permission | 37,967 |
| Householder | 35,874 |
| Full Application | 12,945 |
| Approval of Details | 11,175 |
| Detailed Planning Application | 11,041 |
| Certificate of Lawfulness - Proposed | 8,417 |
| Proposed Lawful Development Certificate | 7,198 |
| Cert. Lawfulness Proposed | 6,396 |
| Prior Approval - Householders | 5,956 |
| Prior Notification (Householder) | 5,663 |
| Certificate of Lawful Development - Proposed | 5,293 |
| Cert of Lawful Use/Operation - Proposed | 5,220 |
| Householder Planning | 5,130 |
| Application for Full Permission | 5,114 |
| Section 192 Certificate - proposed | 4,941 |
| Prior Approval - Large householder | 4,753 |
| PA Householder Rear Extension | 4,751 |
| Section 192 Permitted Development | 4,265 |
| Details (following full perm.) | 4,019 |
| Prior Approval - Larger Home Extension | 3,756 |
| Certificate of Lawfulness Proposed Use | 3,739 |
| Lawful Development Certificate proposed | 3,604 |
| Non-Material Amendment | 3,562 |
| Certificate of Lawful Use proposed | 3,455 |

**795 is mostly spelling, not substance.** *Certificate of Lawfulness - Proposed*, *Cert.
Lawfulness Proposed*, *Certificate of Lawful Development - Proposed* and *Section 192
Certificate - proposed* are one thing written four ways by four councils. The distribution
says as much:

Source: `label_distribution.csv`.

| Label used | Count of labels |
|---|---|
| 1,000 or more times | 53 |
| 100 to 999 | 110 |
| 10 to 99 | 240 |
| fewer than 10 | 392 |
| — of which **exactly once** | **157** |

Fifty-three labels carry almost all the volume. That is why the analysis below groups them
into seven families (`routes.csv`) rather than treating 795 as 795 different things.

### None of this is a list of works

Worth stating plainly, because the 795 looks like an answer to "what can people build" and
is not. Source: `route_or_work.csv`.

| | Labels | Applications | |
|---|---|---|---|
| Procedure only | 645 | 317,986 | **93.7%** |
| Names a physical work | 150 | 21,245 | 6.3% |

`application_type` describes **how you ask and who is asking** — *Householder
Application*, *Approval of Details*, *Non-Material Amendment*, *Section 192 Certificate*.
Ninety-four percent of applications carry a label that names nothing anybody builds, and
the 6.3% that do are almost entirely one work: the large rear extension prior-approval
route.

So the deck cannot be checked against this list. What people build is only ever in the
free text, and the **descriptions are not enumerable at all** — 250,965 distinct strings
across 343,141 applications. That is why every category in this document is matched by
keyword rather than read off a field, and it is why the next section exists.

## What people ask for

Non-exclusive; see caveat 2. This is `categories.csv` in full.

| Kind | Decided | Conditions | Refused |
|---|---|---|---|
| Rear extension | 140,559 | 27.0% | 22.6% |
| Loft / dormer | 78,739 | 16.2% | 18.6% |
| Involves demolition | 60,869 | 28.4% | 16.2% |
| Roof extension | 47,810 | 24.1% | 18.2% |
| Rooflights | 47,481 | 15.7% | 16.9% |
| Windows | 41,940 | 20.8% | 18.0% |
| Side extension | 35,821 | **38.9%** | 20.1% |
| Loft conversion | 24,566 | **9.7%** | 18.8% |
| Hip to gable | 22,753 | **10.0%** | 17.8% |
| Change of use | 21,787 | 20.7% | **31.3%** |
| Garage | 21,463 | 29.2% | 22.3% |
| Basement | 16,939 | **37.2%** | 13.3% |
| Balcony | 14,570 | 17.2% | 17.9% |
| Porch | 10,570 | 30.1% | 21.7% |
| Outbuilding | 8,764 | 22.0% | 22.2% |
| Conservatory | 7,671 | 30.8% | 15.4% |
| Boundary wall / fence | 7,150 | **32.3%** | 17.2% |
| Bin store | 1,886 | 19.2% | 18.6% |
| Solar | 1,664 | 25.6% | 22.0% |
| Insulation | 947 | **32.0%** | 12.1% |
| Heat pump | 750 | **33.2%** | 13.2% |
| Garden room | 444 | 29.3% | 17.1% |

The single most common thing anyone does to a London house is **extend it backwards**, by
a wide margin.

---

## What London actually builds, and what the deck has

Mined from the descriptions of householder-scale decisions, since there is no field for it.
This is `works.csv` in full. Non-exclusive: one description names several works.

| Work | Decided | Conditions | Refused | In the deck as |
|---|---|---|---|---|
| Rear extension | 133,219 | 26.9% | 22.8% | every plain room |
| **Dormer** | **74,319** | 15.8% | 18.6% | — |
| **Rooflight / skylight** | **46,098** | 15.5% | 17.0% | — |
| **Roof extension** | **44,988** | 23.8% | 18.2% | — |
| **Windows** | **39,827** | 20.4% | 18.3% | — |
| Side extension | 33,393 | 39.8% | 20.0% | every plain room |
| Loft conversion | 23,675 | 9.4% | 18.7% | `study`, `gym` |
| **Hip to gable** | 22,087 | 9.8% | 17.8% | — |
| **Garage** | 19,491 | 30.0% | 23.1% | — |
| **Change of use** | 19,140 | 20.3% | **32.4%** | — |
| Landscaping | 15,273 | 24.4% | 14.8% | `lawn`, `vegetable-garden` |
| **Basement / cellar** | 12,275 | **39.5%** | 15.6% | — |
| **Balcony** | 11,659 | 13.8% | 18.0% | — |
| Porch | 9,784 | 31.2% | 22.1% | `porch` |
| Terrace / patio | 8,648 | 38.5% | 20.3% | `terrace` |
| Outbuilding | 8,165 | 22.3% | 22.7% | `shed` |
| Conservatory | 7,248 | 31.6% | 15.5% | `glass-extension` |
| Tree works | 5,047 | 31.0% | 16.7% | — |
| **Chimney** | 4,495 | 18.1% | 17.8% | — |
| Subdivide into flats | 2,205 | 30.1% | **40.6%** | — |
| Bike / cycle store | 1,940 | 25.9% | 30.1% | — |
| **Bay window** | 1,515 | **40.3%** | 22.0% | — |
| Solar | 1,464 | 25.5% | 23.4% | `solar-array` |
| Boundary wall / fence | 1,291 | 28.2% | 18.5% | — |
| Bin / refuse store | 1,159 | 15.3% | 27.6% | `bin-store` |
| Shopfront | 1,158 | 33.8% | 21.7% | — |
| Cladding / render | 1,087 | 24.6% | 22.3% | — |
| Gate | 1,057 | 36.0% | 15.3% | — |
| Decking | 826 | **40.2%** | 16.9% | — |
| Dropped kerb / crossover | 780 | 17.4% | 26.5% | — |
| New dwelling | 633 | 24.2% | 25.9% | — |
| Heat pump | 620 | 29.0% | 14.5% | `heat-pump` |
| Driveway / hardstanding | 605 | **39.5%** | 18.8% | — |
| Door alterations | 559 | 26.3% | 18.4% | — |
| Air conditioning | 450 | **43.3%** | 13.8% | `air-conditioning` |
| Garden room / office | 426 | 29.3% | 17.4% | `shed` |
| Annexe | 398 | 24.6% | 25.6% | — |
| Swimming pool | 377 | **41.9%** | 16.7% | — |
| EV charger | 239 | 21.8% | 14.6% | — |
| Summer house | 51 | 27.5% | 17.6% | — |

### The biggest gap was the roof — and this measurement is what closed it

Dormer, rooflight, roof extension and hip to gable are the **2nd, 3rd, 4th and 8th** most
common works in London — 187,492 mentions between them — and the deck represented none of
them. Nor windows, at 39,827.

This was recorded here as a fact about the board rather than a gap in the writing. The plot
was a five-by-five **plan view with no vertical dimension**: a dormer is not a cell, a
rooflight is not a cell, and a window is an elevation. Representing any of it meant a
second storey, which GDD §4 had ruled out of scope.

**M15 overturned that ruling, and this figure is why.** The board is now three levels —
ground, first and roof — with a `roof` placement rule and a roof that is playable from the
first round, because the house you inherited already has one. The 187,492 stopped being an
argument about writing and became an argument about the board, and the board lost. See
GDD §4 for the decision and §5 for the rules.

**M17 dealt the cards, and the gap is closed.** The deck now holds a dormer, a rooflight,
a roof extension, a hip-to-gable and a chimney, in a roof tier of their own on rounds 9 and
10 — plus a garage and a balcony, the other two big absences in the table above. Seven
cards, none of them from the GDD, all of them from this file:

| Card | Decided | Conditions | Flag | Why |
|---|---|---|---|---|
| Dormer | 74,319 | 15.8% | `householder` | Under the 24.0% baseline, but a front dormer is not permitted development |
| Rooflight | 46,098 | 15.5% | `permitted` | The lowest rate on the roof, and it does not change the outline |
| Roof extension | 44,988 | 23.8% | `householder` | Effectively the baseline exactly. The heaviest work and the least remarkable to a planner |
| Hip to gable | 22,087 | **9.8%** | `householder` | The lowest rate in the deck: the least argued-about way of gaining a real room |
| Garage | 19,491 | 30.0% | `householder` | Above the line, and read the same way the porch is at 31.2% |
| Balcony | 11,659 | 13.8% | `householder` | Well under, which is not what anyone expects. Overlooking is argued at refusal, not settled with a condition |
| Chimney | 4,495 | 18.1% | `householder` | The one roof work that is usually about putting something *back* |

`solar-array` sits on the roof too, from the wildcard pool, moved there from `indoor` —
which was a fudge the flat board forced.

That leaves **windows** (39,827) as the largest remaining absence, and it stays absent for
the reason it always did: a window is an elevation, and an elevation is still a different
game.

The same applies to change of use (19,140) and subdividing into flats (2,205), which are
not spatial at all — they are what a building is *for*, and the game has no vocabulary for
that.

### The deck is still a designed object

This section used to say the deck had been left alone deliberately, and the reasoning
holds even though seven cards have since been added. It is worth keeping both halves.

Several works would still fit the board and are still not in it — basement (12,275), bike
store, decking, driveway, annexe, swimming pool, EV charger. Some are among the most
conditioned things measured: swimming pool 41.9%, decking 40.2%, driveway 39.5%, basement
39.5%.

**The deck is a designed object, not a sample of London.** A card earns its place by being
a decision worth making next to another card, and *"it is common in the data"* is not that
argument on its own.

What changed with the roof cards is that it became half the argument. A dormer is a
decision worth making — it is the difference between a loft and a room, it commits the cell
under it forever, and it is the second commonest work in the city. The data did not make
the case by itself; it identified where the case was worth making, and the board had to
change before the case could be made at all. A swimming pool is common enough and is still
not a decision this game is about.

What the data is otherwise good for is checking the cards that *are* there, which is what
the rest of this document does.

Two cards deserve a note in the other direction:

- **`wall-insulation` appears once in 308,015 decisions**, and `lawn` and `home-farm` do
  not appear at all. That is not a defect — a lawn needs no permission, and that is exactly
  why the card is `permitted`. Absence from a planning record is evidence *for* those
  flags, not against the cards.
- **`home-farm` is not a planning matter in any form.** It is in the deck because of what
  it asks of you daily, which no planning authority has an opinion about. The right check
  for that card is a playtest, not a database.

## Card by card

The same measurement with the patterns tightened until each maps onto a plan in
`src/content.ts`. This is the table the flags answer to. Baseline for conditions is
**24.0%**. Source: `cards.csv`.

| Card | Real-world form | Decided | Conditions | Flag now | Verdict |
|---|---|---|---|---|---|
| `terrace` | roof terrace | 4,537 | **44.0%** | `permitted` | **wrong** |
| `air-conditioning` | air conditioning | 472 | **42.2%** | `sensitive` | confirmed |
| `heat-pump` | air source heat pump | 597 | **35.5%** | `permitted` | **wrong** |
| `terrace` | patio | 4,994 | **35.4%** | `permitted` | **wrong** |
| `glass-extension` | glazed extension | 121 | 34.7% | `sensitive` | confirmed |
| `glass-extension` | conservatory | 7,671 | 30.8% | `sensitive` | confirmed |
| `wall-insulation` | **external** wall insulation | 86 | 30.2% | — | see below |
| `porch` | porch | 10,570 | 30.1% | `permitted` | **wrong** |
| `shed` | garden room | 444 | 29.3% | `permitted` | borderline |
| householder rooms | rear extension | 140,559 | 27.0% | `householder` | confirmed |
| `solar-array` | solar panels | 1,369 | 26.4% | `permitted` | confirmed |
| `shed` | outbuilding | 8,764 | 22.0% | `permitted` | confirmed |
| `bin-store` | bin store | 1,886 | 19.2% | `permitted` | confirmed |
| `study` / `gym` | loft conversion | 24,566 | **9.7%** | `permitted` | confirmed, strongly |
| `wall-insulation` | **internal** wall insulation | **1** | — | `permitted` | confirmed, decisively |

**Internal wall insulation appears once in 308,015 decisions.** External wall insulation
appears 86 times, and is conditioned 30.2% of the time. The deck's instinct — that going
inwards asks nobody and going outwards asks everybody — turns out to be almost exactly
right, and it is the strongest single result in the set.

**A terrace is the most-conditioned thing a Londoner can build.** More than a conservatory,
more than an air conditioning unit. Overlooking is why, and the game currently calls it
*no application*.

## Demolition attracts obligations, not refusal

60,869 decided applications mention demolition:

| | Demolition | All decided |
|---|---|---|
| Refused | **16.2%** | 20.0% |
| Conditions | **28.4%** | 24.0% |

Demolition is refused **less** often than average and conditioned **more** often. The
game's treatment — one confirmation, then obligations that follow you into the report,
and never a refusal — is what the data describes. §9.1's "flags, never outcomes" survives
contact with the evidence.

## "No application" is not the same as "no paperwork"

Source: `routes.csv`.

| Route | Decided | Conditions | Refused |
|---|---|---|---|
| Householder application | 85,862 | 32.2% | 19.3% |
| Full planning permission | 73,023 | 43.5% | 23.7% |
| **Lawful development certificate** | **65,087** | 4.2% | **15.1%** |
| Prior approval / notification | 28,678 | 1.7% | **37.9%** |
| Listed building / conservation consent | 1,030 | 31.8% | 22.2% |

**21% of all decisions are lawful development certificates** — people paying to establish
that they do *not* need permission. And **15.1% of them are refused**: told that they do.

This is the closest the data comes to measuring the game's `permitted` flag, and it
complicates the label. `permitted` currently prints as *no application*, which reads as
"nobody has to be asked". In London, one applicant in five is asking anyway, and one in
seven of those is wrong about it.

Prior approval is the other outlier: 37.9% refused, by far the worst odds here. That is
mostly the large-rear-extension route, where the neighbour consultation is the whole
mechanism.

## What a condition actually says

Mined from condition-discharge applications, where councils publish the subject in the
first bracket: *"Details required by Condition 4 (Materials)"*. Grouped, because the same
obligation is written half a dozen ways — *approved plans*, *approved drawings*, *plan
numbers*, *compliance with approved drawings* — and it is one obligation.

Source: `condition_families.csv`; the thirty most common individual subjects are in
`conditions.csv`.

| Family | Occurrences |
|---|---|
| **Approved plans and drawings** | **5,795** |
| **Materials and finishes** | **2,384** |
| Construction management | 1,619 |
| Drainage and contamination | 1,423 |
| Landscaping | 1,199 |
| Cycle parking and storage | 973 |
| External lighting | 304 |
| Everything else | 16,238 |

For householder-scale work two dominate:

1. **Approved plans** — you build precisely what you drew, and any change is a new
   application.
2. **Materials** — what it is made of is agreed with somebody else, and stays agreed.

Neither is currently what the game's `consentCare` lines say. They are concrete, they are
ongoing, and they are the right shape for §10.2's *what it asks* column.

---

## What this changed

Three flags moved:

- `terrace` → `sensitive` (44.0% / 35.4%)
- `heat-pump` → `sensitive` (35.5%)
- `porch` → `householder` (30.1%, across 10,570 applications)

Nine cards kept their flag and gained a comment citing the figure that confirms it.
`sensitive` went from 2 cards of 24 to 4.

Three lines were rewritten from the condition data — `consentCare.permitted`,
`.householder` and `.sensitive` — and `consentLabels.permitted` became *no application
expected* rather than *no application*. `demolitionCare` was checked and kept.

The **24 per-plan `care` lines were re-read and all 24 stand unchanged.** They are
maintenance claims — gutters, a felt roof with ten years in it, a filter and a service —
and a record of planning decisions has nothing to say about any of them. The evidence is
silent, not agreeing.

### Does `sensitive` still mean anything?

Measured across 400 seeded games, before and after:

| | Before | After |
|---|---|---|
| Games with at least one `sensitive` placement | 45.0% | **71.5%** |
| `sensitive` placements per game | 0.48 | **0.98** |

A large jump, and worth checking against the thing it is supposed to represent. One
placement in eight is **12.2%** of placements — against a real conditions rate of 24.0%
across all decisions, and **32.2% on the householder route specifically**. So even after
the change the game still under-states how often conditions arrive. The flag stays a
minority of placements, and 28.5% of finished houses never carry one. It kept its meaning.

### One thing this surfaced, and did not fix

Every finished house prints exactly two obligations, and **365 of 400 games print the same
two** — `demolitionCare` followed by the `demolition` line from `consentCare`. 91% of games
demolish something, demolition is heaviest in `consentOrder`, and between them the two
demolition lines take both slots.

Which means the rewritten `householder` and `sensitive` obligations are only ever read in
the 9% of games where nothing came down. This is not new — the same 365/400 measured before
any of these changes — but it is now a measured defect rather than an unexamined one. It
cannot be fixed in content: the two lines are combined in `src/engine/report.ts`, and
either the budget or the combining has to change. Its own milestone.
