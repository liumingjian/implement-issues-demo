import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTagIndex,
  buildTagTimeline,
  tagHref,
} from "../src/lib/tags.mjs";
import { PAGE_SIZE } from "../src/lib/timeline.mjs";

const record = (id, date, tags, draft = false) => ({
  id,
  data: { date: new Date(`${date}T00:00:00Z`), tags, draft },
});

test("lists tags alphabetically with counts from currently visible practices", () => {
  const records = [
    record("public.md", "2026-07-02", ["zeta", "Alpha"]),
    record("draft.md", "2026-07-01", ["draft-only", "Alpha"], true),
  ];

  assert.deepEqual(buildTagIndex(records, { showDrafts: false }), [
    { name: "Alpha", count: 1 },
    { name: "zeta", count: 1 },
  ]);
  assert.deepEqual(buildTagIndex(records, { showDrafts: true }), [
    { name: "Alpha", count: 2 },
    { name: "draft-only", count: 1 },
    { name: "zeta", count: 1 },
  ]);
});

test("keeps a known tag stable when all matching practices are hidden drafts", () => {
  const records = [record("draft.md", "2026-07-01", ["private"], true)];

  const hidden = buildTagTimeline(records, "private", { showDrafts: false, page: 1 });
  assert.equal(hidden.known, true);
  assert.equal(hidden.emptyReason, "drafts-hidden");
  assert.equal(hidden.totalPages, 0);

  const unknown = buildTagTimeline(records, "missing", { showDrafts: true, page: 1 });
  assert.equal(unknown.known, false);
});

test("tag timeline follows home ordering and twenty-item pagination", () => {
  const records = Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
    record(`entry-${String(index).padStart(2, "0")}.md`, "2026-07-01", ["testing"]),
  );

  const result = buildTagTimeline(records, "testing", { showDrafts: false, page: 2 });
  assert.equal(result.items.length, 1);
  assert.equal(result.totalPages, 2);
  assert.equal(result.items[0].id, "entry-00.md");
  assert.equal(tagHref("a/b", 1), "/tags/a%2Fb/");
  assert.equal(tagHref("a/b", 2), "/tags/a%2Fb/?page=2");
});
