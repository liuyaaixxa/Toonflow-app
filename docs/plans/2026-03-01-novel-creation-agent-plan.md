# 小说创作 Agent 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在小说原文 Tab 页面新增 AI 创作助手功能，支持用户通过提示词让 AI 创作小说章节。

**Architecture:** 复用现有 OutlineScript Agent 架构（WebSocket + EventEmitter + Tools），创建 NovelCreationAgent 类，通过 WebSocket 与前端通信，流式输出创作内容。

**Tech Stack:** TypeScript, Express, WebSocket (express-ws), Vercel AI SDK, SQLite (Knex)

---

## Task 1: 创建 NovelCreationAgent 基础结构

**Files:**
- Create: `src/agents/novelCreation/index.ts`

**Step 1: 创建 Agent 基础类**

创建文件 `src/agents/novelCreation/index.ts`:

```typescript
import u from "@/utils";
import { EventEmitter } from "events";
import { ModelMessage } from "ai";
import { z } from "zod";
import { tool } from "ai";

// ==================== 类型定义 ====================

export interface CreateParams {
  prompt: string;           // 自由输入
  genre?: string;           // 题材
  protagonist?: string;     // 主角
  setting?: string;         // 背景
  conflict?: string;        // 核心冲突
  chapterCount: number;     // 生成章节数
  useRefAssets: boolean;    // 是否引用已有资产
}

interface ChapterData {
  chapterIndex: number;
  chapter: string;
  chapterData: string;
}

// ==================== 主类 ====================

export default class NovelCreationAgent {
  private readonly projectId: number;
  readonly emitter = new EventEmitter();
  history: Array<ModelMessage> = [];

  constructor(projectId: number) {
    this.projectId = projectId;
  }

  // ==================== 工具方法 ====================

  private emit(event: string, data?: any) {
    this.emitter.emit(event, data);
  }

  private log(action: string, detail?: string) {
    const msg = detail ? `${action}: ${detail}` : action;
    console.log(`\n[${new Date().toLocaleTimeString()}] [NovelCreation] ${msg}\n`);
  }

  // ==================== 数据库操作 ====================

  private async getProjectInfo(): Promise<any> {
    return u.db("t_project").where({ id: this.projectId }).first();
  }

  private async getExistingChapters(): Promise<any[]> {
    return u.db("t_novel")
      .where({ projectId: this.projectId })
      .orderBy("chapterIndex", "asc");
  }

  private async getMaxChapterIndex(): Promise<number> {
    const result: any = await u.db("t_novel")
      .where({ projectId: this.projectId })
      .max("chapterIndex as max")
      .first();
    return result?.max ?? 0;
  }

  private async getExistingAssets(): Promise<any[]> {
    return u.db("t_assets").where({ projectId: this.projectId });
  }

  private async saveChapter(chapter: ChapterData): Promise<void> {
    const existing = await u.db("t_novel")
      .where({ projectId: this.projectId, chapterIndex: chapter.chapterIndex })
      .first();

    if (existing) {
      await u.db("t_novel")
        .where({ id: existing.id })
        .update({
          chapter: chapter.chapter,
          chapterData: chapter.chapterData,
        });
    } else {
      await u.db("t_novel").insert({
        projectId: this.projectId,
        chapterIndex: chapter.chapterIndex,
        reel: "",
        chapter: chapter.chapter,
        chapterData: chapter.chapterData,
        createTime: Date.now(),
      });
    }
    this.emit("chapter", chapter);
  }

  // ==================== Tool 定义 ====================

  private saveChapterTool = tool({
    title: "saveChapter",
    description: "保存单个章节到数据库",
    inputSchema: z.object({
      chapterIndex: z.number().describe("章节序号"),
      chapter: z.string().describe("章节名称，10字以内"),
      chapterData: z.string().describe("章节正文内容，500-2000字"),
    }),
    execute: async ({ chapterIndex, chapter, chapterData }) => {
      this.log("保存章节", `第${chapterIndex}章: ${chapter}`);
      await this.saveChapter({ chapterIndex, chapter, chapterData });
      return `章节保存成功: 第${chapterIndex}章 ${chapter}`;
    },
  });

  // ==================== 上下文构建 ====================

  private async buildContext(params: CreateParams): Promise<string> {
    const [projectInfo, existingChapters, existingAssets] = await Promise.all([
      this.getProjectInfo(),
      this.getExistingChapters(),
      params.useRefAssets ? this.getExistingAssets() : [],
    ]);

    let context = `<项目信息>
