import { Request, Response } from "express";
import { prisma } from "../prisma";
import { buildTriagePdf } from "../services/pdf/triagePdf";
import { emitToRole } from "../socket"; // ✅ agrégalo

export async function startConsultation(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);

    const note = await prisma.medicalNote.upsert({
        where: { triageId },
        create: {
            triageId,
            doctorId: doctor.id,
            consultationStartedAt: new Date(),
            consultationFinishedAt: null, // ✅
            padecimientoActual: "",
            antecedentes: "",
            exploracionFisica: "",
            estudiosParaclinicos: "",
            diagnostico: "",
            planTratamiento: "",
            contrarreferencia: "",
            pronostico: "",
        },
        update: {
            doctorId: doctor.id,
            consultationStartedAt: new Date(),
            consultationFinishedAt: null, // ✅
        },
        include: { doctor: { select: { name: true, cedula: true } } },
    });

    // ✅ avisar a roles para refrescar
    emitToRole("NURSE_TRIAGE", "consultation:started", { triageId });
    emitToRole("DOCTOR", "consultation:started", { triageId });

    res.json(note);
}

export async function upsertNote(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);

    const data = req.body;

    const note = await prisma.medicalNote.upsert({
        where: { triageId },
        create: {
            triageId,
            doctorId: doctor.id,
            consultationStartedAt: new Date(),
            padecimientoActual: data.padecimientoActual ?? "",
            antecedentes: data.antecedentes ?? "",
            exploracionFisica: data.exploracionFisica ?? "",
            estudiosParaclinicos: data.estudiosParaclinicos ?? "",
            diagnostico: data.diagnostico ?? "",
            diagnosisPrincipal: data.diagnosisPrincipal ?? null,
            planTratamiento: data.planTratamiento ?? "",
            vigilancia: data.vigilancia ?? null,
            contrarreferencia: data.contrarreferencia ?? "",
            pronostico: data.pronostico ?? "",
        },
        update: {
            doctorId: doctor.id,
            padecimientoActual: data.padecimientoActual ?? "",
            antecedentes: data.antecedentes ?? "",
            exploracionFisica: data.exploracionFisica ?? "",
            estudiosParaclinicos: data.estudiosParaclinicos ?? "",
            diagnostico: data.diagnostico ?? "",
            diagnosisPrincipal: data.diagnosisPrincipal ?? null,
            planTratamiento: data.planTratamiento ?? "",
            vigilancia: data.vigilancia ?? null,
            contrarreferencia: data.contrarreferencia ?? "",
            pronostico: data.pronostico ?? "",
        },
    });

    res.json(note);
}

export async function getPdf(req: Request, res: Response) {
    const triageId = Number(req.params.triageId);

    const triage = await prisma.triageRecord.findUnique({
        where: { id: triageId },
        include: {
            patient: true,
            nurse: { select: { name: true } },
            payment: { include: { cashier: { select: { name: true } } } },
            medicalNote: { include: { doctor: { select: { name: true, cedula: true } } } },
        },
    });

    if (!triage) return res.status(404).json({ message: "No existe triage" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="triage_${triageId}.pdf"`);

    buildTriagePdf(triage, res);
}

export async function finishConsultation(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);

    const existing = await prisma.medicalNote.findUnique({ where: { triageId } });
    if (!existing) return res.status(404).json({ error: "No existe nota médica para este triage" });

    const note = await prisma.medicalNote.update({
        where: { triageId },
        data: {
            doctorId: doctor.id,
            consultationFinishedAt: new Date(),
        },
        include: { doctor: { select: { name: true, cedula: true } } },
    });

    // ✅ avisar a Enfermería/Doctor para refrescar estatus
    emitToRole("NURSE_TRIAGE", "consultation:finished", { triageId });
    emitToRole("DOCTOR", "consultation:finished", { triageId });

    res.json(note);
}
