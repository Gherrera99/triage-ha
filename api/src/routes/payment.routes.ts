import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { markPaid } from "../controllers/payment.ctrl";

export const paymentRouter = Router();

paymentRouter.patch("/:triageId/paid", requireAuth, requireRole(["CASHIER"]), markPaid);
