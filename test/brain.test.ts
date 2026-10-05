import assert from "node:assert/strict";
import { test } from "node:test";
import { extractJson, parseGrade, tidy } from "../src/interview/brain.js";
import { pick, priority } from "../src/interview/pick.js";
import { dropRepo, topicStats } from "../src/store.js";
import type { Hotspot, Round } from "../src/types.js";

test("extractJson survives fences, prose, and braces inside strings", () => {
  const reply = 'Sure!\n```json\n{"score": 2, "verdict": "uses {braces} and \\"quotes\\"", "missed": []}\n```\nHope that helps.';
  assert.deepEqual(extractJson(reply), { score: 2, verdict: 'uses {braces} and "quotes"', missed: [] });
  assert.throws(() => extractJson("no json here"));
  assert.throws(() => extractJson('{"score": 2'));
});

test("parseGrade coerces and bounds the score", () => {
  assert.deepEqual(parseGrade('{"score": "3", "verdict": "ok"}'), { score: 3, verdict: "ok", missed: [], better: "" });
  assert.equal(parseGrade('{"score": 2.6, "verdict": "ok"}').score, 3);
  assert.throws(() => parseGrade('{"score": 9, "verdict": "ok"}'));
  assert.throws(() => parseGrade('{"score": 2}'));
});

test("tidy strips labels and wrapping quotes", () => {
  assert.equal(tidy('Question: "Why hold the lock?"'), "Why hold the lock?");
  assert.equal(tidy("  Follow-up: And under load?\n"), "And under load?");
});

const spot = (id: string, topic: string, score = 4): Hotspot => ({
  id,
  repo: "r",
  root: "",
  file: "f.rs",
  lang: topic === "async" ? "js" : "rust",
  startLine: 1,
  snippet: "",
  topic,
  tags: [],
  angles: [],
  score,
});

const round = (hotspotId: string, topic: string, score: number, missed: string[] = []): Round => ({
  hotspotId,
  repo: "r",
  file: "f.rs",
  lang: "rust",
  topic,
  question: "",
  answer: "",
  followUp: "",
  followUpAnswer: "",
  grade: { score, verdict: "", missed, better: "" },
  at: "",
});

test("topicStats sorts worst first and keeps recent misses", () => {
  const stats = topicStats([round("a", "lifetimes", 1, ["variance"]), round("b", "lifetimes", 2), round("c", "unsafe", 4)]);
  assert.deepEqual(stats.map((s) => s.topic), ["lifetimes", "unsafe"]);
  assert.equal(stats[0]?.mean, 1.5);
  assert.deepEqual(stats[0]?.missed, ["variance"]);
});

test("weak topics outrank strong ones, repeats rank last", () => {
  const stats = topicStats([round("x", "lifetimes", 0), round("y", "unsafe", 4)]);
  const seen = new Set(["x", "y"]);
  const weak = priority(spot("new1", "lifetimes"), seen, stats);
  const untested = priority(spot("new2", "traits"), seen, stats);
  const strong = priority(spot("new3", "unsafe"), seen, stats);
  const repeat = priority(spot("x", "lifetimes"), seen, stats);
  assert.ok(weak > untested && untested > strong && strong > repeat);
});

test("pick filters by language and never repeats within a session", () => {
  const all = [spot("1", "unsafe"), spot("2", "traits"), spot("3", "async"), spot("4", "async")];
  const options = { seen: new Set<string>(), stats: [], random: () => 0.5 };
  const js = pick(all, 5, { ...options, lang: "js" });
  assert.deepEqual(js.map((s) => s.id).sort(), ["3", "4"]);
  assert.equal(new Set(pick(all, 4, options).map((s) => s.id)).size, 4);
});

test("a perfect score has no better answer to show", () => {
  const perfect = parseGrade('{"score": 4, "verdict": "Senior level.", "better": "The candidate was excellent."}');
  assert.equal(perfect.better, "");
  const partial = parseGrade('{"score": 3, "verdict": "Good.", "better": "Mention poisoning."}');
  assert.equal(partial.better, "Mention poisoning.");
});

test("dropRepo removes one repository by slug, URL, or local name", () => {
  const all = [spot("1", "unsafe"), { ...spot("2", "traits"), repo: "me/app" }, { ...spot("3", "unsafe"), repo: "local-dir" }];
  assert.deepEqual(dropRepo(all, "me/app").map((s) => s.id), ["1", "3"]);
  assert.deepEqual(dropRepo(all, "https://github.com/me/app.git").map((s) => s.id), ["1", "3"]);
  assert.deepEqual(dropRepo(all, "local-dir").map((s) => s.id), ["1", "2"]);
  assert.equal(dropRepo(all, "nobody/nothing").length, 3);
});
