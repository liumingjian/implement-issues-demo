import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("workbench exposes timeline metadata, draft control, and accessible navigation", async () => {
  const source = await readFile(new URL("src/pages/index.astro", root), "utf8");
  const layout = await readFile(new URL("src/layouts/Base.astro", root), "utf8");
  for (const expected of [
    "practice.data.summary",
    "practice.data.tags",
    "practice.data.draft",
    "data-draft-toggle",
    "localStorage",
    "aria-label=\"时间线分页\"",
  ]) assert.match(source, new RegExp(expected));
  assert.match(layout, /搜索实践/);
});

test("global styles support responsive single-column reading and accessibility preferences", async () => {
  const source = await readFile(new URL("src/styles/global.css", root), "utf8");
  for (const expected of [
    "focus-visible",
    "prefers-color-scheme: dark",
    "prefers-reduced-motion: reduce",
    "overflow-x: hidden",
    "@media (min-width: 64rem)",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
