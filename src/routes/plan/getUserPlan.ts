import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
const router = express.Router();

// 获取用户当前套餐
export default router.get("/", async (req, res) => {
  const userId = (req as any).user?.id || 1;
  const userPlan = await u
    .db("t_user_plan")
    .where("userId", userId)
    .where("status", "active")
    .first();

  if (!userPlan) {
    return res.status(200).send(success(null));
  }

  const plan = await u.db("t_plan").where("id", userPlan.planId).first();
  res.status(200).send(
    success({
      ...userPlan,
      plan: plan ? { ...plan, features: JSON.parse(plan.features || "{}") } : null,
    })
  );
});
