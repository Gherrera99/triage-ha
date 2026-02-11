//api/src/controllers/triage.ctrl.ts
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";
import { Sex, TriageColor } from "@prisma/client";

function toSex(v: any): Sex | null {
    const s = String(v ?? "").toUpperCase();
    if (s === "M") return Sex.M;
    if (s === "F") return Sex.F;
    if (s === "X" || s === "O") return Sex.O;
    return null;
}

function toColor(v: any): TriageColor {
    const s = String(v ?? "").toUpperCase();
    // acepta inglés y español (por compatibilidad)
    if (s === "GREEN" || s === "VERDE") return TriageColor.VERDE;
    if (s === "YELLOW" || s === "AMARILLO") return TriageColor.AMARILLO;
    if (s === "RED" || s === "ROJO") return TriageColor.ROJO;
    // default seguro
    return TriageColor.VERDE;
}

function worstColor(a: TriageColor, b: TriageColor, c: TriageColor): TriageColor {
    const rank: Record<TriageColor, number> = {
        VERDE: 1,
        AMARILLO: 2,
        ROJO: 3,
    };
    return [a, b, c].sort((x, y) => rank[x] - rank[y])[2];
}

function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

export async function createTriage(req: Request, res: Response) {
    try {
        const nurse = (req as any).user;
        if (!nurse?.id) return res.status(401).json({ error: "No autenticado" });

        // Soporta payload plano (tu front actual) y payload anidado (future-proof)
        const b = (req.body?.triage ?? req.body ?? {}) as any;
        const p = (b.patient ?? b.paciente ?? {}) as any;

        const motivoUrgencia = String(b.motivoUrgencia ?? "").trim();
        const patientFullName = String(b.patientFullName ?? p.fullName ?? p.patientFullName ?? "").trim();

        if (!motivoUrgencia || !patientFullName) {
            return res.status(400).json({ error: "Motivo de urgencia y Nombre completo son requeridos" });
        }

        const expedienteRaw = (b.expediente ?? b.expedienteNo ?? p.expediente ?? null);
        const expediente = (typeof expedienteRaw === "string" && expedienteRaw.trim()) ? expedienteRaw.trim() : null;

        // Colores (acepta GREEN/YELLOW/RED o VERDE/AMARILLO/ROJO)
        const appearance = toColor(b.appearance ?? p.appearance);
        const respiration = toColor(b.respiration ?? p.respiration);
        const circulation = toColor(b.circulation ?? p.circulation);
        const classification = worstColor(appearance, respiration, circulation); // ✅ cálculo server

        // Patient
        const responsibleName = (b.responsibleName ?? p.responsibleName ?? null);
        const mayaHabla = !!(b.speaksMaya ?? p.mayaHabla ?? p.speaksMaya ?? false);

        const patientCreate = {
            expediente: expediente ?? undefined,
            fullName: patientFullName,
            birthDate: (b.birthDate ?? p.birthDate) ? new Date(b.birthDate ?? p.birthDate) : null,
            age: (b.patientAge ?? p.age) ?? null,
            sex: toSex(b.sex ?? p.sex),
            mayaHabla,
            responsibleName: (typeof responsibleName === "string" && responsibleName.trim()) ? responsibleName.trim() : null,
        };

        // Relación Patient: si hay expediente, reusa el paciente; si no, crea nuevo
        const patientRelation = expediente
            ? {
                connectOrCreate: {
                    where: { expediente },
                    create: patientCreate,
                },
            }
            : {
                create: {
                    ...patientCreate,
                    expediente: undefined, // evita meter undefined raro
                },
            };

        // Flags + lugares (compatibilidad con nombres alternativos)
        const hadPriorCareSamePathology = !!(b.hadPriorCareSamePathology ?? b.atencionPreviaMismaPatologia ?? false);
        const priorCarePlaceRaw = (b.priorCarePlace ?? b.lugarAtencionPrev ?? null);
        const priorCarePlace =
            hadPriorCareSamePathology && typeof priorCarePlaceRaw === "string" && priorCarePlaceRaw.trim()
                ? priorCarePlaceRaw.trim()
                : null;

        const hasReferral = !!(b.hasReferral ?? b.pacienteConReferencia ?? false);
        const referralPlaceRaw = (b.referralPlace ?? b.lugarReferencia ?? null);
        const referralPlace =
            hasReferral && typeof referralPlaceRaw === "string" && referralPlaceRaw.trim()
                ? referralPlaceRaw.trim()
                : null;

        // Signos vitales
        const created = await prisma.triageRecord.create({
            data: {
                motivoUrgencia,
                appearance,
                respiration,
                circulation,
                classification,

                // ✅ signos vitales
                weightKg: b.weightKg ?? null,
                heightCm: b.heightCm ?? null,
                temperatureC: b.temperatureC ?? null,
                heartRate: b.heartRate ?? null,
                respiratoryRate: b.respiratoryRate ?? null,
                bloodPressure: (b.bloodPressure && String(b.bloodPressure).trim()) ? String(b.bloodPressure).trim() : null,

                // ✅ flags + lugares
                hadPriorCareSamePathology,
                priorCarePlace,
                hasReferral,
                referralPlace,

                // ✅ relación enfermero (no nurseId directo)
                nurse: { connect: { id: nurse.id } },

                // ✅ relación paciente
                patient: patientRelation,
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
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: "Error creando triage", detail: String(e?.message ?? e) });
    }
}

export async function listQueueForCashier(req: Request, res: Response) {
    const { start, end } = todayRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            paidStatus: "PENDING",
            triageAt: { gte: start, lte: end },
        },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: { patient: true, nurse: { select: { name: true } } },
        take: 200,
    });
    res.json(rows);
}

