# AGENTS.md - Toonflow 开发指南

本文件为 AI Agent 提供开发规范指导。

## 常用命令

```bash
# 开发
yarn dev              # 启动后端 API 服务（端口 60000，nodemon + tsx 热重载）
yarn dev:gui          # 启动 Electron 桌面应用

# 构建与测试
yarn lint             # TypeScript 类型检查（tsc --noEmit）
yarn build            # 生产构建（esbuild 输出到 build/）
yarn test             # 运行生产构建（node build/app.js）
yarn test:e2e         # 运行 E2E 测试（vitest run）
yarn test:e2e -- tasks  # 运行单个测试文件（如 tests/e2e/task.test.ts）

# 打包
yarn dist:mac         # 打包 macOS 应用
yarn dist:win         # 打包 Windows 应用
yarn dist:linux       # 打包 Linux 应用

# Docker
yarn docker:build     # Docker 部署（远程拉取）
yarn docker:local     # Docker 部署（本地构建）
```

## 技术栈

- **Runtime**: Node.js + TypeScript (strict mode)
- **Framework**: Express 5 + Express-WS
- **Database**: SQLite (Knex.js + Better-SQLite3)
- **AI**: Vercel AI SDK (文本) + 厂商特定 SDK (图片/视频)
- **Desktop**: Electron 40
- **Testing**: Vitest

## 代码规范

### 导入规范

- 使用路径别名 `@/*` 代替相对路径：`import u from "@/utils"`（不是 `../utils`）
- 内部工具通过 `@/utils` 统一导出，路由中直接使用 `u.db()`、`u.ai.text()` 等
- Zod 从 `"zod"` 直接导入

```typescript
import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
```

### 响应格式

所有 API 统一返回 `{ code: number, data: any, message: string }`，使用辅助函数：

```typescript
// 成功
return res.status(200).send(success({ token: "Bearer " + token }, "登录成功"));

// 失败
return res.status(400).send(error("用户名或密码错误"));
```

### 请求校验

使用 Zod + `validateFields` 中间件校验请求体/查询参数：

```typescript
router.post(
  "/",
  validateFields({
    username: z.string(),
    password: z.string(),
  }),
  async (req, res) => { ... }
);
```

支持校验 `body`、`query`、`params`（默认 body）。

### 命名规范

- **文件**:  kebab-case (`addNovel.ts`, `getConfig.ts`)
- **路由**:  RESTful，文件路径映射路由 (`src/routes/novel/addNovel.ts` → `/novel/addNovel`)
- **数据库表**:  `t_` 前缀 + 小写下划线 (`t_project`, `t_novel`)
- **数据库字段**:  小写下划线 (`createTime`, `projectId`)
- **接口类型**:  PascalCase (`t_project` → `T_project`)

### 错误处理

- 使用 `normalizeError` 统一处理错误（支持 Axios、普通 Error、unknown）
- 全局异常在 `src/err.ts` 中捕获并记录
- 业务错误返回 `error()` 辅助函数，HTTP 状态码 400

```typescript
import normalizeError from "@/utils/error";

try {
  // business logic
} catch (err) {
  const normalized = normalizeError(err);
  console.error(normalized);
  return res.status(500).send(error("操作失败"));
}
```

### 类型系统

- 启用 `strict: true`，禁止 `any` 隐式类型
- 数据库类型自动生成在 `src/types/database.d.ts`，由 `src/utils/db.ts` 根据表结构 MD5 哈希检测变更自动生成
- **禁止手动编辑** `src/types/database.d.ts` 和 `src/router.ts`

### 路由注册

路由文件在 `src/routes/**/*.ts` 自动发现，文件路径直接映射为路由路径：
- `src/routes/novel/addNovel.ts` → `/novel/addNovel`
- 动态参数: `[id]` → `:id`（如 `src/routes/project/[id]/index.ts` → `/project/:id`）

### 数据库操作

使用 Knex.js 查询构建器，通过 `u.db()` 访问：

