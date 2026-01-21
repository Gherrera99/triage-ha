import { Router } from "express";
import { auth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { reportsCtrl } from "../controllers/reports.ctrl";

const r = Router();

r.get("/admin-excel", auth, requireRole("ADMIN"), reportsCtrl.getAdminReport);

export default r;
