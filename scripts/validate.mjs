import { fileURLToPath } from "node:url";
import { validatePractices } from "./content-contract.mjs";

const practicesRoot = fileURLToPath(new URL("../src/content/practices", import.meta.url));
const validation = await validatePractices(practicesRoot);
if (validation.errors.length > 0) {
  console.error(`实践记录校验失败：发现 ${validation.errors.length} 项可修复问题。`);
  for (const issue of validation.errors) console.error(`- ${issue.location}：${issue.reason}。修复：${issue.action}。`);
  process.exit(4);
}
console.log("实践记录校验成功。");
