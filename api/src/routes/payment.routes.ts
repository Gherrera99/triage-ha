import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { payTriage } from "../controllers/payment.ctrl";

export const paymentRouter = Router();

// Marcar un triage como pagado (Caja)
paymentRouter.post("/:triageId/pay", requireAuth, requireRole(["CASHIER"]), payTriage);
