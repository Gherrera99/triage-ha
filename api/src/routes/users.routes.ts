import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { listUsers, createUser } from "../controllers/users.ctrl";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole(["ADMIN"]), listUsers);
usersRouter.post("/", requireAuth, requireRole(["ADMIN"]), createUser);
