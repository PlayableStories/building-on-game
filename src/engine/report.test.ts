import { describe, expect, it } from 'vitest';
import {
  causeWords,
  closingLines,
  config,
  conservationOverrides,
  consentCare,
  consentOrder,
  costPhrases,
  deck,
  demolitionCare,
  pairLines,
  plot,
  situations,
  qualityLines,
  qualitySeverity,
} from '../content.ts';
import type { GameState, Plan, Report } from '../types.ts';
import { QUALITIES } from '../types.ts';
import { createGame } from './game.ts';
import { legalCells } from './grid.ts';
import {
  buildReport,
  closingLine,
  costPhrase,
  dominantQualities,
  summarise,
  type ReportContent,
} from './report.ts';

const game = createGame(
  deck,
  config,
  { pairLines, qualityLines, qualitySeverity, causeWords },
  plot,
  situations.map((situation) => situation.id),
);
const content: ReportContent = {
  situations,
  costPhrases,
  closingLines,
  demolitionCare,
  consentCare,
  consentOrder,
  conservationOverrides,
};
const byId = new Map(deck.map((plan) => [plan.id, plan]));

function plan(id: string): Plan {
  const found = byId.get(id);
  if (!found) throw new Error(`no plan "${id}" in the deck`);
  return found;
}

/** Play a whole game, always taking the first plan and the first legal cell. */
function playThrough(seed: number): GameState {
  let state = game.reducer(game.initialState(seed), { type: 'BEGIN' });

  while (state.phase === 'play') {
    const planId = state.hand[0];
    if (planId === undefined) throw new Error('dealt an empty hand');
    const selected = game.reducer(state, { type: 'SELECT_PLAN', planId });
    const where = byId.get(planId)?.where;
    if (where === undefined) throw new Error('no such plan');
    const cell = legalCells(selected, where)[0];
    if (cell === undefined) throw new Error('no legal cell');
    // §7.2, §13 — say yes to the confirmation, so that demolition is exercised
    // by the report tests rather than avoided by them.
    const proposed = game.reducer(selected, { type: 'PLACE', cell });
    const placed =
      proposed.pendingDemolition === null
        ? proposed
        : game.reducer(proposed, { type: 'CONFIRM_DEMOLITION' });
    state =
      placed.observation === null ? placed : game.reducer(placed, { type: 'DISMISS' });
  }

  return state;
}

function reportFor(seed: number): Report {
  return buildReport(playThrough(seed), deck, content, qualitySeverity, config);
}

/* ------------------------------------------------------------------ *
 * Benefit beside obligation — §10.2
 * ------------------------------------------------------------------ */

