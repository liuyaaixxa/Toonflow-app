import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 订阅套餐
export default router.post(
  "/",
  validateFields({ planId: z.number() }),
  async (req, res) => {
    const userId = (req as any).user?.id || 1;
    const { planId } = req.body;

    const plan = await u.db("t_plan").where("id", planId).first();
    if (!plan) {
      return res.status(200).send(error("套餐不存在"));
    }

    // 计算到期时间
    const now = Date.now();
    let endTime = -1;
    if (plan.period === "monthly") {
      endTime = now + 30 * 24 * 60 * 60 * 1000;
    } else if (plan.period === "yearly") {
      endTime = now + 365 * 24 * 60 * 60 * 1000;
    }

    // 将当前活跃订阅设为过期
    await u
      .db("t_user_plan")
      .where("userId", userId)
      .where("status", "active")
      .update({ status: "expired" });

    // 创建新订阅
    await u.db("t_user_plan").insert({
      userId,
      planId,
      startTime: now,
      endTime,
      status: "active",
    });

    const newUserPlan = await u
      .db("t_user_plan")
      .where("userId", userId)
      .where("status", "active")
      .first();

    res.status(200).send(
      success({
        ...newUserPlan,
        plan: { ...plan, features: JSON.parse(plan.features || "{}") },
      })
    );
  }
);
