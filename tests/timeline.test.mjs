import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_SIZE,
  buildTimeline,
  parseTimelineState,
  pageHref,
} from "../src/lib/timeline.mjs";

const record = (id, date, draft = false) => ({ id, data: { date: new Date(`${date}T00:00:00Z`), draft } });

test("orders by practice date then full filename descending and groups by month", () => {
  const result = buildTimeline([
    record("2026-06-01-old.md", "2026-06-01"),
    record("2026-07-01-alpha.md", "2026-07-01"),
    record("2026-07-01-zeta.md", "2026-07-01"),
  ], { showDrafts: false, page: 1 });

  assert.deepEqual(result.items.map(({ id }) => id), [
    "2026-07-01-zeta.md",
    "2026-07-01-alpha.md",
    "2026-06-01-old.md",
  ]);
  assert.deepEqual(result.groups.map(({ key, items }) => [key, items.length]), [
    ["2026-07", 2],
    ["2026-06", 1],
  ]);
});

test("hides drafts by default, distinguishes an all-drafts collection, and resets invalid pages", () => {
  const records = Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
    record(`2026-07-${String(index + 1).padStart(2, "0")}-entry.md`, "2026-07-01", true),
  );

  const hidden = buildTimeline(records, { showDrafts: false, page: 2 });
  assert.equal(hidden.emptyReason, "drafts-hidden");
  assert.equal(hidden.page, 1);
  assert.equal(hidden.totalPages, 0);

  const visible = buildTimeline(records, { showDrafts: true, page: 2 });
  assert.equal(visible.items.length, 1);
  assert.equal(visible.totalPages, 2);
});

test("keeps pagination in stable URL state while draft preference remains local", () => {
  assert.deepEqual(parseTimelineState(new URL("https://example.test/?page=3")), { page: 3 });
  assert.deepEqual(parseTimelineState(new URL("https://example.test/?page=nope")), { page: 1 });
  assert.equal(pageHref(2), "/?page=2");
  assert.equal(pageHref(1), "/");
});