```typescript
// 查询单条
const user = await u.db("t_user").where("name", "=", username).first();

// 查询多条
const projects = await u.db("t_project").where("userId", userId).select("*");

// 插入
const [id] = await u.db("t_project").insert({ name, userId, createTime: Date.now() });
```

### Agent 系统

- **分镜 Agent** (`src/agents/storyboard/`): 多步骤工作流（分段 → 镜头 → 图片生成），基于 EventEmitter 架构
- **大纲/剧本 Agent** (`src/agents/outlineScript/`): 从小说文本生成角色、大纲和剧本
- AI 调用通过 `src/utils/ai/` 统一接口

### 文件存储

使用 `src/utils/oss.ts` 抽象层：
- Electron 打包模式: `userData/uploads/`
- 独立运行模式: `./uploads/`
- 通过 `is-path-inside` 进行路径安全校验

### 测试规范

- 测试文件放在 `tests/e2e/*.test.ts`
- 使用 Vitest + supertest
- 全局配置在 `tests/globalSetup.ts`
- 辅助函数在 `tests/helpers/request.ts`

```typescript
import { describe, it, expect } from "vitest";
import { post, getAuthToken, authGet } from "../helpers/request";

describe("Auth - Login", () => {
  it("should login with valid credentials", async () => {
    const { status, body } = await post("/other/login", {
      username: "admin",
      password: "admin123",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });
});
```

### 环境配置

- 配置文件在 `env/.env.{dev|prod}`
- 由 `src/env.ts` 加载，缺失时自动创建默认文件
- 关键变量: `NODE_ENV`, `PORT`(默认 60000), `OSSURL`

## 目录结构

```
src/
├── agents/           # AI Agent（storyboard, outlineScript）
├── lib/             # 工具库（responseFormat, initDB）
├── middleware/      # 中间件（validateFields）
├── routes/          # API 路由（自动发现）
├── types/           # 类型定义（database.d.ts 自动生成）
├── utils/           # 工具函数（db, oss, ai, error）
├── app.ts           # Express 应用入口
├── core.ts          # 路由扫描与生成
├── env.ts           # 环境变量加载
├── err.ts           # 全局异常处理
├── router.ts        # 生成的路由文件（禁止手动编辑）
└── utils.ts         # 统一导出
```

## 数据流转

```
小说上传 → 角色提取 → 大纲生成 → 剧本生成 → 分镜生成 → 图片生成 → 视频生成
```

## 注意事项

1. **禁止手动编辑** `src/router.ts` 和 `src/types/database.d.ts`，由脚本自动生成
2. 修改表结构后运行 `yarn build` 触发类型重新生成
3. 生产构建前确保 `yarn lint` 通过
4. 数据库文件: 开发环境 `db.sqlite`，测试环境 `db.test.sqlite`

## 补充说明

### 认证机制

- 基于 JWT，从 `Authorization` 请求头或 `?token=` 查询参数获取 token
- 登录接口 `/other/login` 在白名单中无需认证
- token 密钥存储在 `t_setting.tokenKey`

### Electron 集成

- 双模式运行：独立 Express 服务器或 Electron 应用
- 通过 `process.versions.electron` 检测运行环境
- Electron 主进程在 `scripts/main.ts`
- 预构建前端位于 `scripts/web/`

### 数据库详情

- SQLite + Knex.js + Better-SQLite3
- 表结构定义在 `src/lib/initDB.ts`，迁移脚本在 `src/lib/fixDB.ts`
- 主要表: t_project, t_novel, t_outline, t_script, t_storyboard, t_assets, t_video, t_task, t_user, t_setting, t_prompts

### AI 服务层

- **文本** (`ai/text/`): 基于 Vercel AI SDK，支持 7+ 厂商（OpenAI、Anthropic、DeepSeek、Google、xAI、通义千问、智谱）
- **图片** (`ai/image/`): 火山引擎、可灵、Vidu、RunningHub、Gemini、Apimart
- **视频** (`ai/video/`): 火山引擎、可灵、Vidu、万象、Gemini、RunningHub、Apimart
