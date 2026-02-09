//api/src/routes/triage.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
    createTriage,
    listQueueForCashier,
    listQueueForDoctor,
    listRecentForNurse,
    revalueTriage,
    listWaitingForDoctor
} from "../controllers/triage.ctrl";

export const triageRouter = Router();

triageRouter.post("/", requireAuth, requireRole(["NURSE_TRIAGE"]), createTriage);
triageRouter.get("/cashier-queue", requireAuth, requireRole(["CASHIER"]), listQueueForCashier);
triageRouter.get("/doctor-queue", requireAuth, requireRole(["DOCTOR"]), listQueueForDoctor);
triageRouter.get("/nurse/recent", requireAuth, requireRole(["NURSE_TRIAGE"]), listRecentForNurse);
triageRouter.put("/:id/revalue", requireAuth, requireRole(["NURSE_TRIAGE"]), revalueTriage);
triageRouter.get("/doctor/waiting", requireAuth, requireRole(["DOCTOR"]), listWaitingForDoctor);