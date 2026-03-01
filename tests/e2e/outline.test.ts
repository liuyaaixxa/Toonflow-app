import { describe, it, expect } from "vitest";
import { authPost } from "../helpers/request";

const outlineData = JSON.stringify({
  characters: [{ name: "角色A", intro: "主角" }],
  props: [{ name: "道具A", intro: "武器" }],
  scenes: [{ name: "场景A", intro: "城市" }],
  plot: "测试剧情",
});

const updatedOutlineData = JSON.stringify({
  characters: [{ name: "角色B", intro: "配角" }],
  props: [{ name: "道具B", intro: "盾牌" }],
  scenes: [{ name: "场景B", intro: "森林" }],
  plot: "更新后的剧情",
});

let projectId: number;
let outlineId: number;

describe("Outline, Script & Storyboard CRUD", () => {
  // Setup: create a project
  it("should create a test project", async () => {
    await authPost("/project/addProject", {
      name: "测试项目",
      intro: "测试",
      type: "短剧",
      artStyle: "写实",
      videoRatio: "16:9",
    });

    const { body } = await authPost("/project/getProject");
    expect(body.code).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);

    const project = body.data.find(
      (p: any) => p.name === "测试项目"
    );
    expect(project).toBeDefined();
    projectId = project.id;
  });

  // Outline tests
  it("should add an outline", async () => {
    const { body } = await authPost("/outline/addOutline", {
      projectId,
      data: outlineData,
    });
    expect(body.code).toBe(200);
  });

  it("should get outlines for project", async () => {
    const { body } = await authPost("/outline/getOutline", {
      projectId,
    });
    expect(body.code).toBe(200);
    expect(body.data.length).toBe(1);

    const outline = body.data[0];
    expect(outline.projectId).toBe(projectId);
    expect(JSON.parse(outline.data).plot).toBe("测试剧情");
    outlineId = outline.id;
  });

  it("should update outline", async () => {
    const { body: updateBody } = await authPost(
      "/outline/updateOutline",
      { id: outlineId, data: updatedOutlineData }
    );
    expect(updateBody.code).toBe(200);

    // Verify the update
    const { body } = await authPost("/outline/getOutline", {
      projectId,
    });
    const outline = body.data.find(
      (o: any) => o.id === outlineId
    );
    expect(JSON.parse(outline.data).plot).toBe(
      "更新后的剧情"
    );
  });

  // Script tests
  it("should get scripts for project", async () => {
    const { body } = await authPost("/script/geScriptApi", {
      projectId,
    });
    expect(body.code).toBe(200);
    // Outlines exist but no script rows linked yet,
    // so the join returns rows with null script fields
    expect(Array.isArray(body.data)).toBe(true);
  });

  // Storyboard tests
  it("should get storyboard (empty for new project)", async () => {
    // Use scriptId 0 since no real script exists;
    // the endpoint should return an empty array
    const { body } = await authPost(
      "/storyboard/getStoryboard",
      { scriptId: 0, projectId }
    );
    expect(body.code).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  // Delete outline
  it("should delete outline", async () => {
    const { body } = await authPost("/outline/delOutline", {
      id: outlineId,
      projectId,
    });
    expect(body.code).toBe(200);
  });

  it("should verify outline is deleted", async () => {
    const { body } = await authPost("/outline/getOutline", {
      projectId,
    });
    expect(body.code).toBe(200);
    expect(body.data.length).toBe(0);
  });

  // Cleanup: delete the test project
  it("should delete the test project", async () => {
    const { body } = await authPost("/project/delProject", {
      id: projectId,
    });
    expect(body.code).toBe(200);

    // Verify project is gone
    const { body: listBody } = await authPost(
      "/project/getProject"
    );
    const found = listBody.data.find(
      (p: any) => p.id === projectId
    );
    expect(found).toBeUndefined();
  });
});
