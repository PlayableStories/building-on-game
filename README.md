# Building On

> A home isn't a list of rooms. It's what ended up next to what.

A no-fail placement game about renovating a house you inherited. Eight rounds; each one
deals you three plans and you choose one. It has to touch what's already built, and you can
never move it again. Occasionally the house tells you what you've just put next to what. At
the end it tells you what you built and what it will ask of you for the rest of your life.

A game is eight decisions and a report. There is no score and no way to lose. The whole
thing is text and coloured blocks, and the layout adapts to narrow screens.

**[Play it →](https://playablestories.github.io/building-on-game/)** ·
**[How a game goes →](GAME-FLOW.md)** (with screenshots)

---

## Quickstart

```bash
git clone https://github.com/PlayableStories/building-on-game.git
cd building-on-game
nvm use              # reads .nvmrc → 20. Vite 8 refuses anything below 20.19
npm install
npm run dev          # localhost:5173
npm run build        # production build
```

---

## The Game

A 5×5 plot on three levels — the ground floor, the first floor and the roof, one on screen
at a time. The house you inherited is already standing on part of it: a front door and a
stair that came with the house and can never be changed, the landing the stair arrives at,
and four old rooms behind them — the old kitchen, the old sitting room, the old scullery,
the old back room.

Each round deals three plans. Two come from the round's tier, one from anywhere:

| Rounds | Tier | Roughly |
|---|---|---|
| 1–2 | **Threshold** | Porch, boot room, downstairs WC — the way in |
| 3–4 | **Daily** | Kitchen, living room, utility — where the day happens |
| 5–6 | **Private** | Bedrooms, bathroom, study — the doors that close |
| 7–8 | **Outside** | Terrace, shed, vegetable garden, heat pump |

Four rules decide where a plan can go, and between them they are most of the game:

- **It has to touch** something already standing. The house grows outward from itself.
- **Every plan belongs somewhere** — in the house (rows 1–3), in the garden (rows 4–5),
  upstairs, or on the roof. Choosing one takes the board to the level it goes on.
- **Upstairs only goes over a room.** What you build on the ground decides what you can
  sleep above. And roofing a cell seals the first floor beneath it, for good.
- **The front door and the stairs are not yours to change.** They are the fixed points
  everything else is decided around.

The old rooms are ordinary cells and you can build on them. Doing so takes them down, for
good, and that is the only thing the game ever asks you to confirm.

## The Design

Four mechanics carry the game:

- **One line per placement, maximum** — resolved in a strict order: an explicit pair, then
  the strongest quality match, then orientation, then **silence**. Silence is a valid
  result, not a failure — across 400 simulated games, three were silent from start to
  finish. The line names what caused it and lights both cells while you read it, so it
  lands as a consequence of the move rather than as atmosphere.

- **Placement is permanent, and exactly one thing is confirmed.** Everything in eight
  rounds is additive and forgiving except demolition, which is neither — so it is the only
  question the game asks. It states what will happen and gets out of the way. It does not
  warn and it does not argue: the weight arrives on its own, because it is a house someone
  left you.

- **The report pairs benefit with obligation.** Three rooms, not eight — the three that ask
  the most of you. What you gain is printed beside what it will want, and the layout never
  lets you read one without the other. Then one cost line, as a phrase with no figure in
  it, and the situation you were given at the start, answered.

- **Two-file customization.** All player-facing text lives in **one** file
  (`src/content.ts`); all visuals live in **one** file (`src/theme.css`). Nothing in
  `src/engine/` imports either — content is handed to it as an argument, and
  `npm run validate` fails if that stops being true. This is the load-bearing design
  choice: it splits the project into a clean engine and an editable surface, and it is
  enforced rather than intended.

The deck is 24 plans across four tiers plus a wildcard pool, and 6 situations of which one
is drawn per game. A game is reproducible from a single seed.

## The Concept

Someone left you a house, and the roof failed in February. The game is about the gap
between wanting a thing and looking after it — every room you gain arrives attached to
something it will ask of you, forever, and you find that out one neighbour at a time.

The situations are ordinary rather than dramatic: working from home with no door to close,
a parent moving in who manages one flight of stairs on a good day, two of you who cook and
one who tidies. The report answers the one you were given, and sometimes the answer is that
you didn't answer it — *"There is still no kitchen. Whatever else this house turned into,
the argument you were trying to settle is exactly where it was."*

Consent flags are flags, never outcomes. Nothing is refused, nothing is blocked, nothing is
a warning. They are a record of what you took on by building this rather than that.

---

## Fork it

Building On isn't just a game — it's a template for no-fail games about consequence and
care. Two paths to make it yours:

### Level 1 — Re-skin (text and visuals)
Keep the mechanics, swap the building. A community centre, a co-op office, a high street, a
hospice garden. Edit two files: `src/content.ts` for all text — including the plot itself,
the deck and the situations — and `src/theme.css` for all visuals. No engine code required,
and `npm run validate` tells you if you've broken something.

→ See **[FORKING.md](./FORKING.md)** for the full re-skin guide.

### Level 2 — Rebuild from scratch with AI
Recreate the game on a different stack — Next.js, Vue, Svelte, native mobile, whatever —
using an AI code builder (Replit Agent, Bolt.new, Lovable, v0.app, Cursor, Claude Code).
Also the path for a differently shaped plot, since the 5×5 grid is an engine constant. The
reference prompt is self-contained and asks the AI to confirm with you before writing code.

→ See **[REFERENCE_PROMPT.md](./REFERENCE_PROMPT.md)** for the prompt and platform notes.

---

## Tech stack

- **React 19** (Vite 8 scaffold), **TypeScript 5.9**
- **`useReducer`** for game state — no state library; the whole game is one reducer
- **Plain CSS** with custom properties (no Tailwind, no UI library)
- **Vitest + Testing Library** for units and components, **Playwright** for a real-browser
  playthrough against the Chrome already on your machine
- **No backend** — everything bundled at build time, and a seeded RNG so a game is
  reproducible from one number
- **No web fonts, no images, no icons.** System serif and sans stacks; the favicon is an
  inline SVG data URI. The game is text and coloured rectangles

The two-file editable architecture (`src/content.ts` + `src/theme.css`) is the project's
defining design choice, and the engine's inability to import either is what keeps it
honest.

## Validation

```bash
npm run validate     # content is playable, and the fork surface is intact
npm test             # 210 unit and component tests
npm run build        # type-check, then build to dist/
npm run test:e2e     # plays a whole game in your own Chrome
```

All four should report green before a fork or refactor ships. `npm run validate` also
guards the two boundaries the fork surface rests on, which are not content at all:
`src/engine/` importing nothing but `types.ts`, and every user-visible word living in
`content.ts` rather than in a component.

`npm run screenshots` replays the game and rewrites the five frames in `GAME-FLOW.md`.

## Is any of this true?

The consent flags say a porch needs no application and a terrace needs no application.
[`PLANNING-DATA.md`](PLANNING-DATA.md) checks claims like that against **308,015 real
planning decisions from 33 London boroughs**, collected at the House London Data Hackathon.
Some of the deck holds up remarkably well — internal wall insulation appears *once* in the
whole dataset — and some of it does not.

## Hosting

The game is a static bundle — no server, no database, no API key — so it can be served from
anywhere that serves files. `.github/workflows/deploy.yml` publishes it to GitHub Pages on
every push to `main`, gated on the validator and the test suite. It reads the base path
from the repository name at build time, so **a fork deploys under its own name with no
edit**.

---

## Repository structure

```
building-on-game/
├── README.md                  # you are here
├── GAME-FLOW.md               # how a round works, with screenshots
├── FORKING.md                 # Level 1 (re-skin) guide
├── REFERENCE_PROMPT.md        # Level 2 (AI rebuild) prompt
├── GDD.md                     # the design document — what it's for, and why
├── PLAN.md                    # how it got built, M0–M12, and what the playtest changed
├── PLANNING-DATA.md           # what 308,015 real London decisions say about the flags
├── index.html
├── package.json
├── docs/screenshots/          # generated by `npm run screenshots`
├── data/planning/             # the queries behind PLANNING-DATA.md, and their output
├── src/
│   ├── content.ts             # 📝 all player text, the deck, the plot, the situations
│   ├── theme.css              # 🎨 all colours, sizes and measures
│   ├── types.ts               # the only thing the engine imports
│   ├── App.tsx, app.css, main.tsx
│   ├── components/            # Plot, Hand, Observation, Report, Demolition, Rules, Intro
│   └── engine/                # grid, deck, adjacency, consent, report, game, rng
├── scripts/
│   ├── validate.ts            # content + fork-surface checks
│   ├── screenshots.ts         # replays a game and writes the five frames
│   └── planning-data.ts       # re-runs the planning queries against a local export
└── e2e/
    └── play.spec.ts           # a whole game in real Chrome
```

## Status

Finished to the scope the GDD sets out. The build is staged across milestones M0–M12 in
[`PLAN.md`](PLAN.md), which also records what the §17 playtest found and what changed
because of it.

**Play it twice.** Set `conservation: true` in `src/content.ts` and build the same house
again. Same plans, same pleasures, same cost — and different obligations. That is the
argument the game is making, and it is one config flag.

Out of scope by design: discovery, placement animation, save and load, a seed in the URL,
a basement, multi-cell plans, and any score at all.

## Contributing

Issues and PRs welcome. The two-file architecture means most contributions land in
`src/content.ts` (new plans, new situations, new observations) or `src/theme.css` (visual
variants) — no engine knowledge required. Run the four validation commands before opening
one.