项目名称: ${projectInfo?.name || "未命名"}
项目简介: ${projectInfo?.intro || "无"}
</项目信息>

<创作参数>
用户提示: ${params.prompt}
${params.genre ? `题材: ${params.genre}` : ""}
${params.protagonist ? `主角: ${params.protagonist}` : ""}
${params.setting ? `背景: ${params.setting}` : ""}
${params.conflict ? `核心冲突: ${params.conflict}` : ""}
生成章节数: ${params.chapterCount}
</创作参数>`;

    if (existingChapters.length > 0) {
      context += `\n\n<已有章节>
${existingChapters.map(c => `第${c.chapterIndex}章: ${c.chapter}`).join("\n")}
</已有章节>`;
    }

    if (existingAssets.length > 0) {
      const characters = existingAssets.filter(a => a.type === "角色");
      const scenes = existingAssets.filter(a => a.type === "场景");
      const props = existingAssets.filter(a => a.type === "道具");

      context += `\n\n<可用资产>
角色: ${characters.map(c => c.name).join(", ") || "无"}
场景: ${scenes.map(s => s.name).join(", ") || "无"}
道具: ${props.map(p => p.name).join(", ") || "无"}
</可用资产>`;
    }

    return context;
  }

  // ==================== 主入口 ====================

  async create(params: CreateParams): Promise<string> {
    this.log("开始创作", `章节数: ${params.chapterCount}`);

    const context = await this.buildContext(params);

    const systemPrompt = `你是一位专业的小说创作助手。请根据用户的提示词创作小说章节。

<创作规则>
1. 每个章节包含：章节名（10字以内）+ 正文（500-2000字）
2. 按用户指定的章节数量生成，每完成一章立即调用 saveChapter 工具保存
3. 如有可用资产（角色/场景/道具），请在创作中合理引用
4. 保持故事连贯性，章节之间要有剧情衔接
</创作规则>

${context}`;

    const { fullStream } = await u.ai.text.stream(
      {
        system: systemPrompt,
        tools: { saveChapter: this.saveChapterTool },
        messages: [
          { role: "user", content: `请创作 ${params.chapterCount} 个章节的小说` },
        ],
        maxSteps: 50,
      },
      { model: "deepseek-chat" }
    );

    let fullResponse = "";
    for await (const item of fullStream) {
      if (item.type === "text-delta") {
        fullResponse += item.text;
        this.emit("stream", item.text);
      }
    }

    this.history.push({ role: "user", content: params.prompt });
    this.history.push({ role: "assistant", content: fullResponse });

    this.emit("complete", { message: "创作完成" });
    return fullResponse;
  }

  async continueFrom(chapterId: number, prompt: string): Promise<string> {
    this.log("续写", `从章节ID: ${chapterId}`);

    const chapter = await u.db("t_novel").where({ id: chapterId }).first();
    if (!chapter) {
      throw new Error("章节不存在");
    }

    const context = await this.buildContext({
      prompt,
      chapterCount: 1,
      useRefAssets: true,
    });

    const systemPrompt = `你是一位专业的小说创作助手。用户希望从指定章节继续创作。

<续写规则>
1. 阅读上一章节内容，延续剧情发展
2. 新章节需要与上一章自然衔接
3. 章节名（10字以内）+ 正文（500-2000字）
4. 完成后调用 saveChapter 工具保存
</续写规则>

<上一章内容>
第${chapter.chapterIndex}章: ${chapter.chapter}
${chapter.chapterData}
</上一章内容>

${context}`;

    const nextIndex = chapter.chapterIndex + 1;

    const { fullStream } = await u.ai.text.stream(
      {
        system: systemPrompt,
        tools: { saveChapter: this.saveChapterTool },
        messages: [
          { role: "user", content: `请续写第${nextIndex}章。${prompt}` },
        ],
        maxSteps: 20,
      },
      { model: "deepseek-chat" }
    );

    let fullResponse = "";
    for await (const item of fullStream) {
      if (item.type === "text-delta") {
        fullResponse += item.text;
        this.emit("stream", item.text);
      }
    }

    this.history.push({ role: "user", content: prompt });
    this.history.push({ role: "assistant", content: fullResponse });

    this.emit("complete", { message: "续写完成" });
    return fullResponse;
  }
}
