import express from "express";
import expressWs, { Application } from "express-ws";
import u from "@/utils";
import NovelCreationAgent from "@/agents/novelCreation";

const router = express.Router();
expressWs(router as unknown as Application);

router.ws("/", async (ws, req) => {
  let agent: NovelCreationAgent;

  const projectId = req.query.projectId;
  if (!projectId || typeof projectId !== "string") {
    ws.send(JSON.stringify({ type: "error", data: "项目ID缺失" }));
    ws.close(500, "项目ID缺失");
    return;
  }

  agent = new NovelCreationAgent(Number(projectId));

  // 监听事件
  agent.emitter.on("stream", (text) => {
    ws.send(JSON.stringify({ type: "stream", data: text }));
  });

  agent.emitter.on("chapter", (chapter) => {
    ws.send(JSON.stringify({ type: "chapter", data: chapter }));
  });

  agent.emitter.on("complete", (data) => {
    ws.send(JSON.stringify({ type: "complete", data }));
  });

  agent.emitter.on("error", (err) => {
    ws.send(JSON.stringify({ type: "error", data: err.toString() }));
  });

  // 发送初始化完成消息
  ws.send(JSON.stringify({ type: "init", data: { projectId } }));

  type DataType = "create" | "continue" | "cleanHistory";

  ws.on("message", async function (rawData: string) {
    let data: { type: DataType; data: any } | null = null;
    try {
      data = JSON.parse(rawData);
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", data: "数据解析异常" }));
      return;
    }

    if (!data) {
      ws.send(JSON.stringify({ type: "error", data: "数据格式错误" }));
      return;
    }

    try {
      switch (data.type) {
        case "create":
          await agent.create(data.data);
          break;
        case "continue":
          await agent.continueFrom(data.data.chapterId, data.data.prompt);
          break;
        case "cleanHistory":
          agent.history = [];
          ws.send(JSON.stringify({ type: "notice", data: "历史记录已清空" }));
          break;
        default:
          ws.send(JSON.stringify({ type: "error", data: "未知消息类型" }));
      }
    } catch (e: any) {
      ws.send(JSON.stringify({ type: "error", data: e.message || "处理异常" }));
      console.error(e);
    }
  });

  ws.on("close", () => {
    agent?.emitter?.removeAllListeners();
  });
});

export default router;
