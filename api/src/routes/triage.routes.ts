import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { createTriage, listQueueForCashier, listQueueForDoctor } from "../controllers/triage.ctrl";

export const triageRouter = Router();

triageRouter.post("/", requireAuth, requireRole(["NURSE_TRIAGE"]), createTriage);
triageRouter.get("/cashier-queue", requireAuth, requireRole(["CASHIER"]), listQueueForCashier);
triageRouter.get("/doctor-queue", requireAuth, requireRole(["DOCTOR"]), listQueueForDoctor);
