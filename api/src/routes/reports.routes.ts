// api/src/routes/reports.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { reportsCtrl } from "../controllers/reports.ctrl";

const r = Router();

// Excel (por rango). Para un día, mandas startDate=endDate
r.get("/admin-excel", requireAuth, requireRole("ADMIN", "CONSULTOR"), reportsCtrl.getAdminReport);

export default r;
