import { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";

export async function createTriage(req: Request, res: Response) {
    const nurse = (req as any).user;

    const {
        patient,
        motivoUrgencia,
        appearance,
        respiration,
        circulation,
        classification,
    } = req.body;

    const created = await prisma.triageRecord.create({
        data: {
            motivoUrgencia,
            appearance,
            respiration,
            circulation,
            classification,
            nurseId: nurse.id,
            patient: {
                create: {
                    expediente: patient.expediente ?? null,
                    fullName: patient.fullName,
                    birthDate: patient.birthDate ? new Date(patient.birthDate) : null,
                    age: patient.age ?? null,
                    sex: patient.sex ?? null,
                    mayaHabla: !!patient.mayaHabla,
                },
            },
        },
        include: {
            patient: true,
            nurse: { select: { id: true, name: true } },
        },
    });

    // Notifica a Caja y Médicos
    emitToRole("CASHIER", "triage:new", created);
    emitToRole("DOCTOR", "triage:new", created);

    res.status(201).json(created);
}

export async function listQueueForCashier(req: Request, res: Response) {
    const rows = await prisma.triageRecord.findMany({
        where: { paidStatus: "PENDING" },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: { patient: true, nurse: { select: { name: true } } },
        take: 200,
    });
    res.json(rows);
}

export async function listQueueForDoctor(req: Request, res: Response) {
    const rows = await prisma.triageRecord.findMany({
        where: { paidStatus: "PAID" },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: {
            patient: true,
            nurse: { select: { name: true } },
            medicalNote: { include: { doctor: { select: { name: true } } } },
        },
        take: 200,
    });
    res.json(rows);
}
