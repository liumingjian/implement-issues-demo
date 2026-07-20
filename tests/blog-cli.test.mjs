import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const blog = path.join(root, "blog");

function run(args = [], env = process.env) {
  return spawnSync(blog, args, { cwd: root, env, encoding: "utf8" });
}

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
