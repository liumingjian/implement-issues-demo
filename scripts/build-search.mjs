import { cp, glob, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const temporary = new URL(".pagefind-source/", root);

async function createSource(draft) {
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  let count = 0;
  for await (const path of glob("practices/*/index.html", { cwd: dist })) {
    const html = await readFile(new URL(path, dist), "utf8");
    const isDraft = html.includes('data-pagefind-meta="draft" data-draft="true"');
    if (isDraft !== draft) continue;
    const destination = new URL(path, temporary);
    await mkdir(new URL("./", destination), { recursive: true });
    await cp(new URL(path, dist), destination);
    count += 1;
  }
  if (count === 0) await writeFile(new URL("empty.html", temporary), '<!doctype html><html lang="zh-CN"><body data-pagefind-body><span hidden>空索引占位</span></body></html>');
}

async function index(name, draft) {
  await createSource(draft);
  const result = spawnSync("npx", [
    "pagefind",
    "--site", temporary.pathname,
    "--output-path", new URL(`dist/${name}/`, root).pathname,
    "--exclude-selectors", "pre, [data-attachment]",
  ], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await index("pagefind-public", false);
await index("pagefind-drafts", true);
await rm(temporary, { recursive: true, force: true });
