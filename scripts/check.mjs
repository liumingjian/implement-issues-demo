import { rm, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validatePractices } from "./content-contract.mjs";

const practicesRoot = fileURLToPath(new URL("../src/content/practices", import.meta.url));
await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
const validation = await validatePractices(practicesRoot);
if (validation.errors.length > 0) {
  console.error(`实践记录校验失败：发现 ${validation.errors.length} 项可修复问题。`);
  for (const issue of validation.errors) {
    console.error(`- ${issue.location}：${issue.reason}。修复：${issue.action}。`);
  }
  process.exit(4);
}

for (const [command, args] of [["npm", ["test"]], ["npm", ["run", "build"]]]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(5);
}

const homepage = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const detail = await readFile(new URL("../dist/practices/2026-07-19-containerized-product-spine/index.html", import.meta.url), "utf8");
if (!homepage.includes("/practices/2026-07-19-containerized-product-spine/") || !detail.includes("建立可验收的容器化产品主干")) {
  console.error("输出校验失败：首页或稳定详情页缺失。");
  process.exit(5);
}
console.log("容器检查完成：实践记录有效，首页与稳定详情页可访问。");
