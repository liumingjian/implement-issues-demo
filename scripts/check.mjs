import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePractices } from "./content-contract.mjs";
import { generateAcceptanceFixtures, generatePerformanceFixtures } from "./fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const practicesRoot = path.join(root, "src/content/practices");
const distRoot = path.join(root, "dist");
const started = performance.now();
const MAX_CHECK_MS = 60_000;

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) process.exitCode = 5;
  return result.status === 0;
}

async function validate(rootToValidate) {
  const validation = await validatePractices(rootToValidate);
  if (validation.errors.length === 0) return validation.records;
  console.error(`实践记录校验失败：发现 ${validation.errors.length} 项可修复问题。`);
  for (const issue of validation.errors) console.error(`- ${issue.location}：${issue.reason}。修复：${issue.action}。`);
  const failure = new Error("content-validation");
  failure.exitCode = 4;
  throw failure;
}

async function assertOutput(records, performanceCorpus = false) {
  const homepageStarted = performance.now();
  const homepage = await readFile(path.join(distRoot, "index.html"), "utf8");
  if (!homepage.includes("固定验收实践") && !homepage.includes("性能实践")) throw new Error("首页缺少主要内容");
  if (performance.now() - homepageStarted >= 1_000) throw new Error("本地导航主要内容读取超过 1 秒");

  for (const name of ["pagefind-public", "pagefind-drafts"]) {
    await readFile(path.join(distRoot, name, "pagefind.js"));
  }
  if (!performanceCorpus) {
    const formal = records.filter(({ draft }) => !draft);
    const drafts = records.filter(({ draft }) => draft);
    if (formal.length < 21 || drafts.length < 1) throw new Error("固定 fixture 正式或草稿记录数量不足");
    for (const record of records) {
      await readFile(path.join(distRoot, "practices", record.slug, "index.html"));
    }
    const publicDraftFiles = await searchIndex("pagefind-public", "draftonlytoken");
    const draftDraftFiles = await searchIndex("pagefind-drafts", "draftonlytoken");
    const publicFormalFiles = await searchIndex("pagefind-public", "formalonlytoken");
    const draftFormalFiles = await searchIndex("pagefind-drafts", "formalonlytoken");
    if (publicDraftFiles.length !== 0 || draftDraftFiles.length !== 1 || publicFormalFiles.length === 0 || draftFormalFiles.length !== 0) throw new Error("正式与草稿搜索索引不互斥");
    for (const term of ["telescope-title", "telescope-summary", "telescope-tag", "telescope-body"]) {
      if ((await searchIndex("pagefind-public", term)).length === 0) throw new Error(`正式索引缺少 ${term} 字段命中`);
    }
  } else {
    const searchStarted = performance.now();
    const matches = await searchIndex("pagefind-public", "performance-0501");
    const elapsed = performance.now() - searchStarted;
    if (matches.length === 0) throw new Error("1,000 条性能数据无法检索");
    if (elapsed >= 800) throw new Error(`搜索首批完成耗时 ${Math.round(elapsed)} ms，超过防抖后 800 ms 阈值`);
  }
}

async function searchIndex(name, term) {
  const directory = path.join(distRoot, name);
  const moduleUrl = pathToFileURL(path.join(directory, "pagefind.js")).href;
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (resource) => {
    const target = decodeURIComponent(String(resource).replace(/^file:\/\//, "")).replace(/[?#].*$/, "");
    if (!path.isAbsolute(target)) return nativeFetch(resource);
    const content = await readFile(target);
    const headers = target.endsWith(".wasm") ? { "content-type": "application/wasm" } : undefined;
    return new Response(content, { headers });
  };
  try {
    const index = await import(`${moduleUrl}?check=${Date.now()}-${Math.random()}`);
    await index.init({ basePath: `${directory}/` });
    const response = await index.search(term);
    return response.results;
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

async function fixtureCorpus(prefix, generate, operation) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  try {
    await generate(directory);
    return await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

await rm(distRoot, { recursive: true, force: true });
try {
  await validate(practicesRoot);
  if (!run("npm", ["test"])) throw new Error("regression-tests");

  await fixtureCorpus("blog-check-acceptance-", generateAcceptanceFixtures, async (fixtureRoot) => {
    const acceptanceRecords = await validate(fixtureRoot);
    if (!run("npm", ["run", "build"], { PRACTICES_ROOT: fixtureRoot })) throw new Error("acceptance-build");
    await assertOutput(acceptanceRecords);
  });

  await fixtureCorpus("blog-check-performance-", generatePerformanceFixtures, async (fixtureRoot) => {
    const performanceRecords = await validate(fixtureRoot);
    if (performanceRecords.length !== 1000) throw new Error("性能 fixture 必须恰好包含 1,000 条记录");
    if (!run("npm", ["run", "build"], { PRACTICES_ROOT: fixtureRoot })) throw new Error("performance-build");
    await assertOutput(performanceRecords, true);
  });

  const elapsed = performance.now() - started;
  if (elapsed >= MAX_CHECK_MS) throw new Error(`完整检查耗时 ${Math.round(elapsed)} ms，超过 60 秒门槛`);
  console.log(`自动验收完成：内容、回归、生产输出、双索引与 1,000 条性能数据全部通过（${(elapsed / 1000).toFixed(1)} 秒）。`);
} catch (error) {
  if (error.exitCode === 4) process.exit(4);
  console.error(`自动验收失败：${error.message}。`);
  process.exit(5);
}
