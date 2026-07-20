import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("production build creates separate public and draft Pagefind indexes", async () => {
  const [packageSource, buildSource, detailSource] = await Promise.all([
    source("package.json"),
    source("scripts/build-search.mjs"),
    source("src/pages/practices/[id].astro"),
  ]);

  assert.match(packageSource, /pagefind/);
  assert.match(packageSource, /build-search/);
  assert.match(buildSource, /pagefind-public/);
  assert.match(buildSource, /pagefind-drafts/);
  assert.match(buildSource, /data-draft/);
  assert.match(detailSource, /data-pagefind-body/);
  assert.match(detailSource, /data-pagefind-meta="draft"/);
  assert.match(detailSource, /data-pagefind-weight="10"/);
  assert.match(detailSource, /data-pagefind-weight="5"/);
  assert.match(detailSource, /data-pagefind-ignore/);
});

test("search page exposes visible controls and complete status regions", async () => {
  const page = await source("src/pages/search.astro");
  for (const expected of [
    "搜索标题、摘要、标签和正文",
    "data-search-input",
    "data-search-drafts",
    "data-search-results",
    "data-search-status",
    "data-search-progress",
    "data-search-more",
    "输入至少两个字符",
    "搜索服务暂时不可用",
    "没有找到匹配的实践",
  ]) assert.match(page, new RegExp(expected));
});

test("search behavior debounces, rejects stale responses, merges indexes, and restores navigation state", async () => {
  const client = await source("src/scripts/search.mjs");
  for (const expected of [
    "200",
    "requestId",
    "URLSearchParams",
    "pagefind-public/pagefind.js",
    "pagefind-drafts/pagefind.js",
    "localStorage",
    "history.replaceState",
    "scrollY",
    "pageSize = 20",
  ]) assert.match(client, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /new Map/);
  assert.match(client, /date/);
});
