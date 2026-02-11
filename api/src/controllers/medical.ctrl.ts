//api/src/controllers/medical.ctrl.ts
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { buildTriagePdf } from "../services/pdf/triagePdf";
import { emitToRole } from "../socket"; // ✅ agrégalo

export async function startConsultation(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);

    try {
        const note = await prisma.$transaction(async (tx) => {
            const triage = await tx.triageRecord.findUnique({
                where: { id: triageId },
                include: { medicalNote: true },
            });

            if (!triage) throw Object.assign(new Error("No existe triage"), { status: 404 });

            // solo si ya está pagado
            if (triage.paidStatus !== "PAID") {
                throw Object.assign(new Error("El paciente aún no está pagado"), { status: 400 });
            }

            // Si ya existe consulta iniciada por OTRO médico => bloquear
            if (triage.medicalNote?.consultationStartedAt && triage.medicalNote.doctorId !== doctor.id) {
                throw Object.assign(new Error("Este paciente ya está siendo atendido por otro médico"), { status: 409 });
            }

            // Si NO hay nota, la crea. Si hay nota del mismo doctor, asegura startedAt.
            const created = await tx.medicalNote.upsert({
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
                    vigilancia: null,
                    contrarreferencia: "",
                    pronostico: "",
                },
                update: triage.medicalNote
                    ? {
                        // NO cambies doctorId si ya lo tomó el mismo
                        doctorId: doctor.id,
                        consultationStartedAt: triage.medicalNote.consultationStartedAt ?? new Date(),
                    }
                    : {
                        doctorId: doctor.id,
                        consultationStartedAt: new Date(),
                    },
                include: { doctor: { select: { name: true, cedula: true } } },
            });

            return created;
        });

        // 🔔 broadcast a DOCTOR y NURSE_TRIAGE para que refresquen tabs/listas
        emitToRole("DOCTOR", "consultation:started", { triageId, doctorId: doctor.id });
        emitToRole("NURSE_TRIAGE", "consultation:started", { triageId, doctorId: doctor.id });

        res.json(note);
    } catch (e: any) {
        const status = e?.status || 500;
        res.status(status).json({ error: e?.message || "Error iniciando consulta" });
    }
}

export async function upsertNote(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);
    const data = req.body ?? {};

    // ✅ valida ANTES
    const existing = await prisma.medicalNote.findUnique({ where: { triageId } });
    if (existing && existing.doctorId !== doctor.id) {
        return res.status(409).json({ error: "Este paciente pertenece a otro médico" });
    }

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
            planTratamiento: data.planTratamiento ?? "",
            vigilancia: data.vigilancia ?? null,
            contrarreferencia: data.contrarreferencia ?? "",
            pronostico: data.pronostico ?? "",
        },
        update: {
            // ✅ NO toques consultationStartedAt aquí
            padecimientoActual: data.padecimientoActual ?? "",
            antecedentes: data.antecedentes ?? "",
            exploracionFisica: data.exploracionFisica ?? "",
            estudiosParaclinicos: data.estudiosParaclinicos ?? "",
            diagnostico: data.diagnostico ?? "",
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

    if (existing.doctorId !== doctor.id) {
        return res.status(409).json({ error: "Este paciente pertenece a otro médico" });
    }

    const note = await prisma.medicalNote.update({
        where: { triageId },
        data: { consultationFinishedAt: new Date() },
        include: { doctor: { select: { name: true, cedula: true } } },
    });

    emitToRole("NURSE_TRIAGE", "consultation:finished", { triageId, doctorId: doctor.id });
    emitToRole("DOCTOR", "consultation:finished", { triageId, doctorId: doctor.id });

    res.json(note);
}
