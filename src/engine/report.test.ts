import { describe, expect, it } from 'vitest';
import {
  closingLines,
  config,
  costPhrases,
  deck,
  demolitionCare,
  household,
  pairLines,
  qualityLines,
  qualitySeverity,
} from '../content.ts';
import type { GameState, PlanReport, Report } from '../types.ts';
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

const game = createGame(deck, config, { pairLines, qualityLines, qualitySeverity });
const content: ReportContent = { household, costPhrases, closingLines, demolitionCare };
const byId = new Map(deck.map((plan) => [plan.id, plan]));

function plan(id: string): PlanReport {
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
    const cell = legalCells(selected)[0];
    if (cell === undefined) throw new Error('no legal cell');
    const placed = game.reducer(selected, { type: 'PLACE', cell });
    state =
      placed.observation === null ? placed : game.reducer(placed, { type: 'DISMISS' });
  }

  return state;
}

function reportFor(seed: number): Report {
  return buildReport(playThrough(seed), deck, content, qualitySeverity);
}

/* ------------------------------------------------------------------ *
 * The three columns — §10.2
 * ------------------------------------------------------------------ */

describe('the three columns (§10.2)', () => {
  it('lists what you will have, in placement order', () => {
    const state = playThrough(11);
    const report = buildReport(state, deck, content, qualitySeverity);
    expect(report.have).toEqual(
      state.placements.map((placement) => plan(placement.planId).have),
    );
  });

  it('gives one have line and one care line per placement', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = playThrough(seed);
      const report = buildReport(state, deck, content, qualitySeverity);
      const demolished = state.placements.some((placement) => placement.demolished);
      expect(report.have).toHaveLength(config.rounds);
      expect(report.care).toHaveLength(config.rounds + (demolished ? 1 : 0));
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

    expect(buildReport(untouched, deck, content, qualitySeverity).care).not.toContain(
      demolitionCare,
    );
    const after = buildReport(razed, deck, content, qualitySeverity).care;
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
    const first = buildReport(state, deck, content, qualitySeverity);
    const second = buildReport(state, deck, content, qualitySeverity);
    expect(second.closing).toBe(first.closing);
  });

  it('does not depend on the order the same house was built in', () => {
    const state = playThrough(5);
    const reversed: GameState = { ...state, placements: [...state.placements].reverse() };
    expect(buildReport(reversed, deck, content, qualitySeverity).closing).toBe(
      buildReport(state, deck, content, qualitySeverity).closing,
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

  it('has no front door to measure from once B2 comes down (§7)', () => {
    const state = playThrough(11);
    const doorless: GameState = { ...state, frontDoor: null };
    const house = summarise(doorless, deck, qualitySeverity);
    expect(house.fromFrontDoor('bathroom')).toBeNull();
  });

  it('gives every member of the household exactly one line', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const report = reportFor(seed);
      expect(report.household).toHaveLength(household.length);
      expect(report.household.map((person) => person.name)).toEqual(
        household.map((person) => person.name),
      );
      for (const person of report.household) {
        expect(person.reaction.length).toBeGreaterThan(0);
      }
    }
  });

  it('reacts to a house with no front door rather than falling over', () => {
    const state = playThrough(11);
    const doorless: GameState = { ...state, frontDoor: null, fabric: [] };
    for (const person of buildReport(doorless, deck, content, qualitySeverity)
      .household) {
      expect(person.reaction.length).toBeGreaterThan(0);
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
        ...report.household.map((person) => person.reaction),
      ].join(' ');
      expect(everything).not.toMatch(/\bscore[ds]?\b|\bpoints\b|\btotal\b|\d+\s*\//i);
    }
  });
});
