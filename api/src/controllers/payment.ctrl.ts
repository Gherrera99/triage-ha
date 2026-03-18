//api/src/controllers/payment.ctrl.ts
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";

function normalizeExpediente(v: any): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const up = s.toUpperCase();

    // acepta variaciones/typos
    if (up === "SIN EXPEDIENTE" || up === "SIN EXPENDIENTE") return null;

    return s;
}

function isConsulta(motivo: any): boolean {
    const s = String(motivo ?? "").trim().toUpperCase();
    return s === "CONSULTA";
}

async function applyExpedienteIfProvided(tx: any, triageId: number, expedienteRaw: any) {
    const expediente = normalizeExpediente(expedienteRaw);
    if (!expediente) return;

    const triage = await tx.triageRecord.findUnique({
        where: { id: triageId },
        include: { patient: true },
    });
    if (!triage) return;

    // si ya lo tiene igual, nada
    if ((triage.patient?.expediente ?? "").toLowerCase() === expediente.toLowerCase()) return;

    // si el expediente ya existe en otro paciente, re-vincula el triage a ese patient
    const other = await tx.patient.findUnique({ where: { expediente } });

    if (other && other.id !== triage.patientId) {
        await tx.triageRecord.update({
            where: { id: triageId },
            data: { patientId: other.id },
        });
        return;
    }

    // si no existe, lo asigna al paciente actual
    await tx.patient.update({
        where: { id: triage.patientId },
        data: { expediente },
    });
}

export async function payTriage(req: Request, res: Response) {
    const cashier = (req as any).user;
    const triageId = Number(req.params.triageId);

    if (!triageId || Number.isNaN(triageId)) {
        return res.status(400).json({ error: "triageId inválido" });
    }

    const expediente = req.body?.expediente;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const triage = await tx.triageRecord.findUnique({
                where: { id: triageId },
                include: {
                    patient: true,
                    nurse: { select: { id: true, name: true } },
                    payment: true,
                },
            });

            if (!triage) throw Object.assign(new Error("No existe el triage"), { status: 404 });

            // ✅ permitir actualizar expediente incluso si ya estaba pagado
            await applyExpedienteIfProvided(tx, triageId, expediente);

            // idempotente: si ya está pagado, solo regresa actualizado (con paciente quizá ya re-vinculado)
            if (triage.paidStatus === "PAID") {
                return tx.triageRecord.findUnique({
                    where: { id: triageId },
                    include: { patient: true, nurse: { select: { id: true, name: true } }, payment: true },
                });
            }

            const now = new Date();
            const consulta = isConsulta(triage.motivoUrgencia);

            // ✅ pagar
            await tx.triageRecord.update({
                where: { id: triageId },
                data: {
                    paidStatus: "PAID",

                    // ✅ si NO es consulta => cierra flujo en caja
                    ...(consulta
                        ? {}
                        : {
                            closedAt: now,
                            closedReason: "CASHIER_FINISHED",
                        }),
                },
            });

            await tx.payment.upsert({
                where: { triageId },
                create: {
                    triageId,
                    cashierId: cashier.id,
                    status: "PAID",
                    amount: null, // ✅ ya no se captura
                    paidAt: now,
                },
                update: {
                    cashierId: cashier.id,
                    status: "PAID",
                    amount: null, // ✅ ya no se captura
                    paidAt: now,
                },
            });

            return tx.triageRecord.findUnique({
                where: { id: triageId },
                include: {
                    patient: true,
                    nurse: { select: { id: true, name: true } },
                    payment: true,
                },
            });
        });

        // ✅ eventos para refresco en vivo (caja y enfermería siempre)
        emitToRole("CASHIER", "triage:updated", result);
        emitToRole("NURSE_TRIAGE", "triage:updated", result);

        // ✅ SOLO si es consulta (si no, NO debe llegar a médico)
        if (isConsulta(result?.motivoUrgencia) && !result?.closedAt) {
            emitToRole("DOCTOR", "triage:updated", result);
            emitToRole("DOCTOR", "payment:paid", result);
        } else {
            // ✅ si NO es consulta, notificar admin/consultor para refrescar pestaña "Solo Enfermería"
            emitToRole("ADMIN", "report:updated", { triageId: result?.id });
            emitToRole("CONSULTOR", "report:updated", { triageId: result?.id });
        }

        res.json(result);
    } catch (e: any) {
        const status = e?.status || 500;
        res.status(status).json({ error: e?.message || "Error al cobrar" });
    }
}

// ✅ NUEVO: caja marca "No quiso pagar" => termina flujo y no llega a médico
export async function refusePayment(req: Request, res: Response) {
    const cashier = (req as any).user;
    const triageId = Number(req.params.triageId);

    if (!triageId || Number.isNaN(triageId)) {
        return res.status(400).json({ error: "triageId inválido" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const triage = await tx.triageRecord.findUnique({
                where: { id: triageId },
                include: { patient: true, nurse: { select: { id: true, name: true } } },
            });
            if (!triage) throw Object.assign(new Error("No existe el triage"), { status: 404 });

            // si ya está cerrado, idempotente
            if (triage.closedAt || triage.refusedPayment) return triage;

            const now = new Date();

            return tx.triageRecord.update({
                where: { id: triageId },
                data: {
                    refusedPayment: true,
                    closedAt: now,
                    closedReason: "REFUSED_PAYMENT",
                    // paidStatus se queda PENDING (no pagó)
                },
                include: { patient: true, nurse: { select: { id: true, name: true } }, payment: true },
            });
        });

        emitToRole("CASHIER", "triage:updated", result);
        emitToRole("NURSE_TRIAGE", "triage:updated", result);
        // ❌ NO emitir a DOCTOR
        emitToRole("ADMIN", "report:updated", { triageId: result.id });
        emitToRole("CONSULTOR", "report:updated", { triageId: result.id });

        res.json(result);
    } catch (e: any) {
        const status = e?.status || 500;
        res.status(status).json({ error: e?.message || "Error marcando no pago" });
    }
}