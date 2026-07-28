import { describe, expect, it } from 'vitest';
import {
  conservationOverrides,
  consentCare as consentCareLines,
  consentLabels,
  consentOrder,
  deck,
} from '../content.ts';
import { CONSENT_FLAGS, type Consent, type Plan } from '../types.ts';
import {
  type ConsentContent,
  consentCare,
  consentFor,
  flagInHand,
  hasOpening,
} from './consent.ts';

const content: ConsentContent = {
  consentCare: consentCareLines,
  conservationOverrides,
};

function plan(id: string): Plan {
  const found = deck.find((entry) => entry.id === id);
  if (!found) throw new Error(`no plan "${id}" in the deck`);
  return found;
}

/** What one placement takes on, with conservation off unless asked for. */
function taken(
  id: string,
  cell: string,
  demolished = false,
  conservation = false,
): Consent[] {
  return consentFor(plan(id), cell as never, demolished, conservation, content).flags;
}

/* ------------------------------------------------------------------ *
 * Flags, not outcomes — §9.1
 * ------------------------------------------------------------------ */

describe('consent is a flag, never an outcome (§9.1)', () => {
  it('gives every plan one of the four flags, and nothing else', () => {
    for (const entry of deck) {
      expect(CONSENT_FLAGS).toContain(entry.consent);
    }
  });

  it('never says an application succeeded or failed', () => {
    const everything = [
      ...Object.values(consentCareLines),
      ...Object.values(consentLabels),
      conservationOverrides.northOpening.care,
      conservationOverrides.demolition.care,
      ...Object.values(conservationOverrides.plans).flatMap((entry) =>
        entry.care ? [entry.care] : [],
      ),
    ].join(' ');

    expect(everything).not.toMatch(
      /\brefus|\bapproved\b|\bgranted\b|\brejected\b|\bfail|\bsucce|\bdenied\b/i,
    );
  });

  it('has a line and a label for every flag', () => {
    for (const flag of CONSENT_FLAGS) {
      expect(consentCareLines[flag]?.length).toBeGreaterThan(0);
      expect(consentLabels[flag]?.length).toBeGreaterThan(0);
    }
    expect([...consentOrder].sort()).toEqual([...CONSENT_FLAGS].sort());
  });

  it('carries the plan’s own flag when nothing complicates it', () => {
    expect(taken('kitchen', 'C4')).toEqual([plan('kitchen').consent]);
    expect(taken('shed', 'E5')).toEqual([plan('shed').consent]);
  });

  it('adds a demolition flag when the old house came down (§7.2)', () => {
    expect(taken('kitchen', 'C3')).toEqual([plan('kitchen').consent]);
    expect(taken('kitchen', 'C3', true)).toContain('demolition');
  });

  it('never repeats a flag', () => {
    // The glass extension is already `sensitive`; conservation would add it
    // again on the street, and once is once.
    const flags = taken('glass-extension', 'C1', false, true);
    expect(new Set(flags).size).toBe(flags.length);
  });
});

/* ------------------------------------------------------------------ *
 * Preservation — §9.2
 * ------------------------------------------------------------------ */

