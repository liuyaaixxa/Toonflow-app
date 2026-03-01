import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 获取资产
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    type: z.string(),
  }),
  async (req, res) => {
    const { projectId, type } = req.body;

    const data = await u.db("t_assets").where("projectId", projectId).where("type", type).select("*");

    const urls = await Promise.all(
      data.map((item: any) => u.oss.getFileUrl(item.filePath ?? ""))
    );
    data.forEach((item: any, i: number) => {
      item.filePath = urls[i];
    });

    res.status(200).send(success(data));
  }
);
