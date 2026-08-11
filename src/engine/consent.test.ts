import { describe, expect, it } from 'vitest';
import {
  consentLabels,
  consentOrder,
  conservationOverrides,
  deck,
  obligationLines,
} from '../content.ts';
import { CONSENT_FLAGS, type Consent, type Plan } from '../types.ts';
import {
  type ConsentContent,
  type HouseConsent,
  consentCare,
  consentFor,
  flagInHand,
  hasOpening,
} from './consent.ts';

const content: ConsentContent = {
  obligationLines,
  conservationOverrides,
};

/** §9.3 — a finished house, for the obligation selection to read. */
function house(over: Partial<HouseConsent> = {}): HouseConsent {
  return {
    flags: new Set<Consent>(['permitted', 'householder']),
    fabric: 'all',
    applications: 1,
    conservation: false,
    ...over,
  };
}

/** The obligation line written for exactly this flag and nothing else. */
function only(flag: Consent): string {
  const found = obligationLines.find(
    (entry) =>
      entry.flag === flag &&
      entry.fabric === undefined &&
      entry.minApplications === undefined &&
      entry.conservation === undefined,
  );
  if (!found) throw new Error(`no unconditional line for "${flag}"`);
  return found.line;
}

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
      ...obligationLines.map((entry) => entry.line),
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
      // §9.3 — a flag with no writing at all is a flag a house can take on and
      // never be told about.
      expect(obligationLines.some((entry) => entry.flag === flag)).toBe(true);
      expect(consentLabels[flag]?.length).toBeGreaterThan(0);
    }
    expect([...consentOrder].sort()).toEqual([...CONSENT_FLAGS].sort());
  });

  it('carries the plan’s own flag when nothing complicates it', () => {
    expect(taken('kitchen', 'GC4')).toEqual([plan('kitchen').consent]);
    expect(taken('shed', 'GE5')).toEqual([plan('shed').consent]);
  });

  it('adds a demolition flag when the old house came down (§7.2)', () => {
    expect(taken('kitchen', 'GC3')).toEqual([plan('kitchen').consent]);
    expect(taken('kitchen', 'GC3', true)).toContain('demolition');
  });

  it('never repeats a flag', () => {
    // The glass extension is already `sensitive`; conservation would add it
    // again on the street, and once is once.
    const flags = taken('glass-extension', 'GC1', false, true);
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
    expect(taken('bedroom', 'GC1')).not.toContain('sensitive');
    expect(taken('bedroom', 'GC1', false, true)).toContain('sensitive');
  });

  it('…on the street rows only, and only for a plan with an opening', () => {
    // Row 5 is the garden. Same plan, same flag as without conservation.
    expect(taken('bedroom', 'GC5', false, true)).toEqual(taken('bedroom', 'GC5'));
    // The bin store has nothing to say about any elevation: no opening.
    expect(hasOpening(plan('bin-store'), 'north')).toBe(false);
    expect(taken('bin-store', 'GC1', false, true)).toEqual(taken('bin-store', 'GC1'));
  });

  /**
   * This used to raise the heat pump's flag. It no longer does: the flag is
   * already `sensitive` on the evidence in PLANNING-DATA.md — 35.5% of air
   * source heat pump applications are conditioned — so an override could only
   * have moved it down. What conservation adds here is the obligation, not the
   * flag, which is the honest version: it does not change whether you ask, it
   * changes what you end up agreeing to.
   */
  it('2. tells the heat pump where it may stand, without changing its flag', () => {
    expect(taken('heat-pump', 'GC4')).toEqual(['sensitive']);
    expect(taken('heat-pump', 'GC4', false, true)).toEqual(['sensitive']);

    expect(consentFor(plan('heat-pump'), 'GC4', false, false, content).care).toEqual([]);
    expect(consentFor(plan('heat-pump'), 'GC4', false, true, content).care).toHaveLength(1);
  });

  it('3. makes demolition sensitive, and says much more about it', () => {
    const ordinary = consentFor(plan('kitchen'), 'GC3', true, false, content);
    const preserved = consentFor(plan('kitchen'), 'GC3', true, true, content);

    expect(ordinary.flags).not.toContain('sensitive');
    expect(preserved.flags).toContain('sensitive');
    expect(preserved.flags).toContain('demolition');

    expect(ordinary.care).toEqual([]);
    expect(preserved.care).toContain(conservationOverrides.demolition.care);
    // "A much longer care line" — §9.2 asks for it in those words.
    expect(conservationOverrides.demolition.care.length).toBeGreaterThan(
      only('demolition').length,
    );
  });

  it('4. gives the glass extension its ridge height line', () => {
    const ridge = conservationOverrides.plans['glass-extension']?.care as string;
    expect(ridge).toMatch(/ridge/i);
    expect(consentFor(plan('glass-extension'), 'GC4', false, false, content).care).toEqual(
      [],
    );
    expect(
      consentFor(plan('glass-extension'), 'GC4', false, true, content).care,
    ).toContain(ridge);
  });

  it('changes nothing at all for a plan it does not name, away from the street', () => {
    for (const entry of deck) {
      if (entry.id === 'heat-pump' || entry.id === 'glass-extension') continue;
      const off = consentFor(entry, 'GC4', false, false, content);
      const on = consentFor(entry, 'GC4', false, true, content);
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
      consentFor(plan('kitchen'), 'GC4', false, false, content),
      consentFor(plan('bathroom'), 'FC2', false, false, content),
      consentFor(plan('bedroom'), 'FD2', false, false, content),
    ];
    const care = consentCare(three, consentOrder, obligationLines, house());

    // Three householder applications, and the drawings are mentioned once.
    expect(care.filter((line) => line === only('householder'))).toHaveLength(1);
  });

  /**
   * §9.3 — the rule the whole selection was rewritten around.
   *
   * The report has room for two of these, and before this they were keyed on
   * the four consent flags alone: 337 games in 400 spent both lines on
   * demolition, saying the same fact twice. A subject may be spoken about once.
   */
  it('never says two things about the same subject', () => {
    const razed = [consentFor(plan('kitchen'), 'GC3', true, false, content)];
    const care = consentCare(razed, consentOrder, obligationLines, {
      ...house(),
      flags: new Set<Consent>(['permitted', 'householder', 'demolition']),
      fabric: 'some',
    });

    const demolition = obligationLines
      .filter((entry) => entry.subject === 'demolition')
      .map((entry) => entry.line);
    expect(demolition.length).toBeGreaterThan(1);
    expect(care.filter((line) => demolition.includes(line))).toHaveLength(1);
  });

  /**
   * §9.3 — the most specific writing that fits, the same way `closingLine`
   * chooses. A house with nothing old left in it has a truer thing to be told
   * about demolition than the general line.
   */
  it('prefers the line written for this house over the general one', () => {
    const razed = [consentFor(plan('kitchen'), 'GC3', true, false, content)];
    const flags = new Set<Consent>(['permitted', 'householder', 'demolition']);

    const gutted = consentCare(razed, consentOrder, obligationLines, {
      ...house(),
      flags,
      fabric: 'none',
    });
    const partly = consentCare(razed, consentOrder, obligationLines, {
      ...house(),
      flags,
      fabric: 'some',
    });

    expect(gutted).not.toEqual(partly);
    expect(gutted[0]).not.toBe(only('demolition'));
    expect(partly[0]).not.toBe(only('demolition'));
  });

  it('says nothing a house has not actually taken on', () => {
    const nothing = consentCare([], consentOrder, obligationLines, {
      ...house(),
      flags: new Set<Consent>(['permitted']),
    });
    expect(nothing).not.toContain(only('demolition'));
    expect(nothing).not.toContain(only('sensitive'));
    // …and still says something, because every house has taken something on.
    expect(nothing.length).toBeGreaterThan(0);
  });

  it('puts an obligation agreed on this house before the general ones', () => {
    // The same principle §8.6 uses to rank the adjacency lines: a condition on
    // this particular roof says more than the fact that an application exists.
    const placements = [consentFor(plan('glass-extension'), 'GC1', false, true, content)];
    const care = consentCare(placements, consentOrder, obligationLines, {
      ...house(),
      flags: new Set<Consent>(['permitted', 'householder', 'sensitive']),
      conservation: true,
    });
    const ridge = conservationOverrides.plans['glass-extension']?.care as string;

    expect(care.slice(0, 2)).toContain(ridge);
    expect(care.slice(0, 2)).toContain(conservationOverrides.northOpening.care);
  });

  it('says nothing twice', () => {
    const both = [
      consentFor(plan('glass-extension'), 'GC1', false, true, content),
      consentFor(plan('bedroom'), 'FB2', false, true, content),
    ];
    const care = consentCare(both, consentOrder, obligationLines, {
      ...house(),
      conservation: true,
    });
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

  /**
   * No plan in *this* content carries a consent override any more — the heat
   * pump's was dropped when its base flag became `sensitive`. So the mechanism
   * is tested against a fixture rather than against the deck, which is where it
   * belonged all along: a fork is free to write one, and this proves it works.
   */
  it('picks up a conservation override that is knowable before placement', () => {
    const overrides = {
      ...conservationOverrides,
      plans: { bedroom: { consent: 'sensitive' as const } },
    };

    expect(flagInHand(plan('bedroom'), true, overrides)).toBe('sensitive');
    // …and only when conservation is on.
    expect(flagInHand(plan('bedroom'), false, overrides)).toBe(plan('bedroom').consent);
    // Everything else is unchanged: the street rule depends on the cell.
    expect(flagInHand(plan('porch'), true, overrides)).toBe(plan('porch').consent);
  });

  it('shows every plan its own flag under this content, conservation or not', () => {
    for (const entry of deck) {
      expect(flagInHand(entry, true, conservationOverrides)).toBe(entry.consent);
    }
  });
});
