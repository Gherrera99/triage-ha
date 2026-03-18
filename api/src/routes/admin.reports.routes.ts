import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { adminReportsCtrl } from "../controllers/admin.reports.ctrl";

const r = Router();

r.get("/attended", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.listAttended);
r.get("/attended/:id", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.getDetail);
r.put("/attended/:id", requireAuth, requireRole(["ADMIN"]), adminReportsCtrl.updateDetail);

// cancelados (no-show + no quiso pagar)
r.get("/cancelled", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.listCancelled);

// solo enfermería (motivo ≠ CONSULTA, cerrados en caja)
r.get("/cashier-closed", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.listCashierClosed);

// export
r.get("/attended-excel", requireAuth, requireRole(["ADMIN", "CONSULTOR"]), adminReportsCtrl.exportExcel);

export default r;
