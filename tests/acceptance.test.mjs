import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { generateAcceptanceFixtures, generatePerformanceFixtures } from "../scripts/fixtures.mjs";
import { validatePractices } from "../scripts/content-contract.mjs";

const root = new URL("../", import.meta.url);

test("acceptance fixtures are isolated, deterministic, and cover the MVP corpus", async () => {
  const first = await mkdtemp(path.join(tmpdir(), "blog-acceptance-a-"));
  const second = await mkdtemp(path.join(tmpdir(), "blog-acceptance-b-"));
  await generateAcceptanceFixtures(first);
  await generateAcceptanceFixtures(second);

  const firstFiles = (await readdir(first, { recursive: true })).sort();
  const secondFiles = (await readdir(second, { recursive: true })).sort();
  assert.deepEqual(firstFiles, secondFiles);
  const markdown = firstFiles.filter((file) => file.endsWith(".md"));
  assert.ok(markdown.length >= 23);
  for (const file of firstFiles.filter((item) => item.endsWith(".txt"))) {
    assert.deepEqual(await readFile(path.join(first, file)), await readFile(path.join(second, file)));
  }

  const validation = await validatePractices(first, { today: "2026-07-20" });
  assert.deepEqual(validation.errors, []);
  const formal = validation.records.filter(({ draft }) => !draft);
  assert.ok(formal.length >= 21);
  assert.ok(validation.records.some(({ draft }) => draft));
  assert.ok(validation.records.some(({ draft, tags }) => draft && tags.includes("draft-only")));
  assert.ok(validation.records.some(({ body }) => body.includes("```js")));
  assert.ok(validation.records.some(({ body }) => body.length > 3000));
  assert.ok(validation.records.some(({ body }) => body.includes("https://example.com")));
  assert.ok(firstFiles.some((file) => file.endsWith(".txt")));
  await rm(first, { recursive: true, force: true });
  await rm(second, { recursive: true, force: true });
});

test("performance fixture creates exactly 1000 repeatable records outside author content", async () => {
  const first = await mkdtemp(path.join(tmpdir(), "blog-performance-a-"));
  const second = await mkdtemp(path.join(tmpdir(), "blog-performance-b-"));
  await generatePerformanceFixtures(first);
  await generatePerformanceFixtures(second);
  const a = (await readdir(first)).sort();
  const b = (await readdir(second)).sort();
  assert.equal(a.length, 1000);
  assert.deepEqual(a, b);
  assert.deepEqual(await readFile(path.join(first, a[500])), await readFile(path.join(second, b[500])));
});

test("the authoritative check and manual matrix document every completion gate", async () => {
  const [check, packageSource, guide, matrix, ignore] = await Promise.all([
    readFile(new URL("scripts/check.mjs", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("docs/manual-acceptance.md", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);
  for (const expected of ["generateAcceptanceFixtures", "npm", "test", "build", "pagefind-public", "pagefind-drafts", "60_000"]) assert.match(check, new RegExp(expected));
  assert.match(packageSource, /fixture:performance/);
  for (const expected of ["Docker Desktop", "./blog check", "src/content/practices", "/search/", "退出状态", "常见故障"]) assert.match(guide, new RegExp(expected));
  for (const expected of ["Safari", "Chrome", "1440×900", "390×844", "浅色", "深色", "键盘", "焦点", "历史", "200%", "WCAG 2.2 AA", "768", "自动检查与本矩阵"]) assert.match(matrix, new RegExp(expected));
  assert.match(ignore, /\.acceptance/);
});
