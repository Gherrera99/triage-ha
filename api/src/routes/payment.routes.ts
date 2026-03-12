import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { payTriage, refusePayment } from "../controllers/payment.ctrl";

export const paymentRouter = Router();

// Marcar un triage como pagado (Caja)
paymentRouter.post("/:triageId/pay", requireAuth, requireRole(["CASHIER", "ADMIN"]), payTriage);
paymentRouter.post("/:triageId/refuse", requireAuth, requireRole(["CASHIER", "ADMIN"]), refusePayment);
