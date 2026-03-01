import "../type";
import axios from "axios";

/**
 * 阿里百炼（DashScope）原生图片生成 handler
 * 异步任务模式：提交任务 → 轮询结果
 */
export default async (input: ImageConfig, config: AIConfig): Promise<string> => {
  if (!config.model) throw new Error("缺少Model名称");
  if (!config.apiKey) throw new Error("缺少API Key");

  const apiKey = config.apiKey.replace("Bearer ", "");
  let fullPrompt = input.systemPrompt
    ? `${input.systemPrompt}\n\n${input.prompt}`
    : input.prompt;

  // wanx input 总长度限制 61440 字节，预留 1440 给其他字段
  const MAX_PROMPT_LEN = 60000;
  if (fullPrompt.length > MAX_PROMPT_LEN) {
    console.warn(`[qwen] prompt 过长 (${fullPrompt.length})，截断到 ${MAX_PROMPT_LEN}`);
    fullPrompt = fullPrompt.slice(0, MAX_PROMPT_LEN);
  }

  // wanx 尺寸范围 512-1440px，根据 size + aspectRatio 选择最佳尺寸
  const aspectRatio = input.aspectRatio || "1:1";
  const getSizeStr = (size: string, ratio: string): string => {
    const isWide = ratio === "16:9";
    const isTall = ratio === "9:16";
    switch (size) {
      case "4K": return isWide ? "1440*810" : isTall ? "810*1440" : "1024*1024";
      case "2K": return isWide ? "1280*720" : isTall ? "720*1280" : "1024*1024";
      case "1K": return isWide ? "1024*576" : isTall ? "576*1024" : "1024*1024";
      default: return "1024*1024";
    }
  };

  // 1. 提交异步任务（带限流重试）
  const submitUrl =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";

  const submitBody: any = {
    model: config.model,
    input: { prompt: fullPrompt },
    parameters: {
      style: "<auto>",
      size: getSizeStr(input.size, aspectRatio),
      n: 1,
    },
  };

  // wanx 文生图 API 不支持参考图片（ref_img 会导致 input 超长）
  // 如需图生图能力，应使用 wanx 的 image-generation 接口

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
  };

  // 限流重试：最多重试 5 次，每次间隔递增
  let submitRes;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      submitRes = await axios.post(submitUrl, submitBody, {
        headers,
        timeout: 30000,
      });
      break;
    } catch (e: any) {
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.message;
      console.error(`[qwen] 提交失败 attempt=${attempt}: code=${code}, msg=${msg}, status=${e?.response?.status}`);
      if (code === "Throttling.RateQuota" && attempt < 4) {
        const delay = (attempt + 1) * 3000 + Math.random() * 2000;
        console.log(`[qwen] 限流重试 ${attempt + 1}/5，等待 ${Math.round(delay)}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }

  const taskId = submitRes!.data?.output?.task_id;
  if (!taskId) {
    throw new Error(`百炼任务提交失败: ${JSON.stringify(submitRes.data)}`);
  }

  // 2. 轮询任务结果
  const pollUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  const maxWait = 120000;
  const interval = 3000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    const poll = await axios.get(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });
    const status = poll.data?.output?.task_status;

    if (status === "SUCCEEDED") {
      const results = poll.data?.output?.results;
      if (results?.[0]?.url) return results[0].url;
      if (results?.[0]?.b64_image) return results[0].b64_image;
      throw new Error("百炼返回结果中无图片");
    }
    if (status === "FAILED") {
      const errMsg = poll.data?.output?.message || poll.data?.output?.code || "未知错误";
      console.error(`[qwen] 任务失败: taskId=${taskId}, msg=${errMsg}, full=`, JSON.stringify(poll.data?.output));
      throw new Error(`百炼图片生成失败: ${errMsg}`);
    }
  }

  throw new Error("百炼图片生成超时（超过2分钟）");
};
