import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { emitToRole } from "../socket";
import ExcelJS from "exceljs";

// umbrales (min)
const SLA: Record<string, number> = { VERDE: 45, AMARILLO: 30, ROJO: 15 };

function fmtMeridaExcel(d?: Date | null) {
    if (!d) return "";
    // sv-SE => "YYYY-MM-DD HH:mm:ss" (perfecto para Excel)
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Merida",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(d);
}


function minutesDiff(a?: Date | null, b?: Date | null) {
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 60000);
}

function parseRange(startDate?: string, endDate?: string) {
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

function buildWhere(query: any) {
    const { startDate, endDate, q, classification } = query as {
        startDate?: string;
        endDate?: string;
        q?: string;
        classification?: "VERDE" | "AMARILLO" | "ROJO";
    };

    const { start, end } = parseRange(startDate, endDate);

    const term = (q ?? "").trim();
    const where: any = {
        triageAt: { gte: start, lte: end },
        medicalNote: { is: { consultationFinishedAt: { not: null } } }, // ATENDIDO
    };

    if (classification) where.classification = classification;

    if (term) {
        where.OR = [
            { patient: { is: { fullName: { contains: term, mode: "insensitive" } } } },
            { patient: { is: { expediente: { contains: term, mode: "insensitive" } } } },
            // por si buscas por ID
            ...(Number.isFinite(Number(term)) ? [{ id: Number(term) }] : []),
        ];
    }

    return where;
}

function computeKpi(rows: any[]) {
    const base = {
        VERDE: { total: 0, ok: 0, pct: 0 },
        AMARILLO: { total: 0, ok: 0, pct: 0 },
        ROJO: { total: 0, ok: 0, pct: 0 },
    };

    for (const r of rows) {
        const c = r.classification;
        if (!base[c]) continue;

        base[c].total++;
        const wait = minutesDiff(r.triageAt, r.medicalNote?.consultationStartedAt);
        if (wait !== null && wait <= SLA[c]) base[c].ok++;
    }

    for (const k of Object.keys(base) as Array<keyof typeof base>) {
        base[k].pct = base[k].total ? Math.round((base[k].ok / base[k].total) * 100) : 0;
    }

    return base;
}

// Convierte vigilancia (JSON/obj/array/string) a lista bonita
function vigilanciaToText(v: any) {
    if (!v) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "string") return v;

    const map: Record<string, string> = {
        vigFiebre38: "Fiebre > 38°C",
        vigConvulsiones: "Convulsiones",
        vigAlteracionAlerta: "Alteración del estado de alerta",
        vigSangradoActivo: "Sangrado activo",
        vigDeshidratacion: "Deshidratación",
        vigVomitosFrecuentes: "Vómitos frecuentes",
        vigIrritabilidad: "Irritabilidad",
        vigLlantoInconsolable: "Llanto inconsolable",
        vigDificultadRespiratoria: "Dificultad respiratoria",
        vigChoque: "Datos de choque",
        vigDeterioroNeurologico: "Deterioro neurológico",
    };

    const out: string[] = [];
    for (const key of Object.keys(map)) if (v?.[key]) out.push(map[key]);
    return out.join(", ");
}

