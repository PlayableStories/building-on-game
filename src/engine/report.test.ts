import { describe, expect, it } from 'vitest';
import {
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
  { pairLines, qualityLines, qualitySeverity },
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
    const zone = byId.get(planId)?.zone;
    if (zone === undefined) throw new Error('no such plan');
    const cell = legalCells(selected, zone)[0];
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
 * The three columns — §10.2
 * ------------------------------------------------------------------ */

describe('the three columns (§10.2)', () => {
  it('lists what you will have, in placement order', () => {
    const state = playThrough(11);
    const report = buildReport(state, deck, content, qualitySeverity, config);
    expect(report.have).toEqual(
      state.placements.map((placement) => plan(placement.planId).have),
    );
  });

  it('gives one have line per placement, and rather more care than that', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = playThrough(seed);
      const report = buildReport(state, deck, content, qualitySeverity, config);

      expect(report.have).toHaveLength(config.rounds);

      // One obligation per plan, then whatever consent the house has taken on
      // (§9.3), then demolition (§7). Never a repeat.
      const demolished = state.placements.some((placement) => placement.demolished);
      expect(report.care.length).toBeGreaterThanOrEqual(
        config.rounds + 1 + (demolished ? 1 : 0),
      );
      expect(report.care.slice(0, config.rounds)).toEqual(
        state.placements.map((placement) => plan(placement.planId).care),
      );
      expect(new Set(report.care).size).toBe(report.care.length);
    }
  });

  it('never puts a number in the cost column (§10.2)', () => {
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

  it('adds the demolition line to the care column, and only then (§7)', () => {
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

    expect(buildReport(untouched, deck, content, qualitySeverity, config).care).not.toContain(
      demolitionCare,
    );
    const after = buildReport(razed, deck, content, qualitySeverity, config).care;
    expect(after).toContain(demolitionCare);
    // §10.2 — the obligations of the plans first, then what taking the old house
    // down leaves you with.
    expect(after[after.length - 1]).toBe(demolitionCare);
  });

  it('is the longest column, deliberately (§10.2)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const report = reportFor(seed);
      const words = (lines: string[]) => lines.join(' ').split(/\s+/).length;
      expect(words(report.care)).toBeGreaterThan(words(report.have));
    }
  });
});

/* ------------------------------------------------------------------ *
 * Consent, inside the care column — §9.3
 * ------------------------------------------------------------------ */

describe('consent lands inside what you’ll look after (§9.3)', () => {
  it('is not a section of its own', () => {
    const report = reportFor(11);
    const somewhereElse = [...report.have, report.cost, report.closing];

    for (const line of Object.values(consentCare)) {
      expect(report.care.includes(line) || !somewhereElse.includes(line)).toBe(true);
    }
    // Whatever the house was, it took something on.
    expect(
      report.care.some((line) => Object.values(consentCare).includes(line)),
    ).toBe(true);
  });

  it('comes after the plans’ own obligations and before demolition', () => {
    const state = playThrough(11);
    const razed: GameState = {
      ...state,
      placements: state.placements.map((placement, index) => ({
        ...placement,
        demolished: index === 0,
      })),
    };
    const care = buildReport(razed, deck, content, qualitySeverity, config).care;

    const firstConsent = care.findIndex((line) =>
      Object.values(consentCare).includes(line),
    );
    expect(firstConsent).toBe(config.rounds);
    expect(care[care.length - 1]).toBe(demolitionCare);
  });

  it('says an obligation once, however many plans took it on', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const care = reportFor(seed).care;
      expect(new Set(care).size).toBe(care.length);
    }
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

  it('is the same house — same plans, same pleasures, same cost', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { ordinary, preserved: after } = bothWays(seed);
      expect(after.have).toEqual(ordinary.have);
      expect(after.cost).toBe(ordinary.cost);
      expect(after.closing).toBe(ordinary.closing);
    }
  });

  it('and different obligations — that is the whole argument of §9', () => {
    // Somewhere across twenty games, conservation has to bite. If it never did,
    // the flag would be decoration.
    let changed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { ordinary, preserved: after } = bothWays(seed);
      if (after.care.join('\n') !== ordinary.care.join('\n')) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('never takes an obligation away', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { ordinary, preserved: after } = bothWays(seed);
      // The one substitution §9.2 asks for: the longer demolition line replaces
      // the ordinary one rather than joining it.
      const dropped = ordinary.care.filter((line) => !after.care.includes(line));
      expect(dropped.every((line) => line === demolitionCare)).toBe(true);
    }
  });

  it('says much more about taking the old house down', () => {
    const state = playThrough(11);
    const razed: GameState = {
      ...state,
      placements: state.placements.map((placement, index) => ({
        ...placement,
        demolished: index === 0,
      })),
    };

    const ordinary = buildReport(razed, deck, content, qualitySeverity, config).care;
    const after = buildReport(razed, deck, content, qualitySeverity, preserved).care;

    expect(ordinary).toContain(demolitionCare);
    expect(after).not.toContain(demolitionCare);
    expect(after).toContain(conservationOverrides.demolition.care);
    expect(after.join(' ').length).toBeGreaterThan(ordinary.join(' ').length);
  });

  it('is still not a score — no number reaches the report either way', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { preserved: after } = bothWays(seed);
      expect(after.cost).not.toMatch(/\d/);
      expect(after.care.join(' ')).not.toMatch(/\bscore[ds]?\b|\bpoints\b|\btotal\b/i);
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
    expect(house.frontDoor).toBe('C1');
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
        ...report.have,
        ...report.care,
        report.cost,
        report.closing,
        report.answer,
      ].join(' ');
      expect(everything).not.toMatch(/\bscore[ds]?\b|\bpoints\b|\btotal\b|\d+\s*\//i);
    }
  });
});