describe('the paired rows (§10.2)', () => {
  it('is three pairs, however many plans were placed', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(reportFor(seed).pairs).toHaveLength(3);
    }
  });

  it('never separates what you gained from what it asks', () => {
    // The whole point of the shape. Every row carries both, from the same plan.
    for (let seed = 1; seed <= 30; seed++) {
      for (const pair of reportFor(seed).pairs) {
        const entry = deck.find((one) => one.name === pair.name);
        if (!entry) throw new Error(`no plan named ${pair.name}`);
        expect(pair.have).toBe(entry.have);
        expect(pair.care).toBe(entry.care);
      }
    }
  });

  it('only ever reports plans that are actually on the plot', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = playThrough(seed);
      const built = new Set(
        state.placements.map((placement) => plan(placement.planId).name),
      );
      for (const pair of buildReport(state, deck, content, qualitySeverity, config)
        .pairs) {
        expect(built.has(pair.name)).toBe(true);
      }
    }
  });

  it('names each of the three once', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const names = reportFor(seed).pairs.map((pair) => pair.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  /**
   * §10.2 — which three. Not the first three or the last three: the three that
   * ask the most, by what they cost to build and the consent they took on. It
   * is not a score and it is never shown; it decides what the report is about.
   */
  it('reports the three that ask the most, heaviest first', () => {
    // Read against a house that demolished nothing, so that a plan's own cost
    // and consent are the whole of what it asks and the ranking is checkable
    // without re-implementing it. Demolition is tested separately below.
    const played = playThrough(11);
    const state: GameState = {
      ...played,
      placements: played.placements.map((placement) => ({
        ...placement,
        demolished: false,
      })),
    };
    const report = buildReport(state, deck, content, qualitySeverity, config);

    const weight = (name: string) => {
      const entry = deck.find((one) => one.name === name);
      if (!entry) throw new Error(`no plan named ${name}`);
      const bands = ['very-low', 'low', 'moderate', 'high'];
      return bands.indexOf(entry.cost) + consentOrder.indexOf(entry.consent);
    };

    const chosen = report.pairs.map((pair) => pair.name);
    // Heaviest first within the three...
    for (let index = 1; index < chosen.length; index++) {
      expect(weight(chosen[index - 1] as string)).toBeGreaterThanOrEqual(
        weight(chosen[index] as string),
      );
    }

    // ...and nothing left out asks more than the lightest one reported.
    const lightest = Math.min(...chosen.map(weight));
    for (const placement of state.placements) {
      const name = plan(placement.planId).name;
      if (chosen.includes(name)) continue;
      expect(weight(name)).toBeLessThanOrEqual(lightest);
    }
  });

  it('takes the demolition into account, not just the plan (§7)', () => {
    // The same plan asks more of you when it took part of the old house down,
    // because that is a heavier process and an irreversible one.
    const state = playThrough(11);
    const untouched: GameState = {
      ...state,
      placements: state.placements.map((placement) => ({
        ...placement,
        demolished: false,
      })),
    };
    const razed: GameState = {
      ...state,
      // The last placement is the cheapest thing on the plot in most games, so
      // demolishing with it is the clearest test that demolition counts.
      placements: state.placements.map((placement, index) => ({
        ...placement,
        demolished: index === state.placements.length - 1,
      })),
    };

    const wrecker = buildReport(razed, deck, content, qualitySeverity, config);
    const keeper = buildReport(untouched, deck, content, qualitySeverity, config);
    const name = plan(state.placements[state.placements.length - 1]!.planId).name;

    expect(wrecker.pairs.map((pair) => pair.name)).toContain(name);
    expect(keeper.pairs.map((pair) => pair.name)).not.toContain(name);
  });

  it('reports the same house the same way, whatever order it was built in', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = playThrough(seed);
      const shuffled: GameState = {
        ...state,
        placements: [...state.placements].reverse(),
      };
      const forwards = buildReport(state, deck, content, qualitySeverity, config);
      const backwards = buildReport(shuffled, deck, content, qualitySeverity, config);
      // The rounds move, so the tie-break moves — but the set does not.
      expect(new Set(backwards.pairs.map((pair) => pair.name))).toEqual(
        new Set(forwards.pairs.map((pair) => pair.name)),
      );
    }
  });

  it('never puts a number in the cost line (§10.2)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(reportFor(seed).cost).not.toMatch(/\d/);
    }
    for (const phrase of costPhrases) {
      expect(phrase).not.toMatch(/\d/);
    }
  });

  it('spends more on the cheapest house than on the dearest', () => {
    const cheap = [plan('lawn'), plan('bin-store'), plan('vegetable-garden')];
    const dear = [plan('kitchen'), plan('bathroom'), plan('heat-pump')];
    expect(costPhrase(cheap, costPhrases)).toBe(costPhrases[0]);
    expect(costPhrase(dear, costPhrases)).toBe(costPhrases[costPhrases.length - 1]);
  });

  it('says nothing about cost when there is nothing to say', () => {
    expect(costPhrase([], costPhrases)).toBe(costPhrases[0]);
    expect(costPhrase([plan('kitchen')], [])).toBe('');
  });

  /**
   * §10.2 — the length playtesting asked for. "The result is too complicate and
   * too long, better limited to three most important result in each group."
   */
  it('is short enough to read to the end', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const report = reportFor(seed);
      const lines = [
        ...report.pairs.flatMap((pair) => [pair.have, pair.care]),
        report.cost,
        ...report.obligations,
        report.closing,
        report.answer,
      ];
      expect(lines.length).toBeLessThanOrEqual(3 * 2 + 1 + 2 + 1 + 1);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Consent, as the house's own obligation — §9.3
 * ------------------------------------------------------------------ */

describe('the obligations the house took on (§9.3)', () => {
  it('is at most two lines, and never repeats one', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { obligations } = reportFor(seed);
      expect(obligations.length).toBeLessThanOrEqual(2);
      expect(new Set(obligations).size).toBe(obligations.length);
    }
  });

  it('always says something — every house takes something on', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(reportFor(seed).obligations.length).toBeGreaterThan(0);
    }
  });

  it('is not a section of its own, and not paired with anything (§9.3)', () => {
    const report = reportFor(11);
    const paired = report.pairs.flatMap((pair) => [pair.have, pair.care]);
    for (const line of report.obligations) {
      expect(paired).not.toContain(line);
    }
  });

  it('leads with taking the old house down, when that happened (§7)', () => {
    const state = playThrough(11);
    const untouched: GameState = {
      ...state,
      placements: state.placements.map((placement) => ({
        ...placement,
        demolished: false,
      })),
    };
    const razed: GameState = {
      ...state,
      placements: state.placements.map((placement, index) => ({
        ...placement,
        demolished: index === 0,
      })),
    };

    expect(
      buildReport(untouched, deck, content, qualitySeverity, config).obligations,
    ).not.toContain(demolitionCare);
    expect(
      buildReport(razed, deck, content, qualitySeverity, config).obligations[0],
    ).toBe(demolitionCare);
  });

  it('spends its two lines heaviest first', () => {
    // Two lines is not room for "some of this needed nobody's permission" ahead
    // of a condition the house will be living with. The order is what decides
    // which two survive the cut, so the order is what this checks.
    const rank = (line: string) =>
      consentOrder.findIndex((flag) => consentCare[flag] === line);

    for (let seed = 1; seed <= 30; seed++) {
      const shown = reportFor(seed)
        .obligations.filter((line) => Object.values(consentCare).includes(line))
        .map(rank);

      for (let index = 1; index < shown.length; index++) {
        expect(shown[index - 1] as number).toBeGreaterThan(shown[index] as number);
      }
    }
  });

  it('drops the lightest flag once the house has two heavier ones', () => {
    // The specific case the ordering exists for: a house that applied, took on
    // a condition and took something down does not spend a line saying that
    // some of it needed nobody's permission — which every house could say.
    const state = playThrough(11);
    const heavy: GameState = {
      ...state,
      placements: state.placements.map((placement, index) => ({
        ...placement,
        demolished: index === 0,
      })),
    };
    const { obligations } = buildReport(heavy, deck, content, qualitySeverity, config);

    expect(obligations).not.toContain(consentCare.permitted);
    expect(obligations).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ *
 * Preservation, played twice — §9.2
 * ------------------------------------------------------------------ */

describe('the same house, with conservation on (§9.2)', () => {
  const preserved = { ...config, conservation: true };

  /** The identical plot, reported both ways. */
  function bothWays(seed: number) {
    const state = playThrough(seed);
    return {
      ordinary: buildReport(state, deck, content, qualitySeverity, config),
      preserved: buildReport(state, deck, content, qualitySeverity, preserved),
    };
  }

  it('is the same house — same plans on the plot, same cost, same closing', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = playThrough(seed);
      const built = new Set(
        state.placements.map((placement) => plan(placement.planId).name),
      );
      const { ordinary, preserved: after } = bothWays(seed);

      expect(after.cost).toBe(ordinary.cost);
      expect(after.closing).toBe(ordinary.closing);
      // Whichever three each version foregrounds, they are the same eight
      // plans on the same plot — conservation does not build anything.
      for (const pair of [...after.pairs, ...ordinary.pairs]) {
        expect(built.has(pair.name)).toBe(true);
      }
    }
  });

  it('can change which three the report is about, and that is the point', () => {
    // Conservation makes some plans genuinely more demanding — the heat pump
    // needs an application, the glass extension gets a condition — so the three
    // that ask the most are not necessarily the same three. If this never
    // happened, the ranking would not be reading consent at all.
    let reordered = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { ordinary, preserved: after } = bothWays(seed);
      const names = (report: typeof ordinary) => report.pairs.map((one) => one.name);
      if (names(after).join('|') !== names(ordinary).join('|')) reordered++;
    }
    expect(reordered).toBeGreaterThan(0);
  });

  it('and different obligations — that is the whole argument of §9', () => {
    // Somewhere across twenty games, conservation has to bite. If it never did,
    // the flag would be decoration.
    let changed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { ordinary, preserved: after } = bothWays(seed);
      if (after.obligations.join('\n') !== ordinary.obligations.join('\n')) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('replaces the demolition line rather than dropping it (§9.2)', () => {
    // The one substitution §9.2 asks for. With only two obligation lines the
    // old test — that nothing is ever dropped — cannot hold and should not:
    // conservation adds heavier obligations, and heavier ones win the space.
    for (let seed = 1; seed <= 20; seed++) {
      const { ordinary, preserved: after } = bothWays(seed);
      if (ordinary.obligations.includes(demolitionCare)) {
        expect(after.obligations).not.toContain(demolitionCare);
        expect(after.obligations).toContain(conservationOverrides.demolition.care);
      }
    }
  });

  it('says much more about taking the old house down', () => {
    /**
     * Seed 14 takes two of the old rooms down of its own accord, which is what
     * this test needs: `demolished` set by the placement that did it, on a cell
     * the old house actually stood on. Setting the flag afterwards on whatever
     * happened to be placed first is a state the game cannot reach — a bin
     * store in the garden has no fabric under it to demolish — and it ranks
     * wherever that plan ranks, which is not necessarily inside the two lines
     * the report has room for.
     */
    const razed = playThrough(14);
    expect(razed.placements.filter((placement) => placement.demolished)).not.toHaveLength(0);

    const ordinary = buildReport(razed, deck, content, qualitySeverity, config)
      .obligations;
    const after = buildReport(razed, deck, content, qualitySeverity, preserved)
      .obligations;

    expect(ordinary).toContain(demolitionCare);
    expect(after).not.toContain(demolitionCare);
    expect(after).toContain(conservationOverrides.demolition.care);
    expect(after.join(' ').length).toBeGreaterThan(ordinary.join(' ').length);
  });

  it('is still not a score — no number reaches the report either way', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { preserved: after } = bothWays(seed);
      expect(after.cost).not.toMatch(/\d/);
      expect(after.obligations.join(' ')).not.toMatch(
        /\bscore[ds]?\b|\bpoints\b|\btotal\b/i,
      );
    }
  });
});

