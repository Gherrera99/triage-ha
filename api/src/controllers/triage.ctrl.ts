import { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";
import { Sex, TriageColor } from "@prisma/client";
import { buildNurseShiftReportPdf } from "../services/pdf/nurseShiftReportPdf";

function toSex(v: any): Sex | null {
    const s = String(v ?? "").toUpperCase();
    if (s === "M") return Sex.M;
    if (s === "F") return Sex.F;
    if (s === "X" || s === "O") return Sex.O;
    return null;
}

function toColor(v: any): TriageColor {
    const s = String(v ?? "").toUpperCase();
    if (s === "GREEN" || s === "VERDE") return TriageColor.VERDE;
    if (s === "YELLOW" || s === "AMARILLO") return TriageColor.AMARILLO;
    if (s === "RED" || s === "ROJO") return TriageColor.ROJO;
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

function normalizeExpediente(v: any): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const up = s.toUpperCase();

    if (up === "SIN EXPEDIENTE" || up === "SIN EXPENDIENTE") return null;

    return s;
}

function isConsulta(motivo: any): boolean {
    const s = String(motivo ?? "").trim().toUpperCase();
    return s === "CONSULTA";
}

function last24HoursRange() {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { start, end };
}

function calculateFullAgeFromBirthDate(input?: Date | null): string | null {
    if (!input) return null;

    const birth = new Date(input);
    if (Number.isNaN(birth.getTime())) return null;

    const now = new Date();

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();

    if (now.getDate() < birth.getDate()) {
        months -= 1;
    }

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    if (years < 0) return null;

    const yLabel = years === 1 ? "año" : "años";
    const mLabel = months === 1 ? "mes" : "meses";

    return `${years} ${yLabel} y ${months} ${mLabel}`;
}

export async function createTriage(req: Request, res: Response) {
    try {
        const nurse = (req as any).user;
        if (!nurse?.id) return res.status(401).json({ error: "No autenticado" });

        const b = (req.body?.triage ?? req.body ?? {}) as any;
        const p = (b.patient ?? b.paciente ?? {}) as any;

        const motivoUrgencia = String(b.motivoUrgencia ?? "").trim().toUpperCase();
        const patientFullName = String(b.patientFullName ?? p.fullName ?? p.patientFullName ?? "").trim();

        if (!motivoUrgencia || !patientFullName) {
            return res.status(400).json({ error: "Motivo de urgencia y Nombre completo son requeridos" });
        }

        const consulta = isConsulta(motivoUrgencia);

        const expediente = normalizeExpediente(b.expediente ?? b.expedienteNo ?? p.expediente ?? null);

        const appearance = consulta ? toColor(b.appearance ?? p.appearance) : TriageColor.VERDE;
        const respiration = consulta ? toColor(b.respiration ?? p.respiration) : TriageColor.VERDE;
        const circulation = consulta ? toColor(b.circulation ?? p.circulation) : TriageColor.VERDE;
        const classification = consulta ? worstColor(appearance, respiration, circulation) : TriageColor.VERDE;

        const responsibleName = b.responsibleName ?? p.responsibleName ?? null;
        const mayaHabla = !!(b.speaksMaya ?? p.mayaHabla ?? p.speaksMaya ?? false);

        const birthDateRaw = b.birthDate ?? p.birthDate ?? null;
        const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
        const age =
            calculateFullAgeFromBirthDate(birthDate) ??
            (typeof (b.patientAge ?? p.age) === "string"
                ? String(b.patientAge ?? p.age).trim()
                : null);

        const patientCreate = {
            expediente: expediente ?? undefined,
            fullName: patientFullName,
            birthDate,
            age,
            sex: toSex(b.sex ?? p.sex),
            mayaHabla,
            responsibleName: (typeof responsibleName === "string" && responsibleName.trim()) ? responsibleName.trim() : null,
        };

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
                    expediente: undefined,
                },
            };

        const hadPriorCareSamePathology = consulta
            ? !!(b.hadPriorCareSamePathology ?? b.atencionPreviaMismaPatologia ?? false)
            : false;

        const priorCarePlaceRaw = b.priorCarePlace ?? b.lugarAtencionPrev ?? null;
        const priorCarePlace =
            consulta && hadPriorCareSamePathology && typeof priorCarePlaceRaw === "string" && priorCarePlaceRaw.trim()
                ? priorCarePlaceRaw.trim()
                : null;

        const hasReferral = consulta
            ? !!(b.hasReferral ?? b.pacienteConReferencia ?? false)
            : false;

        const referralPlaceRaw = b.referralPlace ?? b.lugarReferencia ?? null;
        const referralPlace =
            consulta && hasReferral && typeof referralPlaceRaw === "string" && referralPlaceRaw.trim()
                ? referralPlaceRaw.trim()
                : null;

        const created = await prisma.triageRecord.create({
            data: {
                motivoUrgencia,
                observaciones: typeof b.observaciones === "string" && b.observaciones.trim() ? b.observaciones.trim() : null,

                appearance,
                respiration,
                circulation,
                classification,

                weightKg: consulta ? (b.weightKg ?? null) : null,
                heightCm: consulta ? (b.heightCm ?? null) : null,
                temperatureC: consulta ? (b.temperatureC ?? null) : null,
                heartRate: consulta ? (b.heartRate ?? null) : null,
                respiratoryRate: consulta ? (b.respiratoryRate ?? null) : null,
                bloodPressure: consulta && b.bloodPressure && String(b.bloodPressure).trim()
                    ? String(b.bloodPressure).trim()
                    : null,

                hadPriorCareSamePathology,
                priorCarePlace,
                hasReferral,
                referralPlace,

                nurse: { connect: { id: nurse.id } },
                patient: patientRelation,
            },
            include: {
                patient: true,
                nurse: { select: { id: true, name: true } },
            },
        });

        emitToRole("CASHIER", "triage:new", created);

        if (consulta) {
            emitToRole("DOCTOR", "triage:new", created);
        }

        res.status(201).json(created);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: "Error creando triage", detail: String(e?.message ?? e) });
    }
}

