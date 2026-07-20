import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const blog = path.join(root, "blog");

const newCommand = path.join(root, "scripts/new.mjs");

function run(args = [], env = process.env, cwd = root) {
  return spawnSync(blog, args, { cwd, env, encoding: "utf8" });
}

function runNew(args, env) {
  return spawnSync(process.execPath, [newCommand, ...args], { cwd: root, env, encoding: "utf8" });
}

async function authoringRepo(files = {}) {
  const repo = await mkdtemp(path.join(tmpdir(), "blog-new-"));
  const practices = path.join(repo, "src/content/practices");
  await mkdir(practices, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(practices, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return { repo, practices };
}

test("creates a valid explicit draft with independent archive and practice dates", async () => {
  const { repo, practices } = await authoringRepo();
  const result = runNew(["--title", "历史实践", "--slug", "historical-practice", "--date", "2020-02-29"], {
    ...process.env,
    BLOG_REPOSITORY_ROOT: repo,
    BLOG_TODAY: "2026-07-19",
  });

  assert.equal(result.status, 0, result.stderr);
  const files = await readdir(practices);
  assert.deepEqual(files, ["2026-07-19-historical-practice.md"]);
  const source = await readFile(path.join(practices, files[0]), "utf8");
  assert.match(source, /title: "历史实践"/);
  assert.match(source, /date: "2020-02-29"/);
  assert.match(source, /draft: true/);
  assert.match(source, /请替换/);
  assert.match(result.stdout, /创建成功/);
  assert.match(result.stdout, /historical-practice/);
  assert.match(result.stdout, /\.\/blog dev/);
});

test("defaults both dates to the Asia Shanghai natural day", async () => {
  const { repo, practices } = await authoringRepo();
  const result = runNew(["--title", "默认日期", "--slug", "default-date"], {
    ...process.env,
    BLOG_REPOSITORY_ROOT: repo,
    BLOG_TODAY: "2026-01-02",
  });

  assert.equal(result.status, 0, result.stderr);
  const source = await readFile(path.join(practices, "2026-01-02-default-date.md"), "utf8");
  assert.match(source, /date: "2026-01-02"/);
});

test("rejects invalid arguments, slugs, dates and duplicate slugs without writing", async () => {
  const existing = `---\ntitle: "已有"\ndate: "2020-01-01"\ndraft: true\n---\n\n已有正文。\n`;
  for (const args of [
    ["--title", "缺少 slug"],
    ["--title", "坏 slug", "--slug", "Bad Slug"],
    ["--title", "未来", "--slug", "future", "--date", "2026-07-20"],
    ["--title", "重复", "--slug", "taken"],
    ["--title", "未知参数", "--slug", "unknown", "--wat"],
  ]) {
    const { repo, practices } = await authoringRepo({ "nested/2020-01-01-taken.md": existing });
    const result = runNew(args, { ...process.env, BLOG_REPOSITORY_ROOT: repo, BLOG_TODAY: "2026-07-19" });
    assert.equal(result.status, 2, `${args.join(" ")}\n${result.stderr}`);
    assert.match(result.stderr, /创建失败/);
    const files = await readdir(practices, { recursive: true });
    assert.deepEqual(files.sort(), ["nested", "nested/2020-01-01-taken.md"]);
  }
});

test("does not leave a draft when generated content fails validation", async () => {
  const { repo, practices } = await authoringRepo();
  const result = runNew(["--title", "A".repeat(101), "--slug", "invalid-title"], {
    ...process.env,
    BLOG_REPOSITORY_ROOT: repo,
    BLOG_TODAY: "2026-07-19",
  });
  assert.equal(result.status, 4);
  assert.match(result.stderr, /内容校验失败/);
  assert.deepEqual(await readdir(practices), []);
});
test("rejects missing and unknown commands with exit 2", () => {
  for (const args of [[], ["unknown"], ["check", "extra"]]) {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /用法|参数错误/);
  }
});

test("reports an unavailable container runtime with exit 3", async () => {
  const bin = await mkdtemp(path.join(tmpdir(), "blog-path-"));
  const result = run(["check"], { ...process.env, PATH: bin });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /Docker.*不可用/);
  assert.match(result.stderr, /启动 Docker Desktop/);
});

test("reports container preparation failures as exit 3", async () => {
  const bin = await mkdtemp(path.join(tmpdir(), "blog-path-"));
  const docker = path.join(bin, "docker");
  await writeFile(docker, `#!/bin/sh\n[ "$1" = info ] && exit 0\n[ "$1 $2" = "compose version" ] && exit 0\n[ "$1 $2" = "compose build" ] && exit 1\nexit 0\n`);
  await chmod(docker, 0o755);
  const result = run(["check"], { ...process.env, PATH: `${bin}:/bin:/usr/bin` });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /容器镜像准备失败/);
});

test("preserves content validation and interruption exit statuses", async () => {
  for (const status of [4, 130]) {
    const bin = await mkdtemp(path.join(tmpdir(), "blog-path-"));
    const docker = path.join(bin, "docker");
    await writeFile(docker, `#!/bin/sh\n[ "$1" = info ] && exit 0\n[ "$1 $2" = "compose version" ] && exit 0\n[ "$1 $2" = "compose build" ] && exit 0\nexit ${status}\n`);
    await chmod(docker, 0o755);
    const result = run(["check"], { ...process.env, PATH: `${bin}:/bin:/usr/bin` });
    assert.equal(result.status, status);
  }
});

test("maps container build failures to exit 5", async () => {
  const bin = await mkdtemp(path.join(tmpdir(), "blog-path-"));
  const docker = path.join(bin, "docker");
  await writeFile(docker, `#!/bin/sh\n[ "$1" = info ] && exit 0\n[ "$1 $2" = "compose version" ] && exit 0\n[ "$1 $2" = "compose build" ] && exit 0\nexit 5\n`);
  await chmod(docker, 0o755);
  const result = run(["check"], { ...process.env, PATH: `${bin}:/bin:/usr/bin` });
  assert.equal(result.status, 5);
  assert.match(result.stderr, /构建失败/);
});
