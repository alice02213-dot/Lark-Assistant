import { Router } from "express";
import { listUsers } from "../lark/users";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users, total: users.length });
  } catch (err) {
    next(err);
  }
});

export default router;
