import type { Lang } from "../types.js";

const MAX_LINES = 60;
const MIN_LINES = 5;
const PAD = 4;
const LOOK_BACK = 80;
const FALLBACK_RADIUS = 10;

const FN_START: Record<Lang, RegExp> = {
  rust: /^\s*(pub(\([^)]*\))?\s+)?(default\s+)?(const\s+)?(async\s+)?(unsafe\s+)?(extern\s+"[^"]*"\s+)?fn\s+\w+|^\s*impl\b|^\s*(pub(\([^)]*\))?\s+)?(struct|enum|trait)\s+\w+/,
  js: /^\s*(export\s+)?(default\s+)?(async\s+)?function\b|^\s*(export\s+)?(const|let|var)\s+\w+[^=]*=\s*(async\s*)?(\([^)]*\)|\w+)\s*(:\s*[^=]+)?=>|^\s*(public|private|protected|static|async|get|set|\s)*\s*\w+\s*\([^)]*\)\s*(:\s*[^{]+)?\{\s*$/,
};

export interface Snippet {
  /** 0-based index of the first line. */
  start: number;
  /** 0-based index of the last line, inclusive. */
  end: number;
}

/**
 * Find the function that encloses `line`. Brace counting is naive (it ignores
 * strings and comments), which is good enough to frame a snippet for a human.
 */
export function enclosing(lines: string[], line: number, lang: Lang): Snippet {
  const startRe = FN_START[lang];
  for (let i = line; i >= Math.max(0, line - LOOK_BACK); i--) {
    const text = lines[i] ?? "";
    if (!startRe.test(text) || /^\s*(if|for|while|switch|catch|else)\b/.test(text)) continue;
    const end = matchBraces(lines, i);
    if (end === undefined || end < line) continue;
    if (lang === "rust" && /^\s*impl\b/.test(text) && end - i + 1 > MAX_LINES) continue;
    return clamp(i, end, line);
  }
  return {
    start: Math.max(0, line - FALLBACK_RADIUS),
    end: Math.min(lines.length - 1, line + FALLBACK_RADIUS),
  };
}

function matchBraces(lines: string[], from: number): number | undefined {
  let depth = 0;
  let opened = false;
  for (let i = from; i < lines.length; i++) {
    for (const ch of lines[i] ?? "") {
      if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (opened && depth <= 0) return i;
    // A one-line arrow function or a declaration without a body.
    if (!opened && i > from + 3) return undefined;
  }
  return undefined;
}

/**
 * A three-line function needs its surroundings to be worth a question.
 * Applied after overlap checks, so padding never costs a neighbouring spot.
 */
export function pad(snippet: Snippet, total: number): Snippet {
  if (snippet.end - snippet.start + 1 >= MIN_LINES) return snippet;
  return { start: Math.max(0, snippet.start - PAD), end: Math.min(total - 1, snippet.end + PAD) };
}

/** Keep the snippet short enough to read in a terminal, centred on the match. */
function clamp(start: number, end: number, line: number): Snippet {
  if (end - start + 1 <= MAX_LINES) return { start, end };
  const half = Math.floor(MAX_LINES / 2);
  const from = Math.max(start, Math.min(line - half, end - MAX_LINES + 1));
  return { start: from, end: from + MAX_LINES - 1 };
}
