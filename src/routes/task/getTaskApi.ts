import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

export default router.get(
  "/",
  validateFields({
    projectName: z.string().optional().default(""),
    taskName: z.string().optional().default(""),
    state: z.string().optional().default(""),
    page: z.coerce.number().optional().default(1),
    limit: z.coerce.number().optional().default(10),
  }, "query"),
  async (req, res) => {
    const { projectName, taskName, state, page = 1, limit = 10 }: any = req.query;
    const offset = (page - 1) * limit;
    const data = await u
      .db("t_taskList")
      .andWhere((qb) => {
        if (projectName) {
          qb.andWhere("t_taskList.projectName", projectName);
        }
        if (taskName) {
          qb.andWhere("t_taskList.name", taskName);
        }
        if (state) {
          qb.andWhere("t_taskList.state", state);
        }
      })
      .select("*")
      .offset(offset)
      .limit(limit);
    const totalQuery = (await u
      .db("t_taskList")
      .andWhere((qb) => {
        if (projectName) {
          qb.andWhere("t_taskList.projectName", projectName);
        }
        if (taskName) {
          qb.andWhere("t_taskList.name", taskName);
        }
        if (state) {
          qb.andWhere("t_taskList.state", state);
        }
      })
      .count("* as total")
      .first()) as any;
    res.status(200).send(success({ data, total: totalQuery?.total }));
  }
);
