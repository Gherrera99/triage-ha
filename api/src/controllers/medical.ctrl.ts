// api/src/controllers/medical.ctrl.ts
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { buildTriagePdf } from "../services/pdf/triagePdf";
import { emitToRole } from "../socket";

function isConsulta(motivo: any) {
    return String(motivo ?? "").trim().toUpperCase() === "CONSULTA";
}

function asText(v: any) {
    return typeof v === "string" ? v : "";
}

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

            // ✅ solo CONSULTA pasa a médico
            if (!isConsulta(triage.motivoUrgencia)) {
                throw Object.assign(
                    new Error("Este motivo se cierra en Caja (no pasa a Médico)"),
                    { status: 400 }
                );
            }

            // ✅ si ya fue cerrado por caja / no-show / etc, no permitir iniciar
            if (triage.closedAt || triage.refusedPayment || triage.noShow) {
                throw Object.assign(new Error("Este paciente ya fue cerrado"), { status: 409 });
            }

            // ✅ solo si ya está pagado
            if (triage.paidStatus !== "PAID") {
                throw Object.assign(new Error("El paciente aún no está pagado"), { status: 400 });
            }

            // Si ya existe consulta iniciada por OTRO médico => bloquear
            if (triage.medicalNote?.consultationStartedAt && triage.medicalNote.doctorId !== doctor.id) {
                throw Object.assign(new Error("Este paciente ya está siendo atendido por otro médico"), {
                    status: 409,
                });
            }

            // ✅ Schema NUEVO: vigilanciaTexto, contraRefFollowUp, contraRefWhen
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

                    vigilanciaTexto: "",

                    contraRefFollowUp: false,
                    contraRefWhen: null,
                    contrarreferencia: "NO", // (campo legacy requerido en tu schema)

                    pronostico: "",
                },
                update: triage.medicalNote
                    ? {
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

    const existing = await prisma.medicalNote.findUnique({ where: { triageId } });
    if (existing && existing.doctorId !== doctor.id) {
        return res.status(409).json({ error: "Este paciente pertenece a otro médico" });
    }

    // ✅ contrarreferencia “texto legacy” (para no romper reportes viejos)
    const followUp = !!data.contraRefFollowUp;
    const when = typeof data.contraRefWhen === "string" ? data.contraRefWhen.trim() : "";
    const contraLegacy = followUp ? (when ? `SI - ${when}` : "SI") : "NO";

    // ✅ vigilanciaTexto (nuevo); si te llega algo viejo, lo convierte a texto
    const vigilanciaTexto =
        typeof data.vigilanciaTexto === "string"
            ? data.vigilanciaTexto
            : typeof data.vigilancia === "string"
                ? data.vigilancia
                : "";

    const note = await prisma.medicalNote.upsert({
        where: { triageId },
        create: {
            triageId,
            doctorId: doctor.id,
            consultationStartedAt: new Date(),

            padecimientoActual: asText(data.padecimientoActual),
            antecedentes: asText(data.antecedentes),
            exploracionFisica: asText(data.exploracionFisica),
            estudiosParaclinicos: asText(data.estudiosParaclinicos),
            diagnostico: asText(data.diagnostico),
            planTratamiento: asText(data.planTratamiento),

            vigilanciaTexto: asText(vigilanciaTexto),

            contraRefFollowUp: followUp,
            contraRefWhen: when || null,
            contrarreferencia: contraLegacy,

            pronostico: asText(data.pronostico),
        },
        update: {
            // ✅ NO tocar consultationStartedAt aquí
            padecimientoActual: asText(data.padecimientoActual),
            antecedentes: asText(data.antecedentes),
            exploracionFisica: asText(data.exploracionFisica),
            estudiosParaclinicos: asText(data.estudiosParaclinicos),
            diagnostico: asText(data.diagnostico),
            planTratamiento: asText(data.planTratamiento),

            vigilanciaTexto: asText(vigilanciaTexto),

            contraRefFollowUp: followUp,
            contraRefWhen: when || null,
            contrarreferencia: contraLegacy,

            pronostico: asText(data.pronostico),
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

// ✅ NUEVO: doctor marca "No se presentó al llamado"
export async function markNoShow(req: Request, res: Response) {
    const doctor = (req as any).user;
    const triageId = Number(req.params.triageId);
    const reason = String(req.body?.reason ?? "").trim();

    if (!reason) {
        return res.status(400).json({ error: "La justificación es requerida" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const triage = await tx.triageRecord.findUnique({
                where: { id: triageId },
                include: { patient: true, nurse: { select: { id: true, name: true } } },
            });

            if (!triage) throw Object.assign(new Error("No existe triage"), { status: 404 });

            // si ya está cerrado, idempotente
            if (triage.closedAt || triage.noShow) return triage;

            const now = new Date();

            return tx.triageRecord.update({
                where: { id: triageId },
                data: {
                    noShow: true,
                    noShowReason: reason,
                    noShowAt: now,
                    noShowDoctorId: doctor.id,
                    closedAt: now,
                    closedReason: "NO_SHOW",
                },
                include: { patient: true, nurse: { select: { id: true, name: true } } },
            });
        });

        emitToRole("DOCTOR", "triage:updated", result);
        emitToRole("NURSE_TRIAGE", "triage:updated", result);
        emitToRole("CASHIER", "triage:updated", result);

        res.json(result);
    } catch (e: any) {
        const status = e?.status || 500;
        res.status(status).json({ error: e?.message || "Error marcando no-show" });
    }
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