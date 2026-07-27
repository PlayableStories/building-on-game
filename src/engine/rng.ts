/**
 * A small seeded random number generator.
 *
 * The draw needs to be reproducible so that tests can assert on whole
 * playthroughs, and so that a playtester can be handed a seed and get the same
 * hands. `Math.random` cannot do either.
 *
 * mulberry32 — fast, tiny, and more than good enough for shuffling a 24-card
 * deck. It is not suitable for anything security-related, which nothing here is.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item at random. Returns undefined for an empty list. */
export function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}
