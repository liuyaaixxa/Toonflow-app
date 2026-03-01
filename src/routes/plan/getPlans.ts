import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

// 获取所有套餐
export default router.get("/", async (req, res) => {
  const plans = await u.db("t_plan").orderBy("sort", "asc").select("*");
  const parsed = plans.map((p: any) => ({
    ...p,
    features: JSON.parse(p.features || "{}"),
  }));
  res.status(200).send(success(parsed));
});
