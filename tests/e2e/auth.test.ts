import { describe, it, expect } from "vitest";
import { getBaseUrl } from "../setup";
import { post, getAuthToken, authGet } from "../helpers/request";

describe("Auth - Login", () => {
  it("should login with valid credentials", async () => {
    const { status, body } = await post("/other/login", {
      username: "admin",
      password: "admin123",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data.token).toContain("Bearer ");
    expect(body.data.name).toBe("admin");
  });

  it("should reject invalid credentials", async () => {
    const { status, body } = await post("/other/login", {
      username: "admin",
      password: "wrong",
    });
    expect(status).toBe(400);
  });

  it("should reject missing fields", async () => {
    const { status } = await post("/other/login", { username: "admin" });
    expect(status).toBe(400);
  });

  it("should require auth for protected routes", async () => {
    const res = await fetch(`${getBaseUrl()}/project/getProject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("should accept token from query parameter", async () => {
    const token = await getAuthToken();
    const bareToken = token.replace("Bearer ", "");
    const res = await fetch(
      `${getBaseUrl()}/user/getUser?token=${bareToken}`,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toBeDefined();
  });

  it("should get user info", async () => {
    const { status, body } = await authGet("/user/getUser");
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe("admin");
  });
});
