import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Hotspot } from "../types.js";
import { langOf, PATTERNS, type Pattern } from "./patterns.js";
import { enclosing, pad } from "./snippet.js";

const SKIP_DIRS = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  "out",
  ".git",
  ".next",
  "vendor",
  "coverage",
  "__generated__",
  "generated",
]);
const MAX_FILE_BYTES = 200_000;
const MIN_SCORE = 3;

export function listSourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && langOf(entry.name) && statSync(full).size <= MAX_FILE_BYTES) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found.sort();
}

/** Scan one file's text. Exported so tests can run it without a filesystem. */
export function scanText(repo: string, file: string, text: string, root = ""): Hotspot[] {
  const lang = langOf(file);
  if (!lang) return [];
  const lines = text.split(/\r?\n/);
  const patterns = PATTERNS.filter((p) => p.lang === lang);
  const byStart = new Map<number, { end: number; hits: Map<string, Pattern> }>();

  lines.forEach((line, i) => {
    if (isComment(line)) return;
    for (const pattern of patterns) {
      if (!pattern.re.test(line)) continue;
      const { start, end } = enclosing(lines, i, lang);
      const spot = byStart.get(start) ?? { end, hits: new Map<string, Pattern>() };
      spot.end = Math.max(spot.end, end);
      spot.hits.set(pattern.tag, pattern);
      byStart.set(start, spot);
    }
  });

  const candidates = [...byStart.entries()]
    .map(([start, { end, hits }]) => {
      const fired = [...hits.values()].sort((a, b) => b.weight - a.weight);
      return { start, end, fired, score: fired.reduce((sum, p) => sum + p.weight, 0) };
    })
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.start - b.start);

  // Windows can overlap (a closure inside a function, or two fallback windows
  // a line apart). Keep the strongest and drop anything that touches it.
  const kept: typeof candidates = [];
  for (const c of candidates) {
    if (!kept.some((k) => c.start <= k.end && k.start <= c.end)) kept.push(c);
  }

  const hotspots: Hotspot[] = [];
  for (const { start, end, fired, score } of kept) {
    const top = fired[0];
    if (!top) continue;
    const shown = pad({ start, end }, lines.length);
    hotspots.push({
      id: createHash("sha1").update(`${repo}:${file}:${start}`).digest("hex").slice(0, 10),
      repo,
      root,
      file,
      lang,
      startLine: shown.start + 1,
      snippet: lines.slice(shown.start, shown.end + 1).join("\n"),
      topic: top.topic,
      tags: fired.map((p) => p.tag),
      angles: fired.slice(0, 3).map((p) => p.angle),
      score,
    });
  }
  return hotspots;
}

export function scanRepo(repo: string, root: string, limit = 40): Hotspot[] {
  const all = listSourceFiles(root).flatMap((path) =>
    scanText(repo, relative(root, path), readFileSync(path, "utf8"), root),
  );
  return spread(all, limit);
}

/**
 * Take the strongest spots, but round-robin across topics so one repo full of
 * `.unwrap()` does not turn the whole interview into error handling.
 */
function spread(hotspots: Hotspot[], limit: number): Hotspot[] {
  const byTopic = new Map<string, Hotspot[]>();
  for (const spot of [...hotspots].sort((a, b) => b.score - a.score)) {
    const bucket = byTopic.get(spot.topic) ?? [];
    bucket.push(spot);
    byTopic.set(spot.topic, bucket);
  }
  const picked: Hotspot[] = [];
  while (picked.length < limit) {
    let took = false;
    for (const bucket of byTopic.values()) {
      const next = bucket.shift();
      if (!next) continue;
      picked.push(next);
      took = true;
      if (picked.length === limit) break;
    }
    if (!took) break;
  }
  return picked;
}

function isComment(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}
