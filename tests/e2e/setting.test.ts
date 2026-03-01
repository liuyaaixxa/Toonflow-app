import { describe, it, expect } from "vitest";
import { authPost, authGet } from "../helpers/request";

describe("Setting - Config & Prompts", () => {
  it("should get initial settings (empty config)", async () => {
    const { status, body } = await authPost("/setting/getSetting");
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  it("should add a text model config", async () => {
    const { status, body } = await authPost("/setting/addModel", {
      type: "text",
      model: "gpt-4",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-key",
      modelType: "chat",
      manufacturer: "openai",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should get settings after adding model", async () => {
    const { status, body } = await authPost("/setting/getSetting");
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].model).toBe("gpt-4");
    expect(body.data[0].type).toBe("text");
    expect(body.data[0].manufacturer).toBe("openai");
  });

  it("should get prompts (init data exists)", async () => {
    const { status, body } = await authGet("/prompt/getPrompts");
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