/* ------------------------------------------------------------------ *
 * The closing line — §10.3
 * ------------------------------------------------------------------ */

describe('the closing line (§10.3)', () => {
  it('counts the dominant qualities across the plot, strongest first', () => {
    const noisy = [plan('kitchen'), plan('home-farm'), plan('heat-pump')];
    const dominant = dominantQualities(noisy, qualitySeverity);
    expect(dominant).toContain('noise');
    // Every quality named is one something on the plot actually emits.
    const emitted = new Set(noisy.flatMap((entry) => entry.emits));
    for (const quality of dominant) {
      expect(emitted.has(quality)).toBe(true);
    }
  });

  it('is deterministic for a given board', () => {
    const state = playThrough(5);
    const first = buildReport(state, deck, content, qualitySeverity, config);
    const second = buildReport(state, deck, content, qualitySeverity, config);
    expect(second.closing).toBe(first.closing);
  });

  it('does not depend on the order the same house was built in', () => {
    const state = playThrough(5);
    const reversed: GameState = { ...state, placements: [...state.placements].reverse() };
    expect(buildReport(reversed, deck, content, qualitySeverity, config).closing).toBe(
      buildReport(state, deck, content, qualitySeverity, config).closing,
    );
  });

  it('always has something to say', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(reportFor(seed).closing.length).toBeGreaterThan(0);
    }
  });

  it('has a fallback with no conditions on it', () => {
    const unconditional = closingLines.filter(
      (line) => line.dominant === undefined && line.fabric === undefined,
    );
    expect(unconditional).toHaveLength(1);
  });

  it('prefers the most specific line that fits', () => {
    const house = summarise(playThrough(5), deck, qualitySeverity);
    const general = { line: 'general' };
    // How much of the old house this one has left, so the test can offer a line
    // that fits it and a line that does not.
    const fabric =
      house.fabricRemaining.length === 4
        ? 'all'
        : house.fabricRemaining.length === 0
          ? 'none'
          : 'some';
    const wrong = fabric === 'all' ? 'none' : 'all';

    expect(closingLine(house, [general, { line: 'specific', fabric }])).toBe('specific');
    // A condition that does not fit is not chosen, however specific it is.
    expect(closingLine(house, [general, { line: 'specific', fabric: wrong }])).toBe(
      'general',
    );
    // A dominant quality the house does not have is no match either.
    const absent = QUALITIES.find((quality) => !house.dominant.includes(quality));
    if (absent) {
      expect(closingLine(house, [general, { line: 'specific', dominant: [absent] }])).toBe(
        'general',
      );
    }
  });
});

