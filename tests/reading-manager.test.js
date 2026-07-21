const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const model = require("../reading/reading-manager.js");

test("normalizes the legacy reading schema without losing content", () => {
  const entry = model.normalizeEntry({
    title: "A Practical Guide",
    author: "OpenAI",
    date: "2026-07-20",
    status: "want",
    theme: "AI Agents",
    link: "https://example.com/guide",
  }, "2026-07-21");

  assert.deepEqual(entry, {
    id: "a-practical-guide",
    title: "A Practical Guide",
    creator: "OpenAI",
    url: "https://example.com/guide",
    type: "article",
    status: "want",
    topics: ["AI Agents"],
    added_at: "2026-07-20",
    started_at: null,
    finished_at: null,
    updated_at: "2026-07-20",
  });
});

test("validates required fields and supported values", () => {
  const valid = model.normalizeEntry({
    title: "Designing Data-Intensive Applications",
    creator: "Martin Kleppmann",
    url: "https://example.com/ddia",
    type: "book",
    status: "reading",
    topics: ["Systems"],
  }, "2026-07-21");
  assert.deepEqual(model.validateEntry(valid), []);

  const errors = model.validateEntry({ ...valid, title: "", url: "javascript:alert(1)", type: "thread", status: "paused" });
  assert.ok(errors.some((error) => error.field === "title"));
  assert.ok(errors.some((error) => error.field === "url"));
  assert.ok(errors.some((error) => error.field === "type"));
  assert.ok(errors.some((error) => error.field === "status"));
});

test("applies four-state lifecycle timestamps", () => {
  const base = model.normalizeEntry({
    title: "Stateful Reading",
    creator: "Cobb",
    url: "https://example.com/stateful",
    status: "want",
  }, "2026-07-20");

  const reading = model.transitionEntry(base, "reading", "2026-07-21");
  assert.equal(reading.started_at, "2026-07-21");
  assert.equal(reading.finished_at, null);

  const read = model.transitionEntry(reading, "read", "2026-07-22");
  assert.equal(read.finished_at, "2026-07-22");

  const stopped = model.transitionEntry(read, "stopped", "2026-07-23");
  assert.equal(stopped.finished_at, null);
  assert.equal(stopped.updated_at, "2026-07-23");

  const wantAgain = model.transitionEntry(stopped, "want", "2026-07-24");
  assert.equal(wantAgain.started_at, null);
  assert.equal(wantAgain.finished_at, null);
  assert.throws(() => model.transitionEntry(base, "paused", "2026-07-21"), /Unsupported status/);
});

test("selects homepage entries by active status, priority, and recency", () => {
  const entry = (title, status, updatedAt, url = "https://example.com/item") => ({
    title,
    creator: "Test Creator",
    url,
    type: "article",
    status,
    updated_at: updatedAt,
  });
  const posts = [
    entry("Old reading", "reading", "2026-07-01"),
    entry("Newest want", "want", "2026-07-23"),
    entry("Newest reading", "reading", "2026-07-22"),
    entry("Finished", "read", "2026-07-24"),
    entry("Stopped", "stopped", "2026-07-25"),
    entry("Unsafe", "reading", "2026-07-26", "javascript:alert(1)"),
  ];

  assert.deepEqual(
    model.selectHomepageEntries(posts, 2).map((entry) => entry.title),
    ["Newest reading", "Old reading"],
  );
  assert.deepEqual(
    model.selectHomepageEntries(posts, 4).map((entry) => entry.title),
    ["Newest reading", "Old reading", "Newest want"],
  );
});

test("serializes deterministically and validates the committed data", () => {
  const dataPath = path.join(__dirname, "..", "reading", "posts.json");
  const posts = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  posts.forEach((entry) => {
    assert.deepEqual(model.validateEntry(model.normalizeEntry(entry)), []);
    assert.ok(entry.id);
    assert.ok(entry.creator);
    assert.ok(entry.url);
    assert.ok(entry.type);
    assert.ok(Array.isArray(entry.topics));
    assert.ok(entry.added_at);
    assert.ok(entry.updated_at);
    assert.equal("author" in entry, false);
    assert.equal("link" in entry, false);
    assert.equal("theme" in entry, false);
    assert.equal("date" in entry, false);
  });

  const json = model.serializeEntries(posts.slice().reverse());
  assert.ok(json.endsWith("\n"));
  assert.equal(json, model.serializeEntries(posts));
  assert.deepEqual(JSON.parse(json).map((entry) => entry.id), [
    "a-practical-guide-to-building-ai-agents",
    "demystifying-evals-for-ai-agents",
  ]);
});
