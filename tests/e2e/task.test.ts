import { describe, it, expect } from "vitest";
import { getBaseUrl } from "../setup";
import { getAuthToken } from "../helpers/request";

describe("Task - Task API", () => {
  it("should get empty task list", async () => {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      page: "1",
      limit: "10",
    });
    const res = await fetch(
      `${getBaseUrl()}/task/getTaskApi?${params.toString()}`,
      { headers: { Authorization: token } },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data.data).toEqual([]);
    expect(body.data.total).toBe(0);
  });
});