export async function listQueueForCashier(req: Request, res: Response) {
    const { start, end } = last24HoursRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            triageAt: { gte: start, lte: end },
            paidStatus: "PENDING",
            closedAt: null,
            refusedPayment: false,
            noShow: false,
        },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: { patient: true, nurse: { select: { name: true } } },
        take: 200,
    });

    res.json(rows);
}

export async function listQueueForDoctor(req: Request, res: Response) {
    const { start, end } = last24HoursRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            triageAt: { gte: start, lte: end },
            motivoUrgencia: "CONSULTA",
            paidStatus: "PAID",
            closedAt: null,
            refusedPayment: false,
            noShow: false,
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

export async function listRecentForNurse(req: Request, res: Response) {
    const nurse = (req as any).user;
    const { start, end } = last24HoursRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            nurseId: nurse.id,
            triageAt: { gte: start, lte: end },
        },
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

export async function revalueTriage(req: Request, res: Response) {
    const nurse = (req as any).user;
    const id = Number(req.params.id);
    const b = (req.body ?? {}) as any;

    const existing = await prisma.triageRecord.findFirst({
        where: { id, nurseId: nurse.id },
        include: { patient: true, medicalNote: true },
    });

    if (!existing) return res.status(404).json({ error: "Triage no encontrado" });
    if (!isConsulta(existing.motivoUrgencia)) {
        return res.status(409).json({ error: "Solo se puede revalorar un paciente de consulta" });
    }
    if (existing.closedAt || existing.refusedPayment || existing.noShow) {
        return res.status(409).json({ error: "No se puede revalorar: el flujo ya fue cerrado" });
    }
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
            nurseId: nurse.id,

            appearance,
            respiration,
            circulation,
            classification,

            weightKg: b.weightKg ?? existing.weightKg,
            heightCm: b.heightCm ?? existing.heightCm,
            temperatureC: b.temperatureC ?? existing.temperatureC,
            heartRate: b.heartRate ?? existing.heartRate,
            respiratoryRate: b.respiratoryRate ?? existing.respiratoryRate,
            bloodPressure: (b.bloodPressure !== undefined)
                ? (String(b.bloodPressure || "").trim() || null)
                : existing.bloodPressure,

            hadPriorCareSamePathology,
            priorCarePlace,
            hasReferral,
            referralPlace,
        },
        include: { patient: true, nurse: { select: { id: true, name: true } } },
    });

    emitToRole("CASHIER", "triage:updated", updated);
    emitToRole("DOCTOR", "triage:updated", updated);

    res.json(updated);
}

export async function listWaitingForDoctor(req: Request, res: Response) {
    const { start, end } = last24HoursRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            triageAt: { gte: start, lte: end },
            motivoUrgencia: "CONSULTA",
            paidStatus: "PAID",
            closedAt: null,
            refusedPayment: false,
            noShow: false,
            medicalNote: null,
        },
        orderBy: [{ classification: "desc" }, { triageAt: "asc" }],
        include: { patient: true, nurse: { select: { name: true } } },
        take: 300,
    });

    res.json(rows);
}

export async function listMyConsultations(req: Request, res: Response) {
    const doctor = (req as any).user;
    const { start, end } = last24HoursRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            triageAt: { gte: start, lte: end },
            motivoUrgencia: "CONSULTA",
            paidStatus: "PAID",
            closedAt: null,
            refusedPayment: false,
            noShow: false,
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
    const { start, end } = last24HoursRange();

    const rows = await prisma.triageRecord.findMany({
        where: {
            triageAt: { gte: start, lte: end },
            motivoUrgencia: "CONSULTA",
            paidStatus: "PAID",
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

export async function nurseOwnReport(req: Request, res: Response) {
    const nurse = (req as any).user;

    // ✅ Solo pacientes del día actual (no 24h), usando timezone America/Merida
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Merida",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now); // "YYYY-MM-DD"

    // Convertir inicio y fin del día en Mérida a UTC
    const startOfDay = new Date(`${todayStr}T00:00:00-06:00`); // CST (UTC-6)
    const endOfDay = new Date(`${todayStr}T23:59:59.999-06:00`);

    const rows = await prisma.triageRecord.findMany({
        where: {
            nurseId: nurse.id,
            triageAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: [{ triageAt: "asc" }],
        include: {
            patient: true,
        },
        take: 1000,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        `inline; filename="reporte_enfermeria_${nurse.id}.pdf"`
    );

    buildNurseShiftReportPdf(
        {
            nurseName: nurse.name,
            rows,
            generatedAt: new Date(),
        },
        res
    );
}