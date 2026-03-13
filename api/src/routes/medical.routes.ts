//api/src/routes/medical.routes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { startConsultation, upsertNote, getPdf, finishConsultation, markNoShow } from "../controllers/medical.ctrl";

export const medicalRouter = Router();

medicalRouter.post("/:triageId/start", requireAuth, requireRole(["DOCTOR"]), startConsultation);
medicalRouter.put("/:triageId/note", requireAuth, requireRole(["DOCTOR"]), upsertNote);
medicalRouter.get("/:triageId/pdf", requireAuth, requireRole(["DOCTOR"]), getPdf);
medicalRouter.post("/:triageId/finish", requireAuth, requireRole(["DOCTOR"]), finishConsultation);
medicalRouter.post("/:triageId/no-show", requireAuth, requireRole(["DOCTOR"]), markNoShow);
