//api/src/routes/triage.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
    createTriage,
    listQueueForCashier,
    listQueueForDoctor,
    listRecentForNurse,
    revalueTriage,
    listWaitingForDoctor,
    listMyConsultations,
    listMyAttended,
    listCancelledForDoctor,
    getDoctorTriageDetail,
    nurseOwnReport
} from "../controllers/triage.ctrl";

export const triageRouter = Router();

triageRouter.post("/", requireAuth, requireRole(["NURSE_TRIAGE"]), createTriage);
triageRouter.get("/cashier-queue", requireAuth, requireRole(["CASHIER"]), listQueueForCashier);
triageRouter.get("/doctor-queue", requireAuth, requireRole(["DOCTOR"]), listQueueForDoctor);
triageRouter.get("/nurse/recent", requireAuth, requireRole(["NURSE_TRIAGE"]), listRecentForNurse);
triageRouter.get("/nurse/report/pdf", requireAuth, requireRole(["NURSE_TRIAGE"]), nurseOwnReport);
triageRouter.put("/:id/revalue", requireAuth, requireRole(["NURSE_TRIAGE"]), revalueTriage);
triageRouter.get("/doctor/waiting", requireAuth, requireRole(["DOCTOR"]), listWaitingForDoctor);
triageRouter.get("/doctor/consulting", requireAuth, requireRole("DOCTOR"), listMyConsultations);
triageRouter.get("/doctor/attended", requireAuth, requireRole("DOCTOR"), listMyAttended);
triageRouter.get("/doctor/cancelled", requireAuth, requireRole("DOCTOR"), listCancelledForDoctor);
triageRouter.get("/doctor/:triageId/detail", requireAuth, requireRole("DOCTOR"), getDoctorTriageDetail);