import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { validatePractices } from "./content-contract.mjs";

function fail(status, message) {
  console.error(`创建失败：${message}`);
  process.exit(status);
}

function naturalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function quoted(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
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

const values = {};
for (let index = 0; index < process.argv.slice(2).length; index += 2) {
  const option = process.argv.slice(2)[index];
  const value = process.argv.slice(2)[index + 1];
  if (!new Set(["--title", "--slug", "--date"]).has(option) || value === undefined || value.startsWith("--")) fail(2, `无效参数 ${option ?? ""}。用法：./blog new --title "标题" --slug "stable-slug" [--date YYYY-MM-DD]`);
  if (values[option] !== undefined) fail(2, `参数 ${option} 不能重复。`);
  values[option] = value;
}

const title = values["--title"];
const slug = values["--slug"];
const today = process.env.BLOG_TODAY || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const practiceDate = values["--date"] || today;
if (!title || !slug) fail(2, "title 与 slug 为必填参数。用法：./blog new --title \"标题\" --slug \"stable-slug\" [--date YYYY-MM-DD]");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(2, "slug 必须是 lowercase ASCII slug，例如 stable-slug。");
if (!naturalDate(practiceDate) || practiceDate > today) fail(2, "date 必须是非未来的 Asia/Shanghai 真实自然日，格式为 YYYY-MM-DD。");

const repositoryRoot = path.resolve(process.env.BLOG_REPOSITORY_ROOT || new URL("..", import.meta.url).pathname);
const practicesRoot = path.join(repositoryRoot, "src/content/practices");
await mkdir(practicesRoot, { recursive: true });
for (const file of await markdownFiles(practicesRoot)) {
  if (path.basename(file).match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/)?.[1] === slug) fail(2, `slug ${slug} 已存在于 ${path.relative(repositoryRoot, file)}，请更换 slug。`);
}

const relative = path.join("src/content/practices", `${today}-${slug}.md`);
const target = path.join(repositoryRoot, relative);
try {
  await readFile(target);
  fail(2, `目标 ${relative} 已存在，不会覆盖。`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const source = `---\ntitle: ${quoted(title)}\ndate: ${quoted(practiceDate)}\ndraft: true\n---\n\n请替换本段，记录这次 AI 编程实践的背景、方法与结论。\n`;
await writeFile(target, source, { flag: "wx" });
const validation = await validatePractices(practicesRoot, { today });
const generatedErrors = validation.errors.filter((issue) => issue.file === path.basename(target));
if (generatedErrors.length > 0) {
  await unlink(target);
  console.error(`创建失败：内容校验失败，未保留 ${relative}。`);
  for (const issue of generatedErrors) console.error(`- ${issue.location}：${issue.reason}。修复：${issue.action}。`);
  process.exit(4);
}

console.log(`创建成功：${relative}`);
console.log(`详情预览：http://localhost:4321/practices/${today}-${slug}/`);
console.log("下一步：运行 ./blog dev 开始预览。");
