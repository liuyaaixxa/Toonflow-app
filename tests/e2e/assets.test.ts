import { describe, it, expect } from "vitest";
import { authPost } from "../helpers/request";

let projectId: number;
let characterAssetId: number;
let propAssetId: number;
let sceneAssetId: number;

describe("Assets & Video CRUD", () => {
  // Setup: create a project to hold assets
  it("setup: should create a test project", async () => {
    const { status, body } = await authPost("/project/addProject", {
      name: "资产测试项目",
      intro: "测试",
      type: "短剧",
      artStyle: "写实",
      videoRatio: "16:9",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);

    // Retrieve the project ID from the list endpoint
    const listRes = await authPost("/project/getProject");
    expect(listRes.body.code).toBe(200);
    const projects = listRes.body.data;
    const created = projects.find((p: any) => p.name === "资产测试项目");
    expect(created).toBeDefined();
    projectId = created.id;
  });

  it("should add a character asset (角色)", async () => {
    const { status, body } = await authPost("/assets/addAssets", {
      projectId,
      name: "测试角色",
      intro: "一个勇敢的主角",
      type: "角色",
      prompt: "brave hero character",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should add a prop asset (道具)", async () => {
    const { status, body } = await authPost("/assets/addAssets", {
      projectId,
      name: "测试道具",
      intro: "一把神秘的剑",
      type: "道具",
      prompt: "mysterious sword prop",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should add a scene asset (场景)", async () => {
    const { status, body } = await authPost("/assets/addAssets", {
      projectId,
      name: "测试场景",
      intro: "古老的城堡",
      type: "场景",
      prompt: "ancient castle scene",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should get character assets", async () => {
    const { status, body } = await authPost("/assets/getAssets", {
      projectId,
      type: "角色",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("测试角色");
    expect(body.data[0].type).toBe("角色");
    characterAssetId = body.data[0].id;
  });

  it("should get prop assets", async () => {
    const { status, body } = await authPost("/assets/getAssets", {
      projectId,
      type: "道具",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("测试道具");
    propAssetId = body.data[0].id;
  });

  it("should get all assets of a type and verify count", async () => {
    // Add a second character asset
    await authPost("/assets/addAssets", {
      projectId,
      name: "测试角色2",
      intro: "一个神秘的配角",
      type: "角色",
      prompt: "mysterious side character",
    });

    const { status, body } = await authPost("/assets/getAssets", {
      projectId,
      type: "角色",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(2);

    // Also capture scene asset id for later
    const sceneRes = await authPost("/assets/getAssets", {
      projectId,
      type: "场景",
    });
    sceneAssetId = sceneRes.body.data[0].id;
  });

  it("should delete an asset", async () => {
    const { status, body } = await authPost("/assets/delAssets", {
      id: propAssetId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should verify asset is deleted", async () => {
    const { status, body } = await authPost("/assets/getAssets", {
      projectId,
      type: "道具",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it("should get videos for non-existent script (empty result)", async () => {
    const { status, body } = await authPost("/video/getVideo", {
      scriptId: 99999,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it("should get video configs for non-existent script (empty result)", async () => {
    const { status, body } = await authPost("/video/getVideoConfigs", {
      scriptId: 99999,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  // Cleanup: delete the test project
  it("cleanup: should delete the test project", async () => {
    const { status, body } = await authPost("/project/delProject", {
      id: projectId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);

    // Verify project is gone
    const listRes = await authPost("/project/getProject");
    const remaining = listRes.body.data.find(
      (p: any) => p.id === projectId
    );
    expect(remaining).toBeUndefined();
  });
});
