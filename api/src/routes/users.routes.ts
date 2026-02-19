import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { usersCtrl } from "../controllers/users.ctrl";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole(["ADMIN"]), usersCtrl.list);
usersRouter.post("/", requireAuth, requireRole(["ADMIN"]), usersCtrl.create);
usersRouter.put("/:id", requireAuth, requireRole(["ADMIN"]), usersCtrl.update);
usersRouter.delete("/:id", requireAuth, requireRole(["ADMIN"]), usersCtrl.remove);
