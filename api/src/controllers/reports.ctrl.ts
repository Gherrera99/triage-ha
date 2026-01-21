import type { Request, Response } from "express";
import { prisma } from "../prisma";
import ExcelJS from "exceljs";

function minutesDiff(a?: Date | null, b?: Date | null) {
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 60000);
}

export const reportsCtrl = {
    getAdminReport: async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
        if (!startDate || !endDate) return res.status(400).json({ message: "startDate y endDate son requeridos" });

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const rows = await prisma.triageRecord.findMany({
            where: {
                triageTimestamp: { gte: start, lte: end },
            },
            include: {
                nurse: { select: { fullName: true } },
                medicalNote: {
                    include: { doctor: { select: { fullName: true } } },
                },
            },
            orderBy: { triageTimestamp: "asc" },
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Triage Report");

        ws.columns = [
            { header: "ID Paciente", key: "id", width: 12 },
            { header: "Nombre Completo", key: "name", width: 30 },
            { header: "Motivo de Consulta", key: "motivo", width: 30 },
            { header: "Clasificación", key: "class", width: 14 },
            { header: "Fecha/Hora Registro (Triage)", key: "triageAt", width: 22 },
            { header: "Fecha/Hora Atención (Inicio Consulta)", key: "startAt", width: 30 },
            { header: "Tiempo de Espera (min)", key: "wait", width: 18 },
            { header: "Nombre del Enfermero", key: "nurse", width: 25 },
            { header: "Nombre del Médico", key: "doctor", width: 25 },
            { header: "Diagnóstico Principal", key: "dx", width: 35 },
        ];

        ws.getRow(1).font = { bold: true };

        for (const r of rows) {
            const startAt = r.medicalNote?.consultationStartAt ?? null;
            ws.addRow({
                id: r.id,
                name: r.patientFullName,
                motivo: r.motivoUrgencia,
                class: r.classification,
                triageAt: r.triageTimestamp,
                startAt: startAt,
                wait: minutesDiff(r.triageTimestamp, startAt),
                nurse: r.nurse.fullName,
                doctor: r.medicalNote?.doctor.fullName ?? "",
                dx: r.medicalNote?.diagnostico ?? "",
            });
        }

        ws.getColumn("triageAt").numFmt = "yyyy-mm-dd hh:mm";
        ws.getColumn("startAt").numFmt = "yyyy-mm-dd hh:mm";

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="reporte-triage_${startDate}_a_${endDate}.xlsx"`);

        await wb.xlsx.write(res);
        res.end();
    },
};
