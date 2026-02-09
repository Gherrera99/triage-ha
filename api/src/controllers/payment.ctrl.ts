//api/src/controllers/payment.ctrl.ts
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";

export async function payTriage(req: Request, res: Response) {
    const cashier = (req as any).user;
    const triageId = Number(req.params.triageId);

    if (!triageId || Number.isNaN(triageId)) {
        return res.status(400).json({ error: "triageId inválido" });
    }

    const rawAmount = req.body?.amount;
    const amount =
        rawAmount === "" || rawAmount === undefined || rawAmount === null
            ? null
            : Number(rawAmount);

    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
        return res.status(400).json({ error: "amount inválido" });
    }

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

            if (!triage) {
                throw Object.assign(new Error("No existe el triage"), { status: 404 });
            }

            // idempotente: si ya está pagado, regresamos tal cual
            if (triage.paidStatus === "PAID") return triage;

            await tx.triageRecord.update({
                where: { id: triageId },
                data: { paidStatus: "PAID" },
            });

            await tx.payment.upsert({
                where: { triageId },
                create: {
                    triageId,
                    cashierId: cashier.id,
                    status: "PAID",
                    amount,
                },
                update: {
                    cashierId: cashier.id,
                    status: "PAID",
                    amount,
                    paidAt: new Date(),
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

        // ✅ eventos para refresco en vivo
        emitToRole("CASHIER", "triage:updated", result);
        emitToRole("DOCTOR", "triage:updated", result);

        // (opcional) si ya lo usas en DoctorView, lo dejamos
        emitToRole("DOCTOR", "payment:paid", result);

        res.json(result);
    } catch (e: any) {
        const status = e?.status || 500;
        res.status(status).json({ error: e?.message || "Error al cobrar" });
    }
}
