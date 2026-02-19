import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { adminReportsCtrl } from "../controllers/admin.reports.ctrl";

const r = Router();

r.get("/attended", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.listAttended);
r.get("/attended/:id", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.getDetail);
r.put("/attended/:id", requireAuth, requireRole(["ADMIN"]), adminReportsCtrl.updateDetail);

// export
r.get("/attended-excel", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.exportExcel);

export default r;
