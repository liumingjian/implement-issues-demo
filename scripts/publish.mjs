import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

function fail(status, message) {
  console.error(`转正失败：${message}`);
  process.exit(status);
}

async function markdownFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.name.endsWith(".md")) files.push(target);
    }
  }
  await walk(root);
  return files;
}

const [slug, ...extra] = process.argv.slice(2);
if (!slug || extra.length > 0 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(2, "publish 需要且只接受一个 lowercase ASCII slug。");

const repositoryRoot = path.resolve(process.env.BLOG_REPOSITORY_ROOT || new URL("..", import.meta.url).pathname);
const practicesRoot = path.join(repositoryRoot, "src/content/practices");
const matches = (await markdownFiles(practicesRoot)).filter((file) => path.basename(file).match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/)?.[1] === slug);
if (matches.length !== 1) fail(2, matches.length === 0 ? `找不到 slug ${slug}。` : `slug ${slug} 不唯一。`);

const target = matches[0];
const original = await readFile(target, "utf8");
const frontmatter = original.match(/^---\n([\s\S]*?)\n---\n/);
const draftLines = frontmatter ? [...frontmatter[1].matchAll(/^draft:\s*(true|false)\s*$/gm)] : [];
if (draftLines.length !== 1 || draftLines[0][1] !== "true") fail(2, `${path.relative(repositoryRoot, target)} 不是草稿；frontmatter 必须含唯一且显式的 draft: true。`);

const acceptance = process.env.BLOG_ACCEPTANCE_COMMAND || "npm";
const acceptanceArgs = process.env.BLOG_ACCEPTANCE_COMMAND ? [] : ["run", "check"];
function check(phase) {
  console.log(`转正：${phase}完整生产验收。`);
  return spawnSync(acceptance, acceptanceArgs, { cwd: repositoryRoot, stdio: "inherit" });
}

let result = check("运行转正前");
if (result.status !== 0) fail(result.status ?? 5, "转正前完整生产验收未通过，源文件未修改。");

const draftIndex = frontmatter.index + 4 + draftLines[0].index;
const published = original.slice(0, draftIndex) + draftLines[0][0].replace("true", "false") + original.slice(draftIndex + draftLines[0][0].length);
await writeFile(target, published);
result = check("运行转正后");
if (result.status !== 0) {
  await writeFile(target, original);
  fail(result.status ?? 5, `转正后完整生产验收未通过，已精确恢复 ${path.relative(repositoryRoot, target)}。`);
}

console.log(`转正成功：${path.relative(repositoryRoot, target)}。仅将显式 draft: true 改为 draft: false；未执行任何 Git 操作。`);
