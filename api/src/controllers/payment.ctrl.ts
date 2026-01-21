import { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";

export async function markPaid(req: Request, res: Response) {
    const cashier = (req as any).user;
    const triageId = Number(req.params.triageId);
    const { amount } = req.body as { amount?: number };

    const updated = await prisma.$transaction(async (tx) => {
        await tx.triageRecord.update({
            where: { id: triageId },
            data: { paidStatus: "PAID" },
        });

        const payment = await tx.payment.upsert({
            where: { triageId },
            create: { triageId, cashierId: cashier.id, amount: amount ?? null, status: "PAID" },
            update: { cashierId: cashier.id, amount: amount ?? null, status: "PAID", paidAt: new Date() },
            include: { cashier: { select: { name: true } } },
        });

        return payment;
    });

    emitToRole("DOCTOR", "payment:paid", { triageId, payment: updated });
    res.json(updated);
}
