# 小说创作 Agent 设计文档

## 概述

在"小说原文"Tab 页面新增 AI 创作助手功能，支持用户通过提示词让 AI 创作小说章节，结果自动保存到原文管理列表。

## 需求

### 功能需求

| 需求 | 描述 |
|------|------|
| 混合输入 | 自由输入 + 可选引导字段（题材、主角、背景、冲突） |
| 可配置章节数 | 用户可指定生成 1-N 个章节 |
| 引用资产 | 可选择是否引用已有角色/场景/道具 |
| 流式输出 | 实时显示 AI 创作内容 |
| 续写功能 | 从指定章节继续创作 |
| 编辑/删除 | 支持对已生成内容的编辑和删除 |

### 非功能需求

- 复用现有 OutlineScript Agent 架构
- 支持对话历史，实现连续创作
- 与现有小说管理功能无缝集成

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    小说原文 Tab 页面                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AI 创作区（上方）                        │   │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │ 引导字段（可选） │  │ 自由输入框              │   │   │
│  │  │ - 题材          │  │                         │   │   │
│  │  │ - 主角          │  │  请描述你想创作的故事... │   │   │
│  │  │ - 背景          │  │                         │   │   │
│  │  │ - 核心冲突      │  └─────────────────────────┘   │   │
│  │  │ - 生成章节数    │  [引用已有资产] [开始创作]    │   │   │
│  │  └─────────────────┘                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              原文列表（下方）                         │   │
│  │  章节1  章节2  章节3  ...  [编辑] [续写] [删除]      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 文件 | 说明 |
|------|------|------|
| NovelCreationAgent | `src/agents/novelCreation/index.ts` | Agent 核心类 |
| WebSocket 路由 | `src/routes/novel/createNovel.ts` | 处理前端通信 |
| Prompt 配置 | `t_prompts` 表 | novelCreation-main |

### Agent 类设计

```typescript
// src/agents/novelCreation/index.ts

class NovelCreationAgent {
  projectId: number
  emitter: EventEmitter
  history: ModelMessage[]

  // 核心方法
  async create(params: CreateParams): Promise<void>
  async continueFrom(chapterId: number, prompt: string): Promise<void>

  // Tools
  saveChapters     // 保存章节到 t_novel
  getExistingAsset // 获取已有资产
  getChapters      // 获取已有章节
}

interface CreateParams {
  prompt: string           // 自由输入
  genre?: string           // 题材
  protagonist?: string     // 主角
  setting?: string         // 背景
  conflict?: string        // 核心冲突
  chapterCount: number     // 生成章节数
  useRefAssets: boolean    // 是否引用已有资产
}
```

### WebSocket 消息格式

```typescript
// 前端 → 后端
{ type: "create", data: CreateParams }           // 开始创作
{ type: "continue", data: { chapterId, prompt }} // 续写
{ type: "cleanHistory" }                          // 清空历史

// 后端 → 前端
{ type: "init", data: { projectId } }            // 初始化完成
{ type: "stream", data: "文字..." }              // 流式输出
{ type: "chapter", data: { index, title, content }} // 单章节完成
{ type: "complete", data: { count } }            // 全部完成
{ type: "error", data: "错误信息" }
```

### 数据库

复用现有 `t_novel` 表，无需新增表结构。

## 实现步骤

1. 创建 NovelCreationAgent 类
2. 创建 WebSocket 路由
3. 添加 Prompt 配置
4. 前端界面实现（待确认）

## 风险与注意事项

- Prompt 质量直接影响生成效果，需要调试优化
- 长篇创作可能需要分段处理，避免 token 超限
- 续写时需要合理控制上下文长度
