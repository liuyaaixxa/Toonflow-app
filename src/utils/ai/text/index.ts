import u from "@/utils";
import { generateText, streamText, Output, stepCountIs, ModelMessage, LanguageModel, Tool, GenerateTextResult } from "ai";
import { wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { parse } from "best-effort-json-parser";
import modelList from "./modelList";
import { z } from "zod";
import { OpenAIProvider } from "@ai-sdk/openai";

/**
 * 兼容推理模型（如 glm-5）的 fetch 包装器。
 * 推理模型在响应中使用 reasoning_content 而非 content，
 * 导致 Vercel AI SDK 无法解析。此包装器将流式和非流式响应中的
 * reasoning_content 替换为 content，使 SDK 能正常处理。
 *
 * 对于 JSON 响应：智能检查每个 choice.message，仅当 content 为空时
 * 才将 reasoning_content 移入 content。
 * 对于 SSE 流式响应：逐块做简单字符串替换（流式 delta 中 content 和
 * reasoning_content 不会同时出现在同一个 chunk）。
 */
function createReasoningFetch(baseFetch: typeof globalThis.fetch = globalThis.fetch): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await baseFetch(input, init);
    const contentType = response.headers.get("content-type") || "";

    // 非流式 JSON 响应：智能替换
    if (contentType.includes("application/json") && response.body) {
      const text = await response.text();
      let replaced = text;
      if (text.includes('"reasoning_content"')) {
        try {
          const json = JSON.parse(text);
          if (json.choices && Array.isArray(json.choices)) {
            for (const choice of json.choices) {
              const msg = choice.message || choice.delta;
              if (msg && msg.reasoning_content) {
                // 仅当 content 为空时，将 reasoning_content 移入 content
                if (!msg.content || msg.content.trim() === "") {
                  msg.content = msg.reasoning_content;
                }
                delete msg.reasoning_content;
              }
            }
          }
          replaced = JSON.stringify(json);
        } catch {
          // JSON 解析失败，回退到简单替换
          replaced = text.replaceAll('"reasoning_content"', '"content"');
        }
      }
      return new Response(replaced, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    // 流式 SSE 响应：逐块替换
    if (contentType.includes("text/event-stream") && response.body) {
      const reader = response.body.getReader();
      async function* transform() {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = Buffer.from(value).toString("utf-8");
          yield Buffer.from(text.replaceAll('"reasoning_content"', '"content"'), "utf-8");
        }
      }
      return new Response(ReadableStream.from(transform()), {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  };
}
interface AIInput<T extends Record<string, z.ZodTypeAny> | undefined = undefined> {
  system?: string;
  tools?: Record<string, Tool>;
  maxStep?: number;
  output?: T;
  prompt?: string;
  messages?: Array<ModelMessage>;
}

interface AIConfig {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  manufacturer?: string;
}

const buildOptions = async (input: AIInput<any>, config: AIConfig = {}) => {
  if (!config || !config?.model || !config?.apiKey || !config?.manufacturer) throw new Error("请检查模型配置是否正确");
  let { model, apiKey, baseURL, manufacturer } = { ...config };
  // 对于 "other" 厂商（OpenAI 兼容接口），确保 baseURL 包含 /v1 路径
  if (manufacturer === "other" && baseURL && !baseURL.endsWith("/v1") && !baseURL.endsWith("/v1/")) {
    baseURL = baseURL.replace(/\/+$/, "") + "/v1";
  }
  let owned;
  if (manufacturer == "other") {
    owned = modelList.find((m) => m.manufacturer === manufacturer);
  } else {
    owned = modelList.find((m) => m.model === model);
  }
  if (!owned) throw new Error("不支持的模型或厂商");

  const modelInstance = owned.instance({ apiKey, baseURL: baseURL!, name: "xixixi", fetch: createReasoningFetch() } as any);

  const maxStep = input.maxStep ?? (input.tools ? Object.keys(input.tools).length * 5 : undefined);
  const outputBuilders: Record<string, (schema: any) => any> = {
    schema: (s) => {
      return Output.object({ schema: z.object(s) });
    },
    object: () => {
      const jsonSchemaPrompt = `\n请按照以下 JSON Schema 格式返回结果:\n${JSON.stringify(
        z.toJSONSchema(z.object(input.output)),
        null,
        2,
      )}\n只返回结果，不要将Schema返回。`;
      input.system = (input.system ?? "") + jsonSchemaPrompt;
      // return Output.json();
    },
  };

  const output = input.output ? (outputBuilders[owned.responseFormat]?.(input.output) ?? null) : null;
  const chatModelManufacturer = ["doubao", "other", "openai"];
  const modelFn = chatModelManufacturer.includes(owned.manufacturer) ? (modelInstance as OpenAIProvider).chat(model!) : modelInstance(model!);
  return {
    config: {
      model: modelFn as LanguageModel,
      ...(input.system && { system: input.system }),
      ...(input.prompt ? { prompt: input.prompt } : { messages: input.messages! }),
      ...(input.tools && owned.tool && { tools: input.tools }),
      ...(maxStep && { stopWhen: stepCountIs(maxStep) }),
      ...(output && { output }),
    },
    responseFormat: owned.responseFormat,
  };
};

type InferOutput<T> = T extends Record<string, z.ZodTypeAny> ? z.infer<z.ZodObject<T>> : GenerateTextResult<Record<string, Tool>, never>;

const ai = Object.create({}) as {
  invoke<T extends Record<string, z.ZodTypeAny> | undefined = undefined>(input: AIInput<T>, config?: AIConfig): Promise<InferOutput<T>>;
  stream(input: AIInput, config?: AIConfig): Promise<ReturnType<typeof streamText>>;
};

ai.invoke = async (input: AIInput<any>, config: AIConfig) => {
  const options = await buildOptions(input, config);
  const result = await generateText(options.config);
  if (options.responseFormat === "object" && input.output) {
    const pattern = /{[^{}]*}|{(?:[^{}]*|{[^{}]*})*}/g;
    const jsonLikeTexts = Array.from(result.text.matchAll(pattern), (m) => m[0]);

    const res = jsonLikeTexts.map((jsonText) => parse(jsonText));
    return res[0];
  }
  if (options.responseFormat === "schema" && input.output) {
    return JSON.parse(result.text);
  }
  return result;
};

ai.stream = async (input: AIInput, config: AIConfig) => {
  const options = await buildOptions(input, config);
  return streamText(options.config);
};

export default ai;
