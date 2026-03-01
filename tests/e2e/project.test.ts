import { describe, it, expect } from "vitest";
import { authPost } from "../helpers/request";

describe("Project & Novel CRUD", () => {
  let projectId: number;
  let novelId: number;

  it("should create a project", async () => {
    const { status, body } = await authPost("/project/addProject", {
      name: "Test Project",
      intro: "A test project for E2E",
      type: "短剧",
      artStyle: "写实",
      videoRatio: "16:9",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should list projects (verify the created one exists)", async () => {
    const { status, body } = await authPost("/project/getProject");
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const project = body.data.find((p: any) => p.name === "Test Project");
    expect(project).toBeDefined();
    expect(project.intro).toBe("A test project for E2E");
    expect(project.type).toBe("短剧");
    expect(project.artStyle).toBe("写实");
    expect(project.videoRatio).toBe("16:9");
    projectId = project.id;
  });

  it("should get single project by id", async () => {
    const { status, body } = await authPost("/project/getSingleProject", {
      id: projectId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe("Test Project");
    expect(body.data[0].id).toBe(projectId);
  });

  it("should update project", async () => {
    const { status, body } = await authPost("/project/updateProject", {
      id: projectId,
      intro: "Updated intro",
      type: "动画",
      artStyle: "卡通",
      videoRatio: "9:16",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);

    // Verify the update
    const { body: getBody } = await authPost("/project/getSingleProject", {
      id: projectId,
    });
    expect(getBody.data[0].intro).toBe("Updated intro");
    expect(getBody.data[0].type).toBe("动画");
    expect(getBody.data[0].artStyle).toBe("卡通");
    expect(getBody.data[0].videoRatio).toBe("9:16");
  });

  it("should get project count (all zeros for new project)", async () => {
    const { status, body } = await authPost("/project/getProjectCount", {
      projectId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data.roleCount).toBe(0);
    expect(body.data.scriptCount).toBe(0);
    expect(body.data.videoCount).toBe(0);
    expect(body.data.storyboardCount).toBe(0);
  });

  it("should add novel chapters to project", async () => {
    const { status, body } = await authPost("/novel/addNovel", {
      projectId,
      data: [
        {
          index: 1,
          reel: "第一卷",
          chapter: "第一章",
          chapterData: "这是第一章的内容。",
        },
        {
          index: 2,
          reel: "第一卷",
          chapter: "第二章",
          chapterData: "这是第二章的内容。",
        },
      ],
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should get novels for project", async () => {
    const { status, body } = await authPost("/novel/getNovel", {
      projectId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBe(2);

    // Ordered by chapterIndex asc
    expect(body.data[0].index).toBe(1);
    expect(body.data[0].reel).toBe("第一卷");
    expect(body.data[0].chapter).toBe("第一章");
    expect(body.data[0].chapterData).toBe("这是第一章的内容。");

    expect(body.data[1].index).toBe(2);
    expect(body.data[1].chapter).toBe("第二章");

    novelId = body.data[0].id;
  });

  it("should update a novel chapter", async () => {
    const { status, body } = await authPost("/novel/updateNovel", {
      id: novelId,
      index: 1,
      reel: "第一卷（修订）",
      chapter: "第一章（修订）",
      chapterData: "这是修订后的第一章内容。",
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);

    // Verify the update
    const { body: getBody } = await authPost("/novel/getNovel", {
      projectId,
    });
    const updated = getBody.data.find((n: any) => n.id === novelId);
    expect(updated.reel).toBe("第一卷（修订）");
    expect(updated.chapter).toBe("第一章（修订）");
    expect(updated.chapterData).toBe("这是修订后的第一章内容。");
  });

  it("should delete a novel chapter", async () => {
    const { status, body } = await authPost("/novel/delNovel", {
      id: novelId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);

    // Verify deletion - only one chapter should remain
    const { body: getBody } = await authPost("/novel/getNovel", {
      projectId,
    });
    expect(getBody.data.length).toBe(1);
    expect(getBody.data[0].chapter).toBe("第二章");
  });

  it("should delete project (cascading delete)", async () => {
    const { status, body } = await authPost("/project/delProject", {
      id: projectId,
    });
    expect(status).toBe(200);
    expect(body.code).toBe(200);
  });

  it("should verify project is deleted (empty list)", async () => {
    const { body } = await authPost("/project/getProject");
    const found = body.data.find((p: any) => p.id === projectId);
    expect(found).toBeUndefined();

    // Novels should also be deleted
    const { body: novelBody } = await authPost("/novel/getNovel", {
      projectId,
    });
    expect(novelBody.data.length).toBe(0);
  });
});