/* ------------------------------------------------------------------ *
 * The house, as content sees it — §10.4
 * ------------------------------------------------------------------ */

describe('the finished house (§10.4)', () => {
  it('measures distance in steps across the grid', () => {
    const state = playThrough(11);
    const house = summarise(state, deck, qualitySeverity);
    const [first, second] = state.placements;
    if (!first || !second) throw new Error('expected two placements');
    expect(house.cellOf(first.planId)).toBe(first.cell);
    expect(house.has(first.planId)).toBe(true);
    expect(house.has('not-a-plan')).toBe(false);
    expect(house.distance(first.planId, first.planId)).toBe(0);
    expect(house.distance(first.planId, 'not-a-plan')).toBeNull();
    expect(house.distance(first.planId, second.planId)).toBeGreaterThan(0);
  });

  it('measures from the front door, which is always there to measure from (§7)', () => {
    const state = playThrough(11);
    const house = summarise(state, deck, qualitySeverity);
    expect(house.frontDoor).toBe('GC1');
    // Null means the plan was never placed, never that the door is missing.
    expect(house.fromFrontDoor('not-a-plan')).toBeNull();
  });

  it('answers the one situation the game was played for, in one line (§10.4)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(reportFor(seed).answer.length).toBeGreaterThan(0);
    }
  });

  it('answers the situation this game drew, and not another one', () => {
    // Every situation writes lines nothing else writes, so the answer being
    // non-empty is not enough: it has to be *that* situation's answer.
    for (let seed = 1; seed <= 30; seed++) {
      const state = playThrough(seed);
      const situation = situations.find((entry) => entry.id === state.situationId);
      if (!situation) throw new Error('no situation drawn');
      const house = summarise(state, deck, qualitySeverity);
      expect(buildReport(state, deck, content, qualitySeverity, config).answer).toBe(
        situation.reaction(house),
      );
    }
  });

  it('answers from every situation without falling over on a sparse house', () => {
    // Each situation asks the plot different questions, and a house with almost
    // nothing in it has to have an answer for all six.
    const state = playThrough(11);
    for (const situation of situations) {
      const sparse: GameState = { ...state, situationId: situation.id, fabric: [] };
      expect(
        buildReport(sparse, deck, content, qualitySeverity, config).answer.length,
      ).toBeGreaterThan(0);
    }
  });

  it('says nothing anywhere that reads as a score (§10.1)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const report = reportFor(seed);
      const everything = [
        ...report.pairs.flatMap((pair) => [pair.name, pair.have, pair.care]),
        report.cost,
        ...report.obligations,
        report.closing,
        report.answer,
      ].join(' ');
      expect(everything).not.toMatch(/\bscore[ds]?\b|\bpoints\b|\btotal\b|\d+\s*\//i);
    }
  });
});
