import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export interface Source {
  /** Display name, `owner/repo` for remotes or the folder name for local paths. */
  repo: string;
  /** Directory to scan. */
  root: string;
}

/**
 * Turn a CLI argument into something to scan. Accepts a local directory,
 * `owner/repo`, or a full git URL. Remotes are shallow-cloned once and pulled
 * on later runs.
 */
export function resolveSource(arg: string, reposDir: string): Source {
  if (existsSync(arg) && statSync(arg).isDirectory()) {
    const root = resolve(arg);
    return { repo: basename(root), root };
  }

  const slug = parseSlug(arg);
  if (!slug) throw new Error(`Not a directory, owner/repo, or git URL: ${arg}`);

  mkdirSync(reposDir, { recursive: true });
  const root = join(reposDir, slug.replace("/", "__"));
  const url = arg.includes("://") || arg.startsWith("git@") ? arg : `https://github.com/${slug}.git`;

  if (existsSync(join(root, ".git"))) {
    git(["-C", root, "pull", "--ff-only", "--depth", "1"], true);
  } else {
    git(["clone", "--depth", "1", url, root]);
  }
  return { repo: slug, root };
}

export function parseSlug(arg: string): string | undefined {
  const match = arg
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)$/);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

function git(args: string[], tolerate = false): void {
  try {
    execFileSync("git", args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    if (tolerate) return;
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`git ${args[0]} failed: ${stderr || (error as Error).message}`);
  }
}
