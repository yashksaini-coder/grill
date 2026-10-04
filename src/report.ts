import pc from "picocolors";
import type { TopicStat } from "./store.js";
import { bar } from "./ui.js";

/** The weak-spot map: topics sorted worst first, with what was missed. */
export function renderReport(stats: TopicStat[]): string {
  if (stats.length === 0) return "No rounds yet. Run `grill start` first.";
  const width = Math.max(...stats.map((s) => s.topic.length));
  const lines = [pc.bold("Weak spots, worst first"), ""];
  for (const stat of stats) {
    const rounds = `${stat.rounds} round${stat.rounds === 1 ? "" : "s"}`;
    lines.push(`${stat.topic.padEnd(width)}  ${bar(stat.mean)} ${stat.mean.toFixed(1)}  ${pc.dim(rounds)}`);
    for (const point of stat.missed) lines.push(`${" ".repeat(width)}  ${pc.dim(`· ${point}`)}`);
  }
  return lines.join("\n");
}
