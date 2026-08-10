import { describe, expect, it } from 'vitest';
import type { PlanAdjacency, Quality } from '../types.ts';
import { QUALITIES } from '../types.ts';
import {
  causeWords,
  deck,
  pairLines,
  qualityLines,
  qualitySeverity,
} from '../content.ts';
import { observationFor, type AdjacencyContent, type Neighbour } from './adjacency.ts';

const writing: AdjacencyContent = {
  pairLines,
  qualityLines,
  qualitySeverity,
  causeWords,
};

function plan(id: string): PlanAdjacency {
  const found = deck.find((entry) => entry.id === id);
  if (!found) throw new Error(`no plan "${id}" in the deck`);
  return found;
}

/**
 * Neighbours, laid out along row 3 either side of C3 so that every one of them
 * has a real cell — which is what the resolution now has to report back.
 */
const AROUND = ['GB3', 'GD3', 'GA3', 'GE3'] as const;

function beside(...ids: string[]): Neighbour[] {
  return ids.map((id, index) => {
    const cell = AROUND[index];
    if (cell === undefined) throw new Error('more neighbours than C3 has');
    return { kind: 'plan', cell, plan: plan(id) } as const;
  });
}

const FABRIC: Neighbour[] = [{ kind: 'fabric', cell: 'GB3' }];

/** The line only, for the tests that are about which line wins. */
function lineFor(...args: Parameters<typeof observationFor>): string | null {
  return observationFor(...args)?.line ?? null;
}

/* ------------------------------------------------------------------ *
 * The resolution order — §8.6
 * ------------------------------------------------------------------ */

