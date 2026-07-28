/**
 * Consent — GDD §9.
 *
 * §9.1 is the whole design: consent never succeeds or fails, and there is no
 * roll. A placement carries flags, and flags accumulate into an obligation
 * rather than into a verdict. Nothing in this file can return "refused".
 *
 * §9.2's `conservation: true` is applied here too, from overrides that live in
 * content — so the engine never learns what a conservation area is, only that
 * something may add a flag and a line.
 */
import type {
  CellId,
  Consent,
  ConservationOverrides,
  Orientation,
  Plan,
} from '../types.ts';
import { isStreetElevation } from './grid.ts';

export interface ConsentContent {
  /** §9.3 — one obligation per flag. */
  consentCare: Record<Consent, string>;
  /** §9.2 — what changes when conservation is on. */
  conservationOverrides: ConservationOverrides;
}

/** What one placement takes on. Flags in the order they were acquired. */
export interface ConsentResult {
  flags: Consent[];
  /**
   * Obligations this placement adds beyond its flags — the longer demolition
   * line under conservation, the glass extension's ridge height, and so on.
   */
  care: string[];
}

/**
 * §9.2 — "new openings in the north (street) elevation". A plan has an opening
 * on a given elevation if it has something to say about being on it: the
 * orientation writing in §8.3 is precisely the writing about light, view and
 * exposure, so a plan with a north line is a plan with a window on the street.
 */
export function hasOpening(plan: Plan, elevation: Orientation): boolean {
  return plan.orientation?.[elevation] !== undefined;
}

/**
 * §14 — the flag shown on a plan in hand.
 *
 * Only the plan's own, because that is all that is knowable before it lands:
 * where it goes and what it lands on change the application, and the player is
 * about to decide both. Conservation can change it, though, and the heat pump
 * needs to say so before it is chosen rather than afterwards.
 */
export function flagInHand(
  plan: Pick<Plan, 'id' | 'consent'>,
  conservation: boolean,
  overrides: ConservationOverrides,
): Consent {
  if (!conservation) return plan.consent;
  return overrides.plans[plan.id]?.consent ?? plan.consent;
}

/**
 * What a single placement takes on — §9.1, §9.2.
 *
 * The plan's own flag always stands. Demolition adds one, because taking the
 * old house down is a heavier process than whatever is being put in its place.
 * Conservation may add a third.
 *
 * Note that this is placement-dependent: the same plan on the street and in the
 * garden are not the same application. The flag shown on a plan in hand (§14) is
 * therefore the plan's own, which is all that is knowable before it lands.
 */
export function consentFor(
  plan: Plan,
  cell: CellId,
  demolished: boolean,
  conservation: boolean,
  content: ConsentContent,
): ConsentResult {
  const flags: Consent[] = [plan.consent];
  const care: string[] = [];
  const overrides = content.conservationOverrides;

  const add = (flag: Consent) => {
    if (!flags.includes(flag)) flags.push(flag);
  };

  if (demolished) add('demolition');

  if (conservation) {
    // §9.2 — a different flag on named plans. The heat pump's outdoor unit.
    const plans = overrides.plans[plan.id];
    if (plans?.consent) add(plans.consent);
    // …and an extra obligation on named plans. The glass extension's ridge.
    if (plans?.care) care.push(plans.care);

    // §9.2 — new openings in the street elevation. The street, specifically:
    // the shaded strip of garden faces north as well, and a lawn behind a house
    // is not an opening onto anything.
    if (isStreetElevation(cell) && hasOpening(plan, 'north')) {
      add(overrides.northOpening.consent);
      care.push(overrides.northOpening.care);
    }

    // §9.2 — demolition is heavier here, and asks more of you afterwards.
    if (demolished) {
      add(overrides.demolition.consent);
      care.push(overrides.demolition.care);
    }
  }

  return { flags, care };
}

/**
 * §9.3 — the obligations a finished house has taken on, worth saying first.
 *
 * Deduplicated: three householder applications are one ongoing relationship with
 * the local authority, not three. And ordered rather than merely collected,
 * because the report has room for two of these and the two it picks are the two
 * off the front of this list.
 *
 * The order is specific before general — the same principle §8.6 uses to rank
 * the adjacency lines. A condition agreed on this particular house says more
 * than the fact that an application was made, and the flag nobody had to apply
 * for says least of all, so the flags come last and heaviest first.
 *
 * Never placement order. The same finished house always reads the same way,
 * whatever sequence it was built in.
 */
export function consentCare(
  results: readonly ConsentResult[],
  order: readonly Consent[],
  lines: Record<Consent, string>,
): string[] {
  const care: string[] = [];
  const add = (line: string) => {
    if (!care.includes(line)) care.push(line);
  };

  // The obligations attached to a particular placement, in placement order.
  for (const result of results) {
    for (const line of result.care) add(line);
  }

  // Then one per flag the house took on anywhere, heaviest first.
  const taken = new Set(results.flatMap((result) => result.flags));
  for (const flag of [...order].reverse()) {
    if (taken.has(flag)) add(lines[flag]);
  }

  return care;
}
