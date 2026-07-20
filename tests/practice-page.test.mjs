import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("practice detail exposes one metadata title, responsive contents, and visibility guidance", async () => {
  const source = await readFile(new URL("src/pages/practices/[id].astro", root), "utf8");
  assert.equal(source.match(/<h1/g)?.length, 1);
  for (const expected of [
    "practice.data.title",
    "headings.filter",
    "<details class=\"mobile-toc\"",
    "class=\"desktop-toc\"",
    "data-draft-notice",
    "未进入当前列表和搜索",
    "practiceNeighbors",
    "a-workbench-show-drafts",
    "aria-label=\"前后实践记录\"",
  ]) assert.match(source, new RegExp(expected));
});

test("practice code blocks provide language labels, named copy controls, and feedback", async () => {
  const source = await readFile(new URL("src/pages/practices/[id].astro", root), "utf8");
  for (const expected of [
    "复制代码",
    "已复制",
    "复制失败",
    "aria-live",
    "navigator.clipboard.writeText",
    "frame.dataset.language",
  ]) assert.match(source, new RegExp(expected));
});

test("detail styles prevent overflow and keep desktop contents beside the article", async () => {
  const source = await readFile(new URL("src/styles/global.css", root), "utf8");
  for (const expected of [
    ".practice-layout",
    "minmax(0, 1fr)",
    "position: sticky",
    "overflow-x: auto",
    ".mobile-toc",
    ".desktop-toc",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
