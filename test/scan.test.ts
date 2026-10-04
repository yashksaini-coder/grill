import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSlug } from "../src/ingest/clone.js";
import { scanText } from "../src/ingest/scan.js";

const RUST = `use std::sync::{Arc, Mutex};

// .unwrap() in a comment must not count
pub async fn record(state: Arc<Mutex<Vec<u8>>>, chunk: &[u8]) -> usize {
    let mut guard = state.lock().unwrap();
    guard.extend_from_slice(chunk);
    let total = guard.len();
    flush(total as u32).await;
    total
}

fn quiet() -> u8 {
    1
}
`;

const TSX = `export function useTicker(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, []);
  return n;
}

export async function saveAll(items: Item[]) {
  items.forEach(async (item) => {
    await save(item);
  });
}
`;

test("rust: finds the function holding a lock and frames the whole function", () => {
  const spots = scanText("me/app", "src/audio.rs", RUST);
  assert.equal(spots.length, 1);
  const [spot] = spots;
  assert.ok(spot);
  assert.equal(spot.lang, "rust");
  assert.equal(spot.startLine, 4);
  assert.match(spot.snippet, /^pub async fn record/);
  assert.match(spot.snippet, /\n}$/);
  assert.deepEqual(new Set(spot.tags), new Set(["shared-state", "lock", "async-fn", "unwrap", "cast"]));
  assert.ok(["shared-state", "concurrency"].includes(spot.topic));
  assert.equal(spot.angles.length, 3);
});

test("rust: boring code produces nothing", () => {
  assert.deepEqual(scanText("me/app", "src/lib.rs", "fn quiet() -> u8 {\n    1\n}\n"), []);
});

test("js: one spot per function, with the right topic", () => {
  const spots = scanText("me/web", "src/hooks.tsx", TSX);
  assert.equal(spots.length, 2);
  const ticker = spots.find((s) => s.snippet.includes("useTicker"));
  const save = spots.find((s) => s.snippet.includes("saveAll"));
  assert.ok(ticker && save);
  assert.equal(ticker.topic, "react-effects");
  assert.ok(ticker.tags.includes("timer"));
  assert.equal(save.topic, "async");
  assert.deepEqual(save.tags, ["async-in-loop"]);
});

test("spots in one file never overlap", () => {
  for (const [file, text] of [["a.rs", RUST], ["a.tsx", TSX]] as const) {
    const spots = scanText("r", file, text)
      .map((s) => [s.startLine, s.startLine + s.snippet.split("\n").length - 1] as const)
      .sort((a, b) => a[0] - b[0]);
    assert.ok(spots.length > 0);
    for (let i = 1; i < spots.length; i++) assert.ok(spots[i]![0] > spots[i - 1]![1]);
  }
});

test("a tiny function is shown with its surroundings", () => {
  const text = "class Loop {\n  private raf = 0;\n\n  constructor() {\n    this.loop = this.loop.bind(this);\n    this.raf = requestAnimationFrame(this.loop);\n  }\n\n  stop() {}\n}\n";
  const [spot] = scanText("r", "loop.ts", text);
  assert.ok(spot);
  assert.equal(spot.startLine, 1);
  assert.match(spot.snippet, /class Loop/);
  assert.match(spot.snippet, /stop\(\)/);
});

test("ids are stable across scans", () => {
  assert.equal(scanText("r", "a.rs", RUST)[0]?.id, scanText("r", "a.rs", RUST)[0]?.id);
});

test("unsupported files are ignored", () => {
  assert.deepEqual(scanText("r", "README.md", RUST), []);
  assert.deepEqual(scanText("r", "types.d.ts", TSX), []);
});

test("parseSlug accepts the forms people paste", () => {
  assert.equal(parseSlug("AkashJana18/miccli"), "AkashJana18/miccli");
  assert.equal(parseSlug("https://github.com/AkashJana18/miccli"), "AkashJana18/miccli");
  assert.equal(parseSlug("https://github.com/AkashJana18/miccli.git"), "AkashJana18/miccli");
  assert.equal(parseSlug("git@github.com:AkashJana18/miccli.git"), "AkashJana18/miccli");
  assert.equal(parseSlug("miccli"), undefined);
});