describe('§8.6 resolution order', () => {
  it('1. an explicit pair wins', () => {
    // C4 is a south row, so the home farm's orientation line is also available,
    // and smell-into-kitchen is a live quality match. The pair still wins.
    expect(lineFor(writing, plan('home-farm'), 'GC4', beside('kitchen'))).toBe(
      'A short walk with wet hands. This is the version that gets used.',
    );
  });

  it('matches a pair in either direction', () => {
    const a = lineFor(writing, plan('home-farm'), 'GC3', beside('bedroom'));
    const b = lineFor(writing, plan('bedroom'), 'GC3', beside('home-farm'));
    expect(a).toBe('Compost, and something starting at six in the morning.');
    expect(b).toBe(a);
  });

  it('2. a quality match wins when no pair is written', () => {
    // The heat pump emits noise; the study suffers from it. Row 3 means no
    // orientation line is available to confuse the result.
    expect(lineFor(writing, plan('heat-pump'), 'GC3', beside('study'))).toBe(
      'It carries through the wall. Not constantly — just at the wrong times.',
    );
  });

  it('fires a quality match in either direction', () => {
    // What the new plan does to its neighbour...
    expect(lineFor(writing, plan('bin-store'), 'GC3', beside('study'))).toBe(
      'You will know what was cooked, and for how long, some hours later.',
    );
    // ...and what the neighbour does to the new plan.
    expect(lineFor(writing, plan('study'), 'GC3', beside('bin-store'))).toBe(
      'You will know what was cooked, and for how long, some hours later.',
    );
  });

  it('takes the strongest quality when several fire', () => {
    // A bedroom next to a gym: noise and shade both fire. `qualitySeverity`
    // ranks noise first, so that is the line.
    const line = lineFor(writing, plan('bedroom'), 'GC3', beside('gym'));
    expect(line).toBe('It carries through the wall. Not constantly — just at the wrong times.');
  });

  it('3. orientation fires when nothing else does', () => {
    expect(lineFor(writing, plan('solar-array'), 'GC1', [])).toBe(
      'A lovely gesture. Very little electricity.',
    );
    expect(lineFor(writing, plan('home-farm'), 'GB4', [])).toBe(
      'Too little sun. It will be a hobby rather than a crop.',
    );
  });

  it('4. silence is a valid result', () => {
    // A shed has nothing to say about which way it faces, so nowhere on the
    // plot gives it an orientation line to fall back on.
    expect(lineFor(writing, plan('shed'), 'GB4', [])).toBeNull();
    expect(lineFor(writing, plan('shed'), 'GB5', beside('hall'))).toBeNull();
  });

  it('never returns more than one line', () => {
    // Whatever fires, the result is a single string or nothing.
    for (const entry of deck) {
      for (const cell of ['GC1', 'GC3', 'GC5'] as const) {
        const line = lineFor(writing, entry, cell, beside('kitchen', 'bedroom'));
        expect(line === null || typeof line === 'string').toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * Cause and consequence — §8.6
 *
 * The fix for the line landing as atmosphere. Every result has to say which
 * placement it is about and what that placement was read against, in words
 * above the line and in cells the plot can light underneath it.
 * ------------------------------------------------------------------ */

describe('what caused the line (§8.6)', () => {
  it('names the placement and the neighbour, for a pair', () => {
    const result = observationFor(writing, plan('home-farm'), 'GC4', beside('kitchen'));
    expect(result?.kind).toBe('pair');
    expect(result?.cause).toBe('Home farm beside Kitchen');
  });

  it('names them for a quality match too', () => {
    const result = observationFor(writing, plan('heat-pump'), 'GC3', beside('study'));
    expect(result?.kind).toBe('quality');
    expect(result?.cause).toBe('Air-source heat pump beside Study');
  });

  it('calls the old house by a name rather than a grid reference', () => {
    const result = observationFor(writing, plan('wall-insulation'), 'GC3', FABRIC);
    expect(result?.cause).toBe('Internal wall insulation beside the old house');
  });

  it('names where it is standing for an orientation line, since nothing caused it', () => {
    const north = observationFor(writing, plan('glass-extension'), 'GC1', []);
    const south = observationFor(writing, plan('glass-extension'), 'GC3', []);
    expect(north?.kind).toBe('orientation');
    expect(north?.cause).toBe('Glass-roofed extension, facing the street');
    expect(south?.cause).toBe('Glass-roofed extension, at the back, onto the garden');
  });

  /**
   * §5 — rows 1 and 4 both face north, and the deck's writing is keyed on that
   * because what the sun does is the same in both. Where you are standing is
   * not: "facing the street" is a lie about a terrace at the bottom of the
   * garden, and the cause has to say the true one.
   */
  it('tells the street apart from the strip the house shadows', () => {
    const street = observationFor(writing, plan('terrace'), 'GC1', []);
    const shadow = observationFor(writing, plan('terrace'), 'GC4', []);

    // Same line, because the sun is doing the same thing in both...
    expect(shadow?.line).toBe(street?.line);
    // ...and a different cause, because they are not the same place to be.
    expect(street?.cause).toBe('Terrace, facing the street');
    expect(shadow?.cause).toBe('Terrace, in the shadow of the house');
  });

  it('lights the placement and the neighbour that fired', () => {
    const result = observationFor(writing, plan('home-farm'), 'GC4', beside('kitchen'));
    expect(result?.cell).toBe('GC4');
    expect(result?.because).toEqual(['GB3']);
  });

  it('lights every neighbour that fired, not just the first', () => {
    // Air conditioning speaks up beside anything, so both neighbours are in it.
    const result = observationFor(
      writing,
      plan('air-conditioning'),
      'GC3',
      beside('shed', 'lawn'),
    );
    expect(result?.because).toEqual(['GB3', 'GD3']);
    expect(result?.cause).toBe('Air conditioning unit beside Shed and Lawn');
  });

  it('lights only the neighbour that caused the quality that won', () => {
    // A bedroom between a gym and a shed. Noise outranks shade, and the gym is
    // where the noise is — so the shed is not part of what is being said.
    const result = observationFor(writing, plan('bedroom'), 'GC3', beside('gym', 'shed'));
    expect(result?.kind).toBe('quality');
    expect(result?.because).toEqual(['GB3']);
    expect(result?.cause).toBe('Bedroom beside Gym');
  });

  it('lights nothing next door for an orientation line — the row is the cause', () => {
    const result = observationFor(writing, plan('solar-array'), 'GC1', []);
    expect(result?.because).toEqual([]);
    expect(result?.cell).toBe('GC1');
  });

  it('says the old house once, however many old cells it is against', () => {
    const result = observationFor(writing, plan('wall-insulation'), 'GC3', [
      { kind: 'fabric', cell: 'GB3' },
      { kind: 'fabric', cell: 'GC2' },
    ]);
    expect(result?.cause).toBe('Internal wall insulation beside the old house');
    // …but both cells still light up, because both are what it is against.
    expect(result?.because).toEqual(['GB3', 'GC2']);
  });

  it('always has a cause, whatever fires', () => {
    for (const entry of deck) {
      for (const cell of ['GC1', 'GC3', 'GC5'] as const) {
        const result = observationFor(writing, entry, cell, beside('kitchen', 'bedroom'));
        if (result === null) continue;
        expect(result.cause.length).toBeGreaterThan(0);
        expect(result.cause).toContain(entry.name);
        // A pair or a quality line is always about something next door.
        if (result.kind !== 'orientation') {
          expect(result.because.length).toBeGreaterThan(0);
        }
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
    const north = ['GA1', 'GB1', 'GC1', 'GD1', 'GE1'] as const;
    for (const cell of north) {
      expect(lineFor(writing, plan('solar-array'), cell, [])).toBe(
        'A lovely gesture. Very little electricity.',
      );
    }
  });

  it('says nothing in row 3, which is neither street nor garden', () => {
    expect(lineFor(writing, plan('solar-array'), 'GC3', [])).toBeNull();
  });

  it('distinguishes the two ends of the plot', () => {
    const north = lineFor(writing, plan('glass-extension'), 'GC1', []);
    const south = lineFor(writing, plan('glass-extension'), 'GC5', []);
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
    expect(lineFor(writing, plan('air-conditioning'), 'GC3', beside('shed'))).toBe(line);
    expect(lineFor(writing, plan('air-conditioning'), 'GC3', beside('lawn'))).toBe(line);
    expect(lineFor(writing, plan('air-conditioning'), 'GC3', FABRIC)).toBe(line);
  });

  it('says nothing for air conditioning with no neighbour at all', () => {
    // "Beside anything" still needs something to be beside.
    expect(lineFor(writing, plan('air-conditioning'), 'GC3', [])).toBeNull();
  });

  it('reacts to the old solid walls, not to a room', () => {
    expect(lineFor(writing, plan('wall-insulation'), 'GC3', FABRIC)).toBe(
      'Warmer. And a damp risk you will be managing for a decade.',
    );
    expect(lineFor(writing, plan('wall-insulation'), 'GC3', beside('shed'))).toBeNull();
  });

  it('prefers a line naming both plans over a wildcard one', () => {
    // Air conditioning has a '*' rule; if a specific pair were ever written for
    // it, that must win. Checked here against the rule that enforces it.
    const specific = observationFor(
      writing,
      plan('heat-pump'),
      'GC3',
      beside('bedroom', 'shed'),
    );
    expect(specific?.line).toBe(
      'Quiet enough now. Less so at five in the morning in January.',
    );
    // …and the cause names the bedroom rather than everything next door.
    expect(specific?.cause).toBe('Air-source heat pump beside Bedroom');
    expect(specific?.because).toEqual(['GB3']);
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
