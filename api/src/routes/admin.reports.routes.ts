import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { adminReportsCtrl } from "../controllers/admin.reports.ctrl";
import { asyncHandler } from "../utils/asyncHandler";

const r = Router();

// Todos los handlers de este controller son async sin try/catch propio,
// por lo que se envuelven con asyncHandler para propagar errores al middleware global.
r.get("/attended", requireAuth, requireRole("ADMIN", "CONSULTOR"), asyncHandler(adminReportsCtrl.listAttended));
r.get("/attended/:id", requireAuth, requireRole("ADMIN", "CONSULTOR"), asyncHandler(adminReportsCtrl.getDetail));
r.put("/attended/:id", requireAuth, requireRole("ADMIN"), asyncHandler(adminReportsCtrl.updateDetail));

// cancelados (no-show + no quiso pagar)
r.get("/cancelled", requireAuth, requireRole("ADMIN", "CONSULTOR"), asyncHandler(adminReportsCtrl.listCancelled));

// solo enfermería (motivo ≠ CONSULTA, cerrados en caja)
r.get("/cashier-closed", requireAuth, requireRole("ADMIN", "CONSULTOR"), asyncHandler(adminReportsCtrl.listCashierClosed));

// export
r.get("/attended-excel", requireAuth, requireRole("ADMIN", "CONSULTOR"), asyncHandler(adminReportsCtrl.exportExcel));

export default r;