export const adminReportsCtrl = {
    // ✅ Lista atendidos + KPI
    listAttended: async (req: Request, res: Response) => {
        const where = buildWhere(req.query);

        const rows = await prisma.triageRecord.findMany({
            where,
            orderBy: [{ triageAt: "asc" }],
            include: {
                patient: true,
                nurse: { select: { id: true, name: true } },
                payment: { include: { cashier: { select: { id: true, name: true } } } },
                medicalNote: {
                    include: {
                        doctor: { select: { id: true, name: true, cedula: true } },
                    },
                },
            },
            take: 2000,
        });

        const kpi = computeKpi(rows);
        res.json({ rows, kpi });
    },

    // ✅ detalle completo (para modal)
    getDetail: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        const row = await prisma.triageRecord.findUnique({
            where: { id },
            include: {
                patient: true,
                nurse: { select: { id: true, name: true } },
                payment: { include: { cashier: { select: { id: true, name: true } } } },
                medicalNote: { include: { doctor: { select: { id: true, name: true, cedula: true } } } },
            },
        });

        if (!row) return res.status(404).json({ error: "No existe triage" });
        res.json(row);
    },

    // ✅ editar todo desde admin (triage + patient + payment + medicalNote)
    updateDetail: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        const body = req.body ?? {};
        const triage = body.triage ?? {};
        const patient = body.patient ?? {};
        const payment = body.payment ?? {};
        const medicalNote = body.medicalNote ?? {};

        const updated = await prisma.$transaction(async (tx) => {
            const existing = await tx.triageRecord.findUnique({
                where: { id },
                include: { patient: true, medicalNote: true, payment: true },
            });
            if (!existing) throw Object.assign(new Error("No existe triage"), { status: 404 });

            // patient
            if (existing.patientId) {
                await tx.patient.update({
                    where: { id: existing.patientId },
                    data: {
                        expediente: patient.expediente ?? undefined,
                        fullName: patient.fullName ?? undefined,
                        age: patient.age ?? undefined,
                        sex: patient.sex ?? undefined,
                        mayaHabla: patient.mayaHabla ?? undefined,
                        responsibleName: patient.responsibleName ?? undefined,
                    },
                });
            }

            // triageRecord (signos vitales + flags + semáforo)
            await tx.triageRecord.update({
                where: { id },
                data: {
                    motivoUrgencia: triage.motivoUrgencia ?? undefined,
                    appearance: triage.appearance ?? undefined,
                    respiration: triage.respiration ?? undefined,
                    circulation: triage.circulation ?? undefined,
                    classification: triage.classification ?? undefined,

                    weightKg: triage.weightKg ?? undefined,
                    heightCm: triage.heightCm ?? undefined,
                    temperatureC: triage.temperatureC ?? undefined,
                    heartRate: triage.heartRate ?? undefined,
                    respiratoryRate: triage.respiratoryRate ?? undefined,
                    bloodPressure: triage.bloodPressure ?? undefined,

                    hadPriorCareSamePathology: triage.hadPriorCareSamePathology ?? undefined,
                    priorCarePlace: triage.priorCarePlace ?? undefined,
                    hasReferral: triage.hasReferral ?? undefined,
                    referralPlace: triage.referralPlace ?? undefined,
                },
            });

            // medicalNote
            if (existing.medicalNote) {
                await tx.medicalNote.update({
                    where: { triageId: id },
                    data: {
                        padecimientoActual: medicalNote.padecimientoActual ?? undefined,
                        antecedentes: medicalNote.antecedentes ?? undefined,
                        exploracionFisica: medicalNote.exploracionFisica ?? undefined,
                        estudiosParaclinicos: medicalNote.estudiosParaclinicos ?? undefined,
                        diagnostico: medicalNote.diagnostico ?? undefined,
                        planTratamiento: medicalNote.planTratamiento ?? undefined,
                        vigilancia: medicalNote.vigilancia ?? undefined,
                        contraRefFollowUp: medicalNote.contraRefFollowUp ?? undefined,
                        contraRefWhen: medicalNote.contraRefWhen ?? undefined,
                        pronostico: medicalNote.pronostico ?? undefined,
                        consultationStartedAt: medicalNote.consultationStartedAt ?? undefined,
                        consultationFinishedAt: medicalNote.consultationFinishedAt ?? undefined,
                    },
                });
            }

            // payment
            if (payment && Object.keys(payment).length) {
                await tx.payment.upsert({
                    where: { triageId: id },
                    create: {
                        triageId: id,
                        cashierId: payment.cashierId ?? existing.payment?.cashierId ?? undefined,
                        status: payment.status ?? existing.payment?.status ?? "PAID",
                        amount: payment.amount ?? null,
                        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
                    },
                    update: {
                        cashierId: payment.cashierId ?? undefined,
                        status: payment.status ?? undefined,
                        amount: payment.amount ?? undefined,
                        paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined,
                    },
                });
            }

            return tx.triageRecord.findUnique({
                where: { id },
                include: {
                    patient: true,
                    nurse: { select: { id: true, name: true } },
                    payment: { include: { cashier: { select: { id: true, name: true } } } },
                    medicalNote: { include: { doctor: { select: { id: true, name: true, cedula: true } } } },
                },
            });
        });

        // refrescar pantallas si están abiertas
        emitToRole("ADMIN", "admin:updated", { id });
        emitToRole("NURSE_TRIAGE", "triage:updated", updated);
        emitToRole("CASHIER", "triage:updated", updated);
        emitToRole("DOCTOR", "triage:updated", updated);

        res.json(updated);
    },

    // ✅ Excel (respeta filtros)
    exportExcel: async (req: Request, res: Response) => {
        const where = buildWhere(req.query);
        const rows = await prisma.triageRecord.findMany({
            where,
            orderBy: [{ triageAt: "asc" }],
            include: {
                patient: true,
                nurse: { select: { name: true } },
                payment: { include: { cashier: { select: { name: true } } } },
                medicalNote: { include: { doctor: { select: { name: true, cedula: true } } } },
            },
            take: 5000,
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Reporte");

        ws.columns = [
            { header: "ID", key: "id", width: 8 },

            { header: "Expediente", key: "expediente", width: 14 },
            { header: "Paciente", key: "paciente", width: 28 },
            { header: "Edad", key: "edad", width: 6 },
            { header: "Sexo", key: "sexo", width: 6 },
            { header: "Responsable", key: "responsable", width: 24 },
            { header: "Habla Maya", key: "maya", width: 10 },

            { header: "Peso (kg)", key: "peso", width: 10 },
            { header: "Talla (cm)", key: "talla", width: 10 },
            { header: "Temp (°C)", key: "temp", width: 10 },
            { header: "FC", key: "fc", width: 8 },
            { header: "FR", key: "fr", width: 8 },
            { header: "T.A. (mmHg)", key: "ta", width: 12 },

            { header: "Apariencia", key: "appearance", width: 12 },
            { header: "Respiración", key: "respiration", width: 12 },
            { header: "Circulación", key: "circulation", width: 12 },
            { header: "Clasificación", key: "classification", width: 12 },

            { header: "Atención previa", key: "prev", width: 12 },
            { header: "Lugar atención previa", key: "prevPlace", width: 20 },

            { header: "Con referencia", key: "ref", width: 12 },
            { header: "Lugar referencia", key: "refPlace", width: 20 },

            { header: "Enfermero", key: "nurse", width: 22 },
            { header: "Registro Triage", key: "triageAt", width: 20 },

            { header: "Cajero", key: "cashier", width: 22 },
            { header: "Monto", key: "amount", width: 10 },
            { header: "Estatus pago", key: "payStatus", width: 12 },
            { header: "Fecha pago", key: "paidAt", width: 20 },

            { header: "Padecimiento actual", key: "pa", width: 30 },
            { header: "Antecedentes", key: "ant", width: 30 },
            { header: "Exploración física", key: "ef", width: 30 },
            { header: "Estudios paraclínicos", key: "ep", width: 30 },
            { header: "Diagnóstico(s)", key: "dx", width: 30 },
            { header: "Plan/Tratamiento", key: "plan", width: 30 },

            { header: "Datos de alarma", key: "vig", width: 40 },

            { header: "Contrarreferencia", key: "cr", width: 14 },
            { header: "En cuánto tiempo", key: "crWhen", width: 16 },

            { header: "Pronóstico", key: "pro", width: 20 },

            { header: "Médico", key: "doc", width: 22 },
            { header: "Cédula", key: "ced", width: 14 },
            { header: "Inicio consulta", key: "start", width: 20 },
            { header: "Fin consulta", key: "finish", width: 20 },

            { header: "Espera (min)", key: "wait", width: 12 },
            { header: "Cumple SLA", key: "slaOk", width: 10 },
        ];

        ws.getRow(1).font = { bold: true };

        for (const r of rows) {
            const p = r.patient ?? {};
            const n = r.medicalNote ?? {};
            const pay = r.payment ?? null;

            const startAt = n.consultationStartedAt ?? null;
            const wait = minutesDiff(r.triageAt, startAt);
            const thr = SLA[r.classification] ?? null;
            const ok = wait !== null && thr !== null ? (wait <= thr ? "SI" : "NO") : "";

            ws.addRow({
                id: r.id,

                expediente: p.expediente ?? "",
                paciente: p.fullName ?? "",
                edad: p.age ?? "",
                sexo: p.sex ?? "",
                responsable: p.responsibleName ?? "",
                maya: p.mayaHabla ? "SI" : "NO",

                peso: r.weightKg ?? "",
                talla: r.heightCm ?? "",
                temp: r.temperatureC ?? "",
                fc: r.heartRate ?? "",
                fr: r.respiratoryRate ?? "",
                ta: r.bloodPressure ?? "",

                appearance: r.appearance,
                respiration: r.respiration,
                circulation: r.circulation,
                classification: r.classification,

                prev: r.hadPriorCareSamePathology ? "SI" : "NO",
                prevPlace: r.priorCarePlace ?? "",
                ref: r.hasReferral ? "SI" : "NO",
                refPlace: r.referralPlace ?? "",

                nurse: r.nurse?.name ?? "",
                triageAt: fmtMeridaExcel(r.triageAt),

                cashier: pay?.cashier?.name ?? "",
                amount: pay?.amount ?? "",
                payStatus: r.paidStatus ?? "",
                paidAt: fmtMeridaExcel(pay?.paidAt ?? null),

                pa: n.padecimientoActual ?? "",
                ant: n.antecedentes ?? "",
                ef: n.exploracionFisica ?? "",
                ep: n.estudiosParaclinicos ?? "",
                dx: n.diagnostico ?? "",
                plan: n.planTratamiento ?? "",

                vig: vigilanciaToText(n.vigilancia),

                cr: n.contraRefFollowUp ? "SI" : "NO",
                crWhen: n.contraRefFollowUp ? (n.contraRefWhen ?? "") : "",

                pro: n.pronostico ?? "",

                doc: n.doctor?.name ?? "",
                ced: n.doctor?.cedula ?? "",
                start: fmtMeridaExcel(n.consultationStartedAt ?? null),
                finish: fmtMeridaExcel(n.consultationFinishedAt ?? null),

                wait: wait ?? "",
                slaOk: ok,
            });
        }

        // // formatos fecha/hora
        // for (const key of ["triageAt", "paidAt", "start", "finish"] as const) {
        //     ws.getColumn(key).numFmt = "yyyy-mm-dd hh:mm";
        // }

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="reporte_admin.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    },
};
