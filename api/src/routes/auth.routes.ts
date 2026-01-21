import { Router } from "express";
import { login, register } from "../controllers/auth.ctrl";
import { requireAuth, requireRole } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", requireAuth, requireRole(["ADMIN"]), register);
