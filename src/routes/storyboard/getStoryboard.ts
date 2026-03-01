import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

// 获取分镜
export default router.post(
  "/",
  validateFields({
    scriptId: z.number(),
    projectId: z.number(),
  }),
  async (req, res) => {
    const { scriptId } = req.body;

    const assets = await u
      .db("t_assets")
      .where("scriptId", scriptId)
      .where("type", "分镜")
      .select("id", "name", "intro", "prompt", "filePath", "duration", "videoPrompt", "scriptId", "type", "segmentId", "shotIndex").orderBy("segmentId", "asc").orderBy("shotIndex", "asc");

    const assetsIds = assets.map((item: any) => item.id);

    const generateImg = await u.db("t_image").whereIn("assetsId", assetsIds).where("type", "分镜").select("assetsId", "filePath");

    // 用 Map 做 O(1) 查找，避免 O(n²) 的 filter
    const imgMap = new Map<number, typeof generateImg>();
    for (const img of generateImg) {
      const key = Number(img.assetsId);
      if (!imgMap.has(key)) imgMap.set(key, []);
      imgMap.get(key)!.push(img);
    }

    // 并行处理所有 URL 生成
    const [assetUrls, imgUrls] = await Promise.all([
      Promise.all(assets.map((item: any) => u.oss.getFileUrl(item.filePath ?? ""))),
      Promise.all(generateImg.map((img: any) => u.oss.getFileUrl(img.filePath ?? ""))),
    ]);

    // 建立 img filePath → url 的映射
    const imgUrlMap = new Map<string, string>();
    generateImg.forEach((img: any, i: number) => {
      imgUrlMap.set(img.filePath ?? "", imgUrls[i]);
    });

    const data = assets.map((item: any, i: number) => {
      const imgs = imgMap.get(Number(item.id)) || [];
      return {
        id: item.id,
        name: item.name,
        intro: item.intro,
        prompt: item.prompt,
        videoPrompt: item.videoPrompt,
        filePath: assetUrls[i],
        type: item.type,
        scriptId: item.scriptId,
        duration: item.duration,
        segmentId: item.segmentId ?? 1,
        shotIndex: item.shotIndex ?? 1,
        generateImg: imgs.map((img: any) => ({
          ...img,
          filePath: imgUrlMap.get(img.filePath ?? "") || "",
        })),
      };
    });

    res.status(200).send(success(data));
  }
);
