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

## What this changes

Three flags, and the writing that explains them:

- `terrace` → `sensitive` (44.0% / 35.4%)
- `heat-pump` → `sensitive` (35.5%)
- `porch` → `householder` (30.1%, across 10,570 applications)

Nine cards keep their flag and gain a comment citing the figure that confirms it.
`sensitive` goes from 2 cards of 24 to 4 — still a minority, which it has to be: the flag
means *materially above the normal case*, and the normal case is that a quarter of
everything is conditioned.

The deck has no equivalent for several of the most common real operations — basement,
dormer, garage conversion, change of use. That is a content decision rather than a data
one, and it is not made here.
