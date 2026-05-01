import { Router } from "express";
import { login, changePassword } from "../controllers/auth.ctrl";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

export const authRouter = Router();

// El endpoint register fue eliminado — la creación de usuarios pasa por POST /users
// con validación de política de contraseña y rol ADMIN requerido.

authRouter.post("/login", asyncHandler(login));
authRouter.post("/change-password", requireAuth, asyncHandler(changePassword));