describe('conservation changes four things, and only four (§9.2)', () => {
  it('1. makes a new opening in the street elevation sensitive', () => {
    // The bedroom has a north line, so it has a window on that elevation.
    expect(hasOpening(plan('bedroom'), 'north')).toBe(true);
    expect(taken('bedroom', 'C1')).not.toContain('sensitive');
    expect(taken('bedroom', 'C1', false, true)).toContain('sensitive');
  });

  it('…on the street rows only, and only for a plan with an opening', () => {
    // Row 5 is the garden. Same plan, same flag as without conservation.
    expect(taken('bedroom', 'C5', false, true)).toEqual(taken('bedroom', 'C5'));
    // The bin store has nothing to say about any elevation: no opening.
    expect(hasOpening(plan('bin-store'), 'north')).toBe(false);
    expect(taken('bin-store', 'C1', false, true)).toEqual(taken('bin-store', 'C1'));
  });

  it('2. makes the heat pump a householder application', () => {
    expect(taken('heat-pump', 'C4')).toEqual(['permitted']);
    expect(taken('heat-pump', 'C4', false, true)).toContain('householder');
  });

  it('3. makes demolition sensitive, and says much more about it', () => {
    const ordinary = consentFor(plan('kitchen'), 'C3', true, false, content);
    const preserved = consentFor(plan('kitchen'), 'C3', true, true, content);

    expect(ordinary.flags).not.toContain('sensitive');
    expect(preserved.flags).toContain('sensitive');
    expect(preserved.flags).toContain('demolition');

    expect(ordinary.care).toEqual([]);
    expect(preserved.care).toContain(conservationOverrides.demolition.care);
    // "A much longer care line" — §9.2 asks for it in those words.
    expect(conservationOverrides.demolition.care.length).toBeGreaterThan(
      consentCareLines.demolition.length,
    );
  });

  it('4. gives the glass extension its ridge height line', () => {
    const ridge = conservationOverrides.plans['glass-extension']?.care as string;
    expect(ridge).toMatch(/ridge/i);
    expect(consentFor(plan('glass-extension'), 'C4', false, false, content).care).toEqual(
      [],
    );
    expect(
      consentFor(plan('glass-extension'), 'C4', false, true, content).care,
    ).toContain(ridge);
  });

  it('changes nothing at all for a plan it does not name, away from the street', () => {
    for (const entry of deck) {
      if (entry.id === 'heat-pump' || entry.id === 'glass-extension') continue;
      const off = consentFor(entry, 'C4', false, false, content);
      const on = consentFor(entry, 'C4', false, true, content);
      expect(on.flags).toEqual(off.flags);
      expect(on.care).toEqual(off.care);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Where consent lands — §9.3
 * ------------------------------------------------------------------ */

describe('the obligations the house takes on (§9.3)', () => {
  it('says a repeated flag once — one relationship, not three', () => {
    const three = [
      consentFor(plan('kitchen'), 'C4', false, false, content),
      consentFor(plan('bathroom'), 'C5', false, false, content),
      consentFor(plan('bedroom'), 'D4', false, false, content),
    ];
    const care = consentCare(three, consentOrder, consentCareLines);

    expect(care).toEqual([consentCareLines.householder]);
  });

  it('reads them in the documented order, not in placement order', () => {
    const placements = [
      consentFor(plan('glass-extension'), 'C4', false, false, content),
      consentFor(plan('shed'), 'E5', false, false, content),
      consentFor(plan('kitchen'), 'C3', true, false, content),
    ];
    const care = consentCare(placements, consentOrder, consentCareLines);

    expect(care).toEqual([
      consentCareLines.permitted,
      consentCareLines.householder,
      consentCareLines.sensitive,
      consentCareLines.demolition,
    ]);
  });

  it('adds the extra obligations after the flags they came with', () => {
    const placements = [consentFor(plan('glass-extension'), 'C1', false, true, content)];
    const care = consentCare(placements, consentOrder, consentCareLines);
    const ridge = conservationOverrides.plans['glass-extension']?.care as string;

    expect(care[0]).toBe(consentCareLines.sensitive);
    expect(care).toContain(ridge);
    expect(care).toContain(conservationOverrides.northOpening.care);
  });

  it('says nothing twice', () => {
    const both = [
      consentFor(plan('glass-extension'), 'C1', false, true, content),
      consentFor(plan('bedroom'), 'B1', false, true, content),
    ];
    const care = consentCare(both, consentOrder, consentCareLines);
    expect(new Set(care).size).toBe(care.length);
  });
});

/* ------------------------------------------------------------------ *
 * The flag in hand — §14
 * ------------------------------------------------------------------ */

describe('the flag on a plan in hand (§14)', () => {
  it('is the plan’s own, because where it goes is not decided yet', () => {
    for (const entry of deck) {
      expect(flagInHand(entry, false, conservationOverrides)).toBe(entry.consent);
    }
  });

  it('picks up a conservation override that is knowable before placement', () => {
    expect(flagInHand(plan('heat-pump'), true, conservationOverrides)).toBe('householder');
    // Everything else is unchanged: the street rule depends on the cell.
    expect(flagInHand(plan('bedroom'), true, conservationOverrides)).toBe(
      plan('bedroom').consent,
    );
  });
});
