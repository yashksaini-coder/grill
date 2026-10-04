export type Lang = "rust" | "js";

/** A place in the candidate's own code worth asking about. */
export interface Hotspot {
  id: string;
  repo: string;
  /** Absolute path of the checkout the file was read from. */
  root: string;
  file: string;
  lang: Lang;
  /** 1-based line where the snippet starts. */
  startLine: number;
  snippet: string;
  /** The topic the weak-spot map files this under. */
  topic: string;
  /** Every pattern that fired inside the snippet. */
  tags: string[];
  /** What the interviewer should probe, one line per fired pattern. */
  angles: string[];
  score: number;
}

export interface Grade {
  /** 0 = no answer, 4 = what a senior engineer would say. */
  score: number;
  verdict: string;
  missed: string[];
  better: string;
}

export interface Round {
  hotspotId: string;
  repo: string;
  file: string;
  lang: Lang;
  topic: string;
  question: string;
  answer: string;
  followUp: string;
  followUpAnswer: string;
  grade: Grade;
  at: string;
}

export interface Session {
  startedAt: string;
  model: string;
  rounds: Round[];
}
