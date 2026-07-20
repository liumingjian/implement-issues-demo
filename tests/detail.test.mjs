import assert from "node:assert/strict";
import test from "node:test";
import { practiceNeighbors } from "../src/lib/detail.mjs";

const record = (id, date, draft = false) => ({ id, data: { date: new Date(`${date}T00:00:00Z`), draft } });
const records = [
  record("new-draft", "2026-07-03", true),
  record("current", "2026-07-02"),
  record("old-public", "2026-07-01"),
];

test("detail navigation follows timeline order and draft visibility", () => {
  assert.deepEqual(practiceNeighbors(records, "current", false), {
    newer: null,
    older: records[2],
  });
  assert.deepEqual(practiceNeighbors(records, "current", true), {
    newer: records[0],
    older: records[2],
  });
});

test("a directly opened hidden draft still navigates among public records", () => {
  assert.deepEqual(practiceNeighbors(records, "new-draft", false), {
    newer: null,
    older: records[1],
  });
});
