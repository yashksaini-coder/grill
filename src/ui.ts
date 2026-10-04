import { createInterface, type Interface } from "node:readline";
import pc from "picocolors";
import type { Grade, Hotspot } from "./types.js";

export interface Io {
  say(text: string): void;
  /** Read a multi-line answer. An empty line sends it. */
  answer(): Promise<string>;
  close(): void;
}

export function terminal(): Io {
  const rl: Interface = createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  return {
    say: (text) => console.log(text),
    async answer() {
      const collected: string[] = [];
      process.stdout.write(pc.dim("  your answer, blank line to send, :skip or :quit\n"));
      for (;;) {
        process.stdout.write(pc.cyan("  > "));
        const next = await lines.next();
        if (next.done) return collected.join("\n") || ":quit";
        const line = next.value;
        if (collected.length === 0 && /^:(skip|quit)$/.test(line.trim())) return line.trim();
        if (line.trim() === "" && collected.length > 0) return collected.join("\n");
        if (line.trim() !== "") collected.push(line);
      }
    },
    close: () => rl.close(),
  };
}

export function renderSnippet(spot: Hotspot): string {
  const width = String(spot.startLine + spot.snippet.split("\n").length).length;
  const body = spot.snippet
    .split("\n")
    .map((line, i) => `${pc.dim(String(spot.startLine + i).padStart(width))} ${pc.dim("│")} ${line}`)
    .join("\n");
  return `${pc.bold(spot.repo)} ${pc.dim(`${spot.file}:${spot.startLine}`)}  ${pc.yellow(spot.topic)}\n${body}`;
}

export function bar(score: number, max = 4): string {
  const filled = Math.max(0, Math.min(max, Math.round(score)));
  return "█".repeat(filled) + pc.dim("░".repeat(max - filled));
}

export function renderGrade(grade: Grade): string {
  const colour = grade.score >= 3 ? pc.green : grade.score >= 2 ? pc.yellow : pc.red;
  const lines = [`${colour(bar(grade.score))} ${colour(`${grade.score}/4`)}  ${grade.verdict}`];
  for (const point of grade.missed) lines.push(`  ${pc.red("missed")} ${point}`);
  if (grade.better) lines.push(`  ${pc.green("better")} ${grade.better}`);
  return lines.join("\n");
}
