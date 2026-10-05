import { z } from "zod";
import type { Grade, Hotspot } from "../types.js";

/** The part of the interview that needs a model. */
export interface Brain {
  readonly name: string;
  question(spot: Hotspot): Promise<string>;
  followUp(spot: Hotspot, question: string, answer: string): Promise<string>;
  grade(spot: Hotspot, exchange: Exchange): Promise<Grade>;
}

export interface Exchange {
  question: string;
  answer: string;
  followUp: string;
  followUpAnswer: string;
}

export const gradeSchema = z.object({
  score: z.coerce.number().min(0).max(4),
  verdict: z.string().min(1),
  missed: z.array(z.string()).default([]),
  better: z.string().default(""),
});

/**
 * Small local models wrap JSON in prose or code fences. Pull out the first
 * balanced object instead of trusting the whole reply.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("no JSON object in reply");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("unbalanced JSON object in reply");
}

export function parseGrade(text: string): Grade {
  const parsed = gradeSchema.parse(extractJson(text));
  const score = Math.round(parsed.score);
  // 4 means nothing was missing, so there is no better answer to show.
  return { ...parsed, score, better: score === 4 ? "" : parsed.better };
}

/** Models like to open with "Sure!" or wrap the question in quotes. */
export function tidy(text: string): string {
  return text
    .trim()
    .replace(/^(question|follow[- ]?up)\s*:\s*/i, "")
    .replace(/^["“](.*)["”]$/s, "$1")
    .trim();
}

export function describe(spot: Hotspot): string {
  const fence = spot.lang === "rust" ? "rust" : "ts";
  return [
    `Repository: ${spot.repo}`,
    `File: ${spot.file} (starting at line ${spot.startLine})`,
    "```" + fence,
    spot.snippet,
    "```",
    "Things worth probing in this code:",
    ...spot.angles.map((angle) => `- ${angle}`),
  ].join("\n");
}
