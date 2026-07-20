# 本地 AI 编程实践博客

一个仅供博客所有者在本机使用的简体中文实践记录工作台。实践记录以 Markdown 保存在 Git 仓库中；Astro 提供时间线、详情、标签和全文搜索，Docker Compose 提供一致的创建、预览、验收与发布环境。

## 功能

- 按实践日期排序、按年月分组的工作台时间线
- 每页 20 条的稳定分页，以及按字母排序的标签聚合
- 正式记录与草稿分离，浏览器本地持久化“显示草稿”偏好
- Pagefind 正式/草稿双索引全文搜索
- 长文目录、代码高亮和复制反馈、前后记录导航
- 明暗模式、移动端单栏布局、键盘与 reduced-motion 支持
- 严格的 Markdown、元数据、附件和链接内容契约
- 隔离 fixture、1,000 条性能数据和统一自动验收入口

## 前置条件

宿主机只需要：

- Git
- Docker Desktop
- Docker Compose

首次运行需要联网构建固定版本镜像。镜像准备完成后，日常创建、预览与验收不依赖外部服务，也无需在宿主机安装 Node.js 或 npm。

## 快速开始

```sh
git clone https://github.com/liumingjian/implement-issues-demo.git
cd implement-issues-demo

./blog check
./blog dev
```

预览地址为 <http://localhost:4321>。按 `Ctrl+C` 停止开发服务器并清理相关容器。

> 开发模式不生成 Pagefind 索引，搜索页会显示相应说明。使用 `./blog check` 验证生产搜索。

## 命令

```sh
./blog new --title "标题" --slug "stable-slug" [--date YYYY-MM-DD]
./blog dev
./blog check
./blog publish stable-slug
```

| 命令 | 行为 |
| --- | --- |
| `new` | 创建显式草稿；默认使用 Asia/Shanghai 当日作为实践日期和归档日期，不覆盖重复 slug。 |
| `dev` | 先校验全部实践记录，再在固定地址启动预览。 |
| `check` | 从干净输出开始，执行内容校验、42 项回归测试、生产构建、双索引检查和 1,000 条性能数据验收。 |
| `publish` | 在修改草稿状态前后分别执行完整验收；失败时精确恢复原文件。 |

`./blog check` 是唯一最高层自动验收入口。镜像预热后应在普通开发 Mac 上 60 秒内完成。

## 编写实践记录

内容位于 `src/content/practices/`。推荐使用 `./blog new` 创建文件：

```sh
./blog new \
  --title "用隔离 worktree 审查并行改动" \
  --slug "review-parallel-worktrees" \
  --date 2026-07-20
```

文件名格式为 `YYYY-MM-DD-<slug>.md`。文件名日期是归档日期；frontmatter 中的 `date` 是实践日期，也是时间线排序依据。详情 URL 仅使用稳定 slug：`/practices/<slug>/`。

```md
---
title: "用隔离 worktree 审查并行改动"
date: "2026-07-20"
tags: ["git", "review"]
draft: true
summary: "用独立 worktree 避免并行审查互相污染。"
---

正文从普通段落或二级标题开始。

## 方法

代码围栏必须声明语言：

```sh
git worktree list
```
```

元数据约束：

- 必填：`title`、使用引号的 `date`
- 可选：`tags`、`draft`、`summary`
- `draft` 默认 `false`；`tags` 默认空数组
- `summary` 省略时从第一个合适的普通段落确定性提取
- 未知字段、未来/无效日期、重复 slug、空正文和不受支持的 Markdown 会阻止验收
- 附件放在记录旁的资源目录中，使用相对路径引用；附件类型、大小、名称、图片替代文本和链接均会校验

## 页面与搜索

| 页面 | 路径 |
| --- | --- |
| 时间线 | `/` |
| 实践详情 | `/practices/<slug>/` |
| 标签总览 | `/tags/` |
| 标签详情 | `/tags/<tag>/` |
| 搜索 | `/search/?q=<关键词>` |

“显示草稿”默认关闭，并保存在浏览器本地。生产构建生成互斥的正式与草稿 Pagefind 索引；默认搜索只加载正式索引，开启草稿后查询并合并两个索引。

## 验收

自动检查成功后，执行 [`docs/manual-acceptance.md`](docs/manual-acceptance.md) 中的 Safari/Chrome 固定矩阵。MVP 只有在以下两项均通过时才满足完成定义：

1. `./blog check`
2. 人工浏览器验收矩阵

如需单独生成 1,000 条性能 fixture，可继续通过容器运行，无需宿主 npm：

```sh
docker compose run --rm check \
  npm run fixture:performance -- .acceptance/performance
```

`.acceptance/` 已被忽略，可随时删除；生成数据不会写入作者内容目录。

## 退出状态

| 状态 | 含义 |
| --- | --- |
| `0` | 成功 |
| `2` | 命令或参数错误 |
| `3` | Docker / Compose 等运行环境错误 |
| `4` | 实践记录校验错误 |
| `5` | 构建、索引、回归或输出不变量错误 |
| `130` | 用户中断 |

## 常见故障

- **Docker 不可用**：启动 Docker Desktop，再确认 `docker info` 与 `docker compose version` 成功。
- **镜像准备失败**：检查首次构建网络、磁盘空间与 Docker 日志；镜像准备完成后可离线运行。
- **端口占用**：释放 `localhost:4321` 后重新运行 `./blog dev`。
- **内容校验失败**：按错误中的文件、位置、原因与修复动作修改 `src/content/practices/`。
- **开发模式无法搜索**：这是约定行为；运行 `./blog check` 验证生产双索引。
- **状态 5**：查看失败的回归测试、生产构建、双索引或输出不变量阶段，不要复用旧 `dist/` 判断完成。

## 技术栈

- Astro 7 + TypeScript
- Tailwind CSS 3 + PostCSS
- Pagefind
- Node.js 22 容器镜像
- Docker Compose
- Node.js 内置测试运行器