export async function listQueueForDoctor(req: Request, res: Response) {
    const { start, end } = todayRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            paidStatus: "PAID",
            triageAt: { gte: start, lte: end }, // ✅ solo hoy
        },
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

// Lista últimos triages (para Enfermería)
export async function listRecentForNurse(req: Request, res: Response) {
    const nurse = (req as any).user;

    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);

    const rows = await prisma.triageRecord.findMany({
        where: {
            nurseId: nurse.id,
            triageAt: { gte: start, lte: end },
        },
        // ✅ prioridad (ROJO > AMARILLO > VERDE) y por llegada (más antiguo primero)
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        take: 200,
        include: {
            patient: true,
            payment: true,
            medicalNote: true,
        },
    });

    res.json(rows);
}

// Revaloración: actualiza semáforo + signos vitales + flags/lugares y recalcula clasificación
export async function revalueTriage(req: Request, res: Response) {
    const nurse = (req as any).user;
    const id = Number(req.params.id);

    const b = (req.body ?? {}) as any;

    const existing = await prisma.triageRecord.findFirst({
        where: { id, nurseId: nurse.id },
        include: { patient: true, medicalNote: true },
    });

    if (!existing) return res.status(404).json({ error: "Triage no encontrado" });
    if (existing.medicalNote?.consultationStartedAt) {
        return res.status(409).json({ error: "No se puede revalorar: consulta ya iniciada por el médico" });
    }

    const appearance = b.appearance ? toColor(b.appearance) : existing.appearance;
    const respiration = b.respiration ? toColor(b.respiration) : existing.respiration;
    const circulation = b.circulation ? toColor(b.circulation) : existing.circulation;
    const classification = worstColor(appearance, respiration, circulation);

    const hadPriorCareSamePathology = b.hadPriorCareSamePathology ?? existing.hadPriorCareSamePathology;
    const priorCarePlace =
        hadPriorCareSamePathology && typeof b.priorCarePlace === "string" && b.priorCarePlace.trim()
            ? b.priorCarePlace.trim()
            : (hadPriorCareSamePathology ? existing.priorCarePlace : null);

    const hasReferral = b.hasReferral ?? existing.hasReferral;
    const referralPlace =
        hasReferral && typeof b.referralPlace === "string" && b.referralPlace.trim()
            ? b.referralPlace.trim()
            : (hasReferral ? existing.referralPlace : null);

    const updated = await prisma.triageRecord.update({
        where: { id },
        data: {
            // semáforo
            appearance,
            respiration,
            circulation,
            classification,

            // signos vitales
            weightKg: b.weightKg ?? existing.weightKg,
            heightCm: b.heightCm ?? existing.heightCm,
            temperatureC: b.temperatureC ?? existing.temperatureC,
            heartRate: b.heartRate ?? existing.heartRate,
            respiratoryRate: b.respiratoryRate ?? existing.respiratoryRate,
            bloodPressure: (b.bloodPressure !== undefined)
                ? (String(b.bloodPressure || "").trim() || null)
                : existing.bloodPressure,

            // flags + lugares
            hadPriorCareSamePathology,
            priorCarePlace,
            hasReferral,
            referralPlace,
        },
        include: { patient: true, nurse: { select: { id: true, name: true } } },
    });

    // Notificar a Caja y Médicos que hubo revaloración
    emitToRole("CASHIER", "triage:updated", updated);
    emitToRole("DOCTOR", "triage:updated", updated);

    res.json(updated);
}

export async function listWaitingForDoctor(req: Request, res: Response) {
    const { start, end } = todayRange();
    const rows = await prisma.triageRecord.findMany({
        where: {
            paidStatus: "PAID",
            triageAt: { gte: start, lt: end },
            medicalNote: null, // nadie la tomó aún
        },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: { patient: true, nurse: { select: { name: true } } },
        take: 300,
    });
    res.json(rows);
}

export async function listMyConsultations(req: Request, res: Response) {
    const doctor = (req as any).user;
    const { start, end } = todayRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            paidStatus: "PAID",
            triageAt: { gte: start, lt: end },
            medicalNote: {
                is: {
                    doctorId: doctor.id,
                    consultationFinishedAt: null,
                    consultationStartedAt: { not: null },
                },
            },
        },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: { patient: true, nurse: { select: { name: true } }, medicalNote: true },
        take: 300,
    });

    res.json(rows);
}

export async function listMyAttended(req: Request, res: Response) {
    const doctor = (req as any).user;
    const { start, end } = todayRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            paidStatus: "PAID",
            triageAt: { gte: start, lt: end },
            medicalNote: {
                is: {
                    doctorId: doctor.id,
                    consultationFinishedAt: { not: null },
                },
            },
        },
        orderBy: [{ triageAt: "desc" }],
        include: { patient: true, nurse: { select: { name: true } }, medicalNote: true },
        take: 300,
    });

    res.json(rows);
}

export async function getDoctorTriageDetail(req: Request, res: Response) {
    const triageId = Number(req.params.triageId);

    const triage = await prisma.triageRecord.findUnique({
        where: { id: triageId },
        include: {
            patient: true,
            nurse: { select: { id: true, name: true } },
            payment: { include: { cashier: { select: { id: true, name: true } } } },
            medicalNote: { include: { doctor: { select: { id: true, name: true, cedula: true } } } },
        },
    });

    if (!triage) return res.status(404).json({ error: "No existe triage" });
    res.json(triage);
}
