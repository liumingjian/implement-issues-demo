import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ALLOWED_FIELDS = new Set(["title", "date", "tags", "draft", "summary"]);
const ALLOWED_ATTACHMENTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".txt", ".json", ".yaml", ".yml", ".csv"]);
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function error(file, location, reason, action) {
  return { file, location: `${file}:${location}`, reason, action };
}

function parseScalar(value) {
  if (/^".*"$/.test(value)) return value.slice(1, -1);
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\[.*\]$/.test(value)) {
    const inside = value.slice(1, -1).trim();
    if (!inside) return [];
    return inside.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  }
  return value;
}

function parseDocument(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { metadata: null, body: source, lines: {} };
  const metadata = {};
  const lines = {};
  match[1].split("\n").forEach((line, index) => {
    const separator = line.indexOf(":");
    if (separator < 0) return;
    const key = line.slice(0, separator).trim();
    metadata[key] = parseScalar(line.slice(separator + 1).trim());
    lines[key] = index + 2;
  });
  return { metadata, body: match[2], lines };
}

function naturalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function plainText(paragraph) {
  return paragraph
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryFrom(body) {
  const withoutCode = body.replace(/```[\s\S]*?```/g, "");
  const paragraph = withoutCode.split(/\n\s*\n/).map((part) => part.trim()).find((part) => part && !/^(#{1,6}|[-*+] |\d+\. |!\[|>)/.test(part));
  const text = paragraph ? plainText(paragraph) : "";
  return text.length <= 200 ? text : `${text.slice(0, 199)}…`;
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

async function filesBelow(root) {
  const output = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(target);
      else output.push(target);
    }
  }
  await walk(root);
  return output;
}

export async function validatePractices(root, { today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()) } = {}) {
  const errors = [];
  const records = [];
  const allFiles = await filesBelow(root);
  const markdownFiles = allFiles.filter((file) => file.endsWith(".md"));
  const referenced = new Set();
  const slugs = new Map();

  for (const absolute of markdownFiles) {
    const file = path.relative(root, absolute);
    const filename = path.basename(file);
    const identity = filename.match(/^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/);
    const slug = identity?.[2];
    if (!identity) errors.push(error(file, 1, "文件名必须为 YYYY-MM-DD-lowercase-slug.md", "请重命名实践记录"));
    if (slug) {
      if (slugs.has(slug)) errors.push(error(file, 1, `slug ${slug} 不是全局唯一`, `请更改 ${file} 或 ${slugs.get(slug)} 的 slug`));
      else slugs.set(slug, file);
    }

    const source = await readFile(absolute, "utf8");
    const { metadata, body, lines } = parseDocument(source);
    if (!metadata) {
      errors.push(error(file, 1, "缺少有效 frontmatter", "请在正文前添加 --- 包围的元数据"));
      continue;
    }
    for (const key of Object.keys(metadata)) if (!ALLOWED_FIELDS.has(key)) errors.push(error(file, lines[key], `未知字段 ${key}`, `请删除 ${key} 或改为受支持字段`));
    const title = metadata.title;
    if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 100) errors.push(error(file, lines.title ?? 1, "title 必须是 1–100 个去除首尾空白后的字符", "请填写有效 title"));
    const date = metadata.date;
    if (!naturalDate(date) || date > today) errors.push(error(file, lines.date ?? 1, "date 必须是非未来的 Asia/Shanghai 真实自然日，且使用引号", "请改为 YYYY-MM-DD 格式的有效实践日期"));
    const tags = metadata.tags ?? [];
    if (!Array.isArray(tags) || tags.length > 5 || new Set(tags).size !== tags.length || tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) errors.push(error(file, lines.tags ?? 1, "tags 必须为至多五个、不重复的 lowercase ASCII slug", "请修正标签并保留需要的作者顺序"));
    if (metadata.draft !== undefined && typeof metadata.draft !== "boolean") errors.push(error(file, lines.draft, "draft 必须是 Boolean", "请使用 true 或 false"));
    if (metadata.summary !== undefined && (typeof metadata.summary !== "string" || metadata.summary.trim().length < 1 || metadata.summary.trim().length > 200)) errors.push(error(file, lines.summary, "summary 必须是 1–200 个字符", "请填写非空摘要或删除字段以自动提取"));
    if (!body.trim()) errors.push(error(file, source.split("\n").length, "正文不能为空", "请添加有意义的正文"));

    body.split("\n").forEach((line, index) => {
      const number = source.slice(0, source.indexOf(body)).split("\n").length + index;
      if (/^#\s/.test(line)) errors.push(error(file, number, "正文不允许一级标题", "请从二级标题 ## 开始；页面标题由 title 生成"));
      if (/<\/?[A-Za-z][^>]*>/.test(line)) errors.push(error(file, number, "不支持原始 HTML", "请改用 CommonMark/GFM Markdown"));
      if (/\[\^[^\]]+\]/.test(line)) errors.push(error(file, number, "不支持脚注", "请将说明写入普通正文"));
      if (/\$\$|(?<!\\)\$[^$]+\$/.test(line)) errors.push(error(file, number, "不支持数学标记", "请使用普通文本或代码块"));
      if (/^```\s*$/.test(line)) errors.push(error(file, number, "代码块必须声明语言", "请在 ``` 后添加语言名称"));
      if (/^```mermaid\b/i.test(line)) errors.push(error(file, number, "不支持 Mermaid", "请使用受支持的图片附件"));
    });

    const linkPattern = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    for (const match of body.matchAll(linkPattern)) {
      const [raw, image, alt, target] = match;
      const line = source.slice(0, source.indexOf(body) + (match.index ?? 0)).split("\n").length;
      if (image && !alt.trim()) errors.push(error(file, line, "图片需要非空替代文本", "请在 ![] 中填写描述图片内容的文字"));
      if (/^http:/i.test(target)) errors.push(error(file, line, "外部链接必须使用 HTTPS", "请将链接改为 https://"));
      if (/^https:/i.test(target) || /^#/.test(target) || /^mailto:/i.test(target)) continue;
      if (path.isAbsolute(target)) { errors.push(error(file, line, "本地链接不能使用绝对路径", "请改用实践记录旁的相对路径")); continue; }
      const resolved = path.resolve(path.dirname(absolute), decodeURIComponent(target.split("#")[0]));
      if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) { errors.push(error(file, line, "本地链接不能越出实践记录目录", "请将目标移入记录的附件分组")); continue; }
      if (!(await exists(resolved))) errors.push(error(file, line, `本地链接目标不存在: ${target}`, "请修正路径或添加目标文件"));
      else if (!resolved.endsWith(".md")) referenced.add(resolved);
      void raw;
    }

    if (identity && naturalDate(date)) records.push({ file, filename, slug, archiveDate: identity[1], date, title: typeof title === "string" ? title.trim() : "", tags: Array.isArray(tags) ? tags : [], draft: metadata.draft ?? false, summary: metadata.summary?.trim() || summaryFrom(body), body });
  }

  for (const absolute of allFiles.filter((file) => !file.endsWith(".md"))) {
    const file = path.relative(root, absolute);
    const extension = path.extname(absolute).toLowerCase();
    if (!ALLOWED_ATTACHMENTS.has(extension)) errors.push(error(file, 1, `不允许的附件类型 ${extension || "(无扩展名)"}`, "请删除附件或转换为允许的类型"));
    if ((await stat(absolute)).size > MAX_ATTACHMENT_SIZE) errors.push(error(file, 1, "附件超过 10 MiB", "请压缩附件至 10 MiB 以内"));
    if (path.basename(absolute) !== path.basename(absolute).normalize("NFC") || !/^[a-z0-9][a-z0-9._-]*$/.test(path.basename(absolute))) errors.push(error(file, 1, "附件名称必须为 NFC lowercase ASCII 安全名称", "请重命名附件"));
    if (extension === ".svg") {
      const svg = await readFile(absolute, "utf8");
      if (/<script\b|\son\w+\s*=|javascript:|<foreignObject\b|(?:href|src)\s*=\s*["']https?:\/\//i.test(svg)) errors.push(error(file, 1, "SVG 包含不安全内容，无法安全使用", "请移除脚本、事件、外部资源和 foreignObject"));
    }
    if (!referenced.has(absolute)) errors.push(error(file, 1, "孤立附件未被任何实践记录引用", "请在对应正文中引用或删除附件"));
  }

  records.sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
  return { errors, records };
}
