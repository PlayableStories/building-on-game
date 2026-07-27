import { describe, expect, it } from 'vitest';
import type { PlanAdjacency, Quality } from '../types.ts';
import { QUALITIES } from '../types.ts';
import { deck, pairLines, qualityLines, qualitySeverity } from '../content.ts';
import { observationFor, type AdjacencyContent, type Neighbour } from './adjacency.ts';

const writing: AdjacencyContent = { pairLines, qualityLines, qualitySeverity };

function plan(id: string): PlanAdjacency {
  const found = deck.find((entry) => entry.id === id);
  if (!found) throw new Error(`no plan "${id}" in the deck`);
  return found;
}

function beside(...ids: string[]): Neighbour[] {
  return ids.map((id) => ({ kind: 'plan', plan: plan(id) }) as const);
}

const FABRIC: Neighbour[] = [{ kind: 'fabric' }];

/* ------------------------------------------------------------------ *
 * The resolution order — §8.6
 * ------------------------------------------------------------------ */

describe('§8.6 resolution order', () => {
  it('1. an explicit pair wins', () => {
    // C4 is a south row, so the home farm's orientation line is also available,
    // and smell-into-kitchen is a live quality match. The pair still wins.
    expect(observationFor(writing, plan('home-farm'), 'C4', beside('kitchen'))).toBe(
      'A short walk with wet hands. This is the version that gets used.',
    );
  });

  it('matches a pair in either direction', () => {
    const a = observationFor(writing, plan('home-farm'), 'C3', beside('bedroom'));
    const b = observationFor(writing, plan('bedroom'), 'C3', beside('home-farm'));
    expect(a).toBe('Compost, and something starting at six in the morning.');
    expect(b).toBe(a);
  });

  it('2. a quality match wins when no pair is written', () => {
    // The heat pump emits noise; the study suffers from it. Row 3 means no
    // orientation line is available to confuse the result.
    expect(observationFor(writing, plan('heat-pump'), 'C3', beside('study'))).toBe(
      'It carries through the wall. Not constantly — just at the wrong times.',
    );
  });

  it('fires a quality match in either direction', () => {
    // What the new plan does to its neighbour...
    expect(observationFor(writing, plan('bin-store'), 'C3', beside('study'))).toBe(
      'You will know what was cooked, and for how long, some hours later.',
    );
    // ...and what the neighbour does to the new plan.
    expect(observationFor(writing, plan('study'), 'C3', beside('bin-store'))).toBe(
      'You will know what was cooked, and for how long, some hours later.',
    );
  });

  it('takes the strongest quality when several fire', () => {
    // A bedroom next to a gym: noise and shade both fire. `qualitySeverity`
    // ranks noise first, so that is the line.
    const line = observationFor(writing, plan('bedroom'), 'C3', beside('gym'));
    expect(line).toBe('It carries through the wall. Not constantly — just at the wrong times.');
  });

  it('3. orientation fires when nothing else does', () => {
    expect(observationFor(writing, plan('solar-array'), 'C1', [])).toBe(
      'A lovely gesture. Very little electricity.',
    );
    expect(observationFor(writing, plan('home-farm'), 'B2', [])).toBe(
      'Too little sun. It will be a hobby rather than a crop.',
    );
  });

  it('4. silence is a valid result', () => {
    // A shed in the middle row, touching nothing that reacts to it.
    expect(observationFor(writing, plan('shed'), 'C3', [])).toBeNull();
    expect(observationFor(writing, plan('shed'), 'C3', beside('hall'))).toBeNull();
  });

  it('never returns more than one line', () => {
    // Whatever fires, the result is a single string or nothing.
    for (const entry of deck) {
      for (const cell of ['C1', 'C3', 'C5'] as const) {
        const line = observationFor(writing, entry, cell, beside('kitchen', 'bedroom'));
        expect(line === null || typeof line === 'string').toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * Orientation — §5, §8.6
 * ------------------------------------------------------------------ */

describe('orientation', () => {
  it('reads the row, not the column', () => {
    // Every column in row 1 is north; the line does not vary across the plot.
    const north = ['A1', 'B1', 'C1', 'D1', 'E1'] as const;
    for (const cell of north) {
      expect(observationFor(writing, plan('solar-array'), cell, [])).toBe(
        'A lovely gesture. Very little electricity.',
      );
    }
  });

  it('says nothing in row 3, which is neither street nor garden', () => {
    expect(observationFor(writing, plan('solar-array'), 'C3', [])).toBeNull();
  });

  it('distinguishes the two ends of the plot', () => {
    const north = observationFor(writing, plan('glass-extension'), 'C1', []);
    const south = observationFor(writing, plan('glass-extension'), 'C5', []);
    expect(north).toBe(
      'The light is even and cold. You will heat this room more than any other.',
    );
    expect(south).toBe(
      'Light all afternoon. Unusable in July without shade you haven’t drawn yet.',
    );
    expect(north).not.toBe(south);
  });
});

/* ------------------------------------------------------------------ *
 * The two pairings that are not plan-to-plan — §8.7
 * ------------------------------------------------------------------ */

describe('§8.7 pairings against something other than a plan', () => {
  it('speaks up for air conditioning beside anything at all', () => {
    const line = 'Cool this summer, and every summer after, at a price that rises.';
    expect(observationFor(writing, plan('air-conditioning'), 'C3', beside('shed'))).toBe(line);
    expect(observationFor(writing, plan('air-conditioning'), 'C3', beside('lawn'))).toBe(line);
    expect(observationFor(writing, plan('air-conditioning'), 'C3', FABRIC)).toBe(line);
  });

  it('says nothing for air conditioning with no neighbour at all', () => {
    // "Beside anything" still needs something to be beside.
    expect(observationFor(writing, plan('air-conditioning'), 'C3', [])).toBeNull();
  });

  it('reacts to the old solid walls, not to a room', () => {
    expect(observationFor(writing, plan('wall-insulation'), 'C3', FABRIC)).toBe(
      'Warmer. And a damp risk you will be managing for a decade.',
    );
    expect(observationFor(writing, plan('wall-insulation'), 'C3', beside('shed'))).toBeNull();
  });

  it('prefers a line naming both plans over a wildcard one', () => {
    // Air conditioning has a '*' rule; if a specific pair were ever written for
    // it, that must win. Checked here against the rule that enforces it.
    const specific = observationFor(
      writing,
      plan('heat-pump'),
      'C3',
      beside('bedroom', 'shed'),
    );
    expect(specific).toBe('Quiet enough now. Less so at five in the morning in January.');
  });
});

/* ------------------------------------------------------------------ *
 * The content itself — the checks that move into `validate` in M6
 * ------------------------------------------------------------------ */

describe('the writing (§16)', () => {
  const ids = new Set(deck.map((entry) => entry.id));

  it('only ever names qualities that exist (§8.5)', () => {
    const known = new Set<Quality>(QUALITIES);
    for (const entry of deck) {
      for (const quality of [...entry.emits, ...entry.sensitive]) {
        expect(known.has(quality)).toBe(true);
      }
    }
    for (const line of qualityLines) expect(known.has(line.quality)).toBe(true);
    expect(new Set(qualitySeverity)).toEqual(known);
  });

  it('only ever names plans that exist', () => {
    for (const line of pairLines) {
      expect(ids.has(line.a)).toBe(true);
      if (line.b !== '*' && line.b !== 'fabric') expect(ids.has(line.b)).toBe(true);
    }
  });

  it('has a line for every quality that can actually fire', () => {
    const emitted = new Set(deck.flatMap((entry) => entry.emits));
    const suffered = new Set(deck.flatMap((entry) => entry.sensitive));
    const canFire = [...emitted].filter((quality) => suffered.has(quality));

    expect(canFire.length).toBeGreaterThan(0);
    for (const quality of canFire) {
      expect(qualityLines.some((line) => line.quality === quality)).toBe(true);
    }
  });

  it('has no sensitivity that nothing in the deck emits', () => {
    // A plan that suffers from something no plan produces can never react, and
    // the sensitivity is dead weight in the deck.
    const emitted = new Set(deck.flatMap((entry) => entry.emits));
    for (const entry of deck) {
      for (const quality of entry.sensitive) {
        expect(emitted.has(quality)).toBe(true);
      }
    }
  });

  it('writes no line twice', () => {
    const lines = [
      ...pairLines.map((line) => line.line),
      ...qualityLines.map((line) => line.line),
      ...deck.flatMap((entry) => Object.values(entry.orientation ?? {})),
    ];
    expect(new Set(lines).size).toBe(lines.length);
  });
});
