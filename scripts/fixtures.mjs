import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function document({ title, date, tags = [], draft = false, summary, body }) {
  const fields = [
    "---",
    `title: "${title}"`,
    `date: "${date}"`,
    ...(tags.length ? [`tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]`] : []),
    ...(draft ? ["draft: true"] : []),
    ...(summary ? [`summary: "${summary}"`] : []),
    "---",
    "",
    body,
    "",
  ];
  return fields.join("\n");
}

async function prepare(destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
}

export async function generateAcceptanceFixtures(destination) {
  await prepare(destination);
  for (let index = 1; index <= 21; index += 1) {
    const number = String(index).padStart(2, "0");
    const archiveDay = String(((index - 1) % 18) + 1).padStart(2, "0");
    const date = index <= 2 ? "2026-06-18" : `2026-06-${archiveDay}`;
    const title = index === 3 ? "标题字段命中 telescope-title" : `固定验收实践 ${number}`;
    const summary = index === 4 ? "摘要字段命中 telescope-summary" : undefined;
    const tags = index === 5 ? ["telescope-tag", "acceptance"] : ["acceptance"];
    let body = index === 6 ? "正文检索字段包含 telescope-body，验证生产索引能够找回普通段落。" : `这是第 ${number} 条固定正式实践记录，包含 formalonlytoken，用于验收排序、分页、标签与稳定路由。`;
    if (index === 7) body = `${body}\n\n## 长文结构\n\n${"可重复的长文段落用于验证阅读布局。".repeat(180)}\n\n### 代码与附件\n\n\`\`\`js\nconst answer = 42;\nconsole.log(answer);\n\`\`\`\n\n[查看附件](practice-07.assets/evidence.txt) 与 [安全外链](https://example.com)。`;
    const filename = `2026-07-${archiveDay}-acceptance-${number}.md`;
    await writeFile(path.join(destination, filename), document({ title, date, tags, summary, body }));
  }
  await writeFile(path.join(destination, "2026-07-19-draft-only.md"), document({ title: "草稿专属标签", date: "2026-06-19", tags: ["draft-only"], draft: true, body: "仅草稿索引可检索 draftonlytoken。" }));
  await writeFile(path.join(destination, "2026-07-20-draft-second.md"), document({ title: "第二条固定草稿", date: "2026-06-20", draft: true, body: "用于验证草稿集合与正式集合互斥。" }));
  const assets = path.join(destination, "practice-07.assets");
  await mkdir(assets);
  await writeFile(path.join(assets, "evidence.txt"), "固定附件证据。\n");
}

export async function generatePerformanceFixtures(destination) {
  await prepare(destination);
  for (let index = 0; index < 1000; index += 1) {
    const number = String(index + 1).padStart(4, "0");
    const day = String((index % 28) + 1).padStart(2, "0");
    const month = String((Math.floor(index / 28) % 12) + 1).padStart(2, "0");
    const date = `2025-${month}-${day}`;
    await writeFile(path.join(destination, `2026-01-${day}-performance-${number}.md`), document({
      title: `性能实践 ${number}`,
      date,
      tags: ["performance", `batch-${index % 10}`],
      body: `可重复性能数据第 ${number} 条，包含可搜索词 performance-${number}。`,
    }));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const destination = process.argv[2];
  if (!destination) {
    console.error("用法: node scripts/fixtures.mjs <输出目录>");
    process.exit(2);
  }
  const mode = process.argv[3] ?? "performance";
  await (mode === "acceptance" ? generateAcceptanceFixtures(destination) : generatePerformanceFixtures(destination));
  console.log(`已生成${mode === "acceptance" ? "固定验收" : "性能"}数据：${destination}`);
}
