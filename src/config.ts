import { homedir } from "node:os";
import { join } from "node:path";

/** Everything grill remembers lives here, on the candidate's own disk. */
export const HOME = process.env.GRILL_HOME ?? join(homedir(), ".grill");

export const paths = {
  repos: join(HOME, "repos"),
  hotspots: join(HOME, "hotspots.json"),
  sessions: join(HOME, "sessions"),
};

export interface ModelConfig {
  modelId: string;
  url: string;
}

/**
 * Any OpenAI-compatible local server works: Ollama, llama.cpp, LM Studio.
 * The default is Gemma on Ollama's default port.
 */
export const model: ModelConfig = {
  modelId: process.env.GRILL_MODEL ?? "gemma4",
  url: process.env.GRILL_URL ?? "http://localhost:11434/v1",
};
