import { Request, Response } from "express";
import { prisma } from "../prisma";
import { buildTriagePdf } from "../services/pdf/triagePdf";

export async function startConsultation(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);

    const note = await prisma.medicalNote.upsert({
        where: { triageId },
        create: {
            triageId,
            doctorId: doctor.id,
            consultationStartedAt: new Date(),
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
        },
        include: { doctor: { select: { name: true, cedula: true } } },
    });

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
