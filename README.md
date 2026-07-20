# 本地 AI 编程实践博客

本仓库是仅供博客所有者在本机使用的 Astro 实践记录工作台。MVP 的完成定义是：权威自动检查与固定人工浏览器矩阵均通过，单独通过其中一项不算完成。

## 前置条件

干净 clone 的宿主机只需要 Git、Docker Desktop 与 Docker Compose。首次运行需要联网构建固定版本镜像；镜像预热后，创建、预览与验收不依赖外部服务。无需在宿主机安装 Node.js 或 npm。

## 权威命令

```sh
./blog new --title "标题" --slug "stable-slug" [--date YYYY-MM-DD]
./blog dev
./blog check
./blog publish stable-slug
```

- `./blog new` 创建显式草稿。
- `./blog dev` 校验内容后在 <http://localhost:4321> 启动预览；开发模式不生成 Pagefind 索引。
- `./blog check` 是唯一最高层自动验收入口：从干净输出开始，使用隔离固定数据执行内容校验、全部回归测试、生产构建、正式与草稿双索引生成和输出不变量检查。镜像预热后应在普通开发 Mac 上 60 秒内完成。
- `./blog publish` 在修改前后各执行一次完整验收，失败时精确恢复目标文件。

实践记录位于 `src/content/practices/`。正式页面使用稳定 URL：主页 `/`、详情 `/practices/<slug>/`、标签 `/tags/` 与 `/tags/<tag>/`、搜索 `/search/`。不得把生成数据写入作者内容目录；需要 1,000 条性能数据时运行：

```sh
npm run fixture:performance -- .acceptance/performance
```

该目录已忽略，可随时删除。它用于单独测量目标规模；不会由日常作者内容或固定验收 corpus 派生。

## 退出状态

| 状态 | 含义 |
| --- | --- |
| `0` | 成功 |
| `2` | 命令或参数错误 |
| `3` | Docker / Compose 等运行环境错误 |
| `4` | 实践记录校验错误 |
| `5` | 构建、索引、回归或输出不变量错误 |
| `130` | 用户中断 |

## 人工验收

自动检查成功后，严格执行 [`docs/manual-acceptance.md`](docs/manual-acceptance.md)。只有 `./blog check` 与该矩阵均通过，MVP 才满足完成定义。

## 常见故障

- **Docker 不可用**：启动 Docker Desktop，再确认 `docker info` 与 `docker compose version` 成功。
- **镜像准备失败**：检查首次构建网络、磁盘空间与 Docker 日志；预热后可离线运行。
- **端口占用**：释放 `localhost:4321` 后重新运行 `./blog dev`。
- **内容校验失败**：按错误中的文件、位置、原因与修复动作修改 `src/content/practices/`。
- **搜索在开发模式不可用**：这是约定行为；运行 `./blog check` 验证生产搜索索引。
- **状态 5**：查看失败的回归测试、生产构建、双索引或输出不变量阶段；不要复用旧 `dist/` 判断完成。
