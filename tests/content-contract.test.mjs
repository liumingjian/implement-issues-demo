import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validatePractices } from "../scripts/content-contract.mjs";

async function corpus(files) {
  const root = await mkdtemp(path.join(tmpdir(), "practices-"));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

const valid = (fields = "", body = "一段足够清楚的普通正文，用于生成稳定摘要。") =>
  `---\ntitle: "有效标题"\ndate: "2026-07-18"\n${fields}---\n\n${body}\n`;

test("accepts legal metadata boundaries and derives deterministic page data", async () => {
  const root = await corpus({
    "2026-07-19-zeta.md": valid('tags: ["ai", "tool-use"]\ndraft: false\n', "## 方法\n\n**加粗** [文字](https://example.com) 与 `代码`。"),
    "2025-01-01-alpha.md": valid('summary: "手写摘要"\n', "正文。"),
  });
  const result = await validatePractices(root, { today: "2026-07-19" });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.records.map(({ slug }) => slug), ["zeta", "alpha"]);
  assert.equal(result.records[0].summary, "加粗 文字 与 代码。");
  assert.deepEqual(result.records[0].tags, ["ai", "tool-use"]);
  assert.equal(result.records[0].draft, false);
});

test("sorts by practice date then full filename, independently of archive date", async () => {
  const root = await corpus({
    "2020-01-01-a.md": valid("", "A"),
    "2026-07-19-z.md": valid("", "Z"),
  });
  const result = await validatePractices(root, { today: "2026-07-19" });
  assert.deepEqual(result.records.map(({ slug }) => slug), ["z", "a"]);
});

test("aggregates actionable metadata and body errors", async () => {
  const root = await corpus({
    "2026-07-19-bad.md": `---\ntitle: "   "\ndate: 2026-07-20\ntags: ["UPPER", "UPPER", "two words", "four", "five", "six"]\ndraft: yes\nsummary: ""\ntypo: true\n---\n\n# 重复标题\n\n<div>raw</div>\n`,
  });
  const { errors } = await validatePractices(root, { today: "2026-07-19" });
  const text = errors.map((error) => `${error.location} ${error.reason} ${error.action}`).join("\n");
  for (const expected of ["title", "date", "tags", "draft", "summary", "typo", "一级标题", "原始 HTML", "请"]) assert.match(text, new RegExp(expected));
  assert.ok(errors.length >= 8);
});

test("rejects malformed identity, duplicate slugs, empty bodies and unsupported Markdown", async () => {
  const root = await corpus({
    "bad name.md": valid("", ""),
    "2026-01-01-same.md": valid("", "[^脚注]\n\n```\ncode\n```"),
    "nested/2025-01-01-same.md": valid("", "$$x$$\n\n```mermaid\nx\n```"),
  });
  const text = (await validatePractices(root, { today: "2026-07-19" })).errors.map((x) => x.reason).join("\n");
  for (const expected of ["文件名", "正文不能为空", "全局唯一", "脚注", "语言", "数学", "Mermaid"]) assert.match(text, new RegExp(expected));
});

test("validates attachments, image alternatives, local paths and external links", async () => {
  const root = await corpus({
    "2026-07-19-links.md": valid("", [
      "![](links.assets/image.png)",
      "![图](links.assets/missing.png)",
      "[不安全](http://example.com)",
      "[绝对](/secret.txt)",
      "[逃逸](../secret.txt)",
    ].join("\n\n")),
    "links.assets/image.png": "png",
    "links.assets/orphan.exe": "bad",
  });
  const text = (await validatePractices(root, { today: "2026-07-19" })).errors.map((x) => x.reason).join("\n");
  for (const expected of ["替代文本", "不存在", "HTTPS", "绝对", "越出", "不允许的附件类型", "孤立附件"]) assert.match(text, new RegExp(expected));
});

test("rejects unsafe SVG and permits referenced safe SVG", async () => {
  const root = await corpus({
    "2026-07-19-safe.md": valid("", "![安全图](safe.assets/safe.svg)\n\n![危险图](safe.assets/bad.svg)"),
    "safe.assets/safe.svg": '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
    "safe.assets/bad.svg": '<svg onload="alert(1)"><script>alert(1)</script></svg>',
  });
  const { errors } = await validatePractices(root, { today: "2026-07-19" });
  assert.equal(errors.filter((x) => x.reason.includes("SVG")).length, 1);
  assert.match(errors.find((x) => x.reason.includes("SVG")).location, /bad\.svg/);
});
