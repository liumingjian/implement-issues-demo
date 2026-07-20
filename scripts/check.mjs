import { rm, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });

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
