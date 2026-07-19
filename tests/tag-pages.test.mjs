import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("tag routes expose index, stable detail pages, draft guidance, and accessible pagination", async () => {
  const index = await readFile(new URL("src/pages/tags/index.astro", root), "utf8");
  const detail = await readFile(new URL("src/pages/tags/[tag].astro", root), "utf8");
  const layout = await readFile(new URL("src/layouts/Base.astro", root), "utf8");

  assert.match(index, /buildTagIndex/);
  assert.match(index, /显示草稿/);
  assert.match(detail, /Astro\.response\.status = 404/);
  assert.match(detail, /开启“显示草稿”即可浏览/);
  assert.match(detail, /aria-label="标签实践分页"/);
  assert.match(detail, /a-workbench-show-drafts/);
  assert.match(layout, /href="\/tags\/"/);
});
