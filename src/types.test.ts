import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  CONSENT_FLAGS,
  PLAN_TIERS,
  QUALITIES,
  ROWS,
  TIERS,
} from './types.ts';

/**
 * M0 smoke tests. These pin the vocabulary to the GDD so that a later milestone
 * cannot quietly widen it — the qualities in particular are deliberately nine
 * (§8.5), and the whole design leans on that being small.
 */
describe('vocabulary', () => {
  it('has exactly the nine qualities in §8.5', () => {
    expect(QUALITIES).toHaveLength(9);
    expect(new Set(QUALITIES).size).toBe(9);
  });

  it('has the five staged tiers in §6, plus a wildcard pool', () => {
    // The roof is last because a roof goes on last — and because roofing a cell
    // seals the first floor under it, which is the wrong move to open with.
    expect(TIERS).toEqual(['threshold', 'daily', 'private', 'outside', 'roof']);
    expect(PLAN_TIERS).toHaveLength(6);
  });

  it('has exactly the four consent flags in §9.1', () => {
    expect(CONSENT_FLAGS).toEqual([
      'permitted',
      'householder',
      'sensitive',
      'demolition',
    ]);
  });
});

describe('the plot', () => {
  it('is 5×5, columns A–E and rows 1–5 (§5)', () => {
    expect(COLUMNS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(ROWS).toEqual([1, 2, 3, 4, 5]);
    expect(COLUMNS.length * ROWS.length).toBe(25);
  });
});
