import type { TopicStat } from "../store.js";
import type { Hotspot, Lang } from "../types.js";

export interface PickOptions {
  lang?: Lang;
  /** Hotspot ids already asked, in any session. */
  seen: Set<string>;
  stats: TopicStat[];
  /** Injectable for tests. */
  random?: () => number;
}

/**
 * How much a spot deserves the next question. Weak topics come back more
 * often, untested topics get a look, and repeats are rare but possible.
 */
export function priority(spot: Hotspot, seen: Set<string>, stats: TopicStat[]): number {
  const stat = stats.find((s) => s.topic === spot.topic);
  const weakness = stat ? (4 - stat.mean) / 4 : 0.5;
  const repeat = seen.has(spot.id) ? 0.15 : 1;
  // Squared, so the first session opens on the richest code, not on filler.
  return spot.score ** 2 * (0.5 + weakness) * repeat;
}

/** Weighted draw without replacement. */
export function pick(hotspots: Hotspot[], count: number, options: PickOptions): Hotspot[] {
  const random = options.random ?? Math.random;
  const pool = hotspots
    .filter((spot) => !options.lang || spot.lang === options.lang)
    .map((spot) => ({ spot, weight: priority(spot, options.seen, options.stats) }));

  const chosen: Hotspot[] = [];
  while (chosen.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    let index = pool.findIndex((entry) => (roll -= entry.weight) <= 0);
    if (index < 0) index = pool.length - 1;
    const [entry] = pool.splice(index, 1);
    if (entry) chosen.push(entry.spot);
  }
  return chosen;
}
