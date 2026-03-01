# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Toonflow 是一款 AI 短剧制作平台，能将小说自动转化为剧本、分镜和视频。技术栈：TypeScript + Express 5 + SQLite，可选打包为 Electron 桌面应用。

## 常用命令

```bash
yarn dev              # 启动后端 API 服务（端口 60000，nodemon + tsx 热重载）
yarn dev:gui          # 启动 Electron 桌面应用（electronmon + tsx）
yarn lint             # TypeScript 类型检查（tsc --noEmit）
yarn build            # 生产构建，esbuild 输出到 build/
yarn test             # 运行生产构建（node build/app.js）
yarn dist:mac         # 打包 macOS 应用
yarn dist:win         # 打包 Windows 应用
yarn dist:linux       # 打包 Linux 应用
yarn docker:build     # Docker 部署（从远程拉取）
yarn docker:local     # Docker 部署（本地构建）
yarn debug:ai         # Vercel AI SDK 调试面板
```

## 架构

### 文件路由系统

路由从 `src/routes/**/*.ts` 自动发现。`src/core.ts` 扫描这些文件并生成 `src/router.ts`（通过 MD5 哈希检测变更，避免不必要的重写）。文件路径直接映射为路由路径，例如 `src/routes/novel/addNovel.ts` → `/novel/addNovel`。动态参数使用方括号语法：`[id]` → `:id`。

**禁止手动编辑 `src/router.ts`** — 该文件为自动生成。

### API 响应规范

所有接口统一返回 `{ code: number, data: any, message: string }`，使用 `src/lib/responseFormat.ts` 中的辅助函数：
- `success(data)` → `{ code: 200, data, message: "成功" }`
- `error(message)` → `{ code: 400, data: null, message }`

### 请求校验

`src/middleware/middleware.ts` 中的 `validateFields()` 使用 Zod schema 对请求体/查询参数进行校验。

### 数据库

SQLite，通过 Knex.js 查询构建器 + Better-SQLite3 驱动。表结构定义在 `src/lib/initDB.ts`，迁移脚本在 `src/lib/fixDB.ts`。TypeScript 类型文件 `src/types/database.d.ts` 由 `src/utils/db.ts` 根据表结构自动生成（MD5 哈希检测变更）。

主要表：projects、novels、outlines、scripts、storyboards、assets、videos、tasks、users、settings、prompts。

### 认证

基于 JWT。从 `Authorization` 请求头或 `?token=` 查询参数中获取 token。登录接口 `/other/login` 在白名单中无需认证。token 密钥存储在 `t_setting.tokenKey`。

### AI 服务层（`src/utils/ai/`）

三条并行管线，各有统一接口和厂商特定实现：

- **文本生成**（`ai/text/`）— 基于 Vercel AI SDK，支持 7+ 个 LLM 厂商（OpenAI、Anthropic、DeepSeek、Google、xAI、通义千问、智谱）。支持结构化输出（`schema` 模式）和尽力 JSON 解析（`object` 模式）。
- **图片生成**（`ai/image/`）— 厂商特定实现（火山引擎、可灵、Vidu、RunningHub、Gemini、Apimart）。输入：提示词 + 可选 base64 图片。输出：URL 或 base64。
- **视频生成**（`ai/video/`）— 厂商特定实现（火山引擎、可灵、Vidu、万象、Gemini、RunningHub、Apimart）。生成的视频下载到本地存储。

### Agent 系统（`src/agents/`）

- **分镜 Agent**（`agents/storyboard/`）— 多步骤工作流（分段 → 镜头 → 图片生成），基于 EventEmitter 架构，支持工具调用。
- **大纲/剧本 Agent**（`agents/outlineScript/`）— 从小说文本生成角色、大纲和剧本。

### 文件存储（`src/utils/oss.ts`）

本地文件系统抽象层。Electron 打包模式使用 `userData/uploads/`，独立运行使用 `./uploads/`。通过 `is-path-inside` 进行路径安全校验。

### Electron 集成

双模式运行：独立 Express 服务器或 Electron 应用。通过 `process.versions.electron` 检测运行环境。Electron 主进程在 `scripts/main.ts`。预构建的前端（来自独立的 Toonflow-web 仓库）位于 `scripts/web/`。

### 环境变量

由 `src/env.ts` 从 `env/.env.{dev|prod}` 加载配置。缺失时自动创建默认 env 文件。关键变量：`NODE_ENV`、`PORT`（默认 60000）、`OSSURL`（文件访问基础 URL）。

## 路径别名

`@/*` 映射到 `src/*`（tsconfig.json 中配置，esbuild 构建时解析）。

## 数据流转

小说上传 → 角色提取 → 大纲生成 → 剧本生成 → 分镜生成 → 图片生成 → 视频生成
