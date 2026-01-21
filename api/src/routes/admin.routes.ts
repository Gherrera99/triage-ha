import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAdminReport } from "../controllers/admin.ctrl";

export const adminRouter = Router();

adminRouter.get("/report", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), getAdminReport);
