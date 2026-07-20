import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("example practice has the required metadata and non-empty body", async () => {
  const source = await readFile(new URL("src/content/practices/2026-07-19-containerized-product-spine.md", root), "utf8");
  assert.match(source, /^---\ntitle: ".+"\ndate: "\d{4}-\d{2}-\d{2}"\n---\n\n\S/m);
});
