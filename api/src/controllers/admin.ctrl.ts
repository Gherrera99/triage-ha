import { Request, Response } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../prisma";

export async function getAdminReport(req: Request, res: Response) {
    const { startDate, endDate } = req.query as { startDate: string; endDate: string };
    if (!startDate || !endDate) return res.status(400).json({ message: "startDate y endDate requeridos" });

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const rows = await prisma.triageRecord.findMany({
        where: { triageAt: { gte: start, lte: end } },
        include: {
            patient: true,
            nurse: { select: { name: true } },
            medicalNote: { include: { doctor: { select: { name: true } } } },
        },
        orderBy: { triageAt: "asc" },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Triage");

    ws.columns = [
        { header: "ID Paciente", key: "patientId", width: 12 },
        { header: "Nombre Completo", key: "fullName", width: 28 },
        { header: "Motivo de Consulta", key: "motivo", width: 28 },
        { header: "Clasificación", key: "clasif", width: 14 },
        { header: "Fecha/Hora Registro (Triage)", key: "triageAt", width: 22 },
        { header: "Fecha/Hora Atención (Inicio Consulta)", key: "consultAt", width: 26 },
        { header: "Tiempo de Espera (min)", key: "waitMin", width: 18 },
        { header: "Nombre del Enfermero", key: "nurse", width: 22 },
        { header: "Nombre del Médico", key: "doctor", width: 22 },
        { header: "Diagnóstico Principal", key: "dx", width: 28 },
    ];

    rows.forEach((r) => {
        const triageAt = r.triageAt;
        const consultAt = r.medicalNote?.consultationStartedAt ?? null;
        const waitMin =
            consultAt ? Math.round((consultAt.getTime() - triageAt.getTime()) / 60000) : null;

        ws.addRow({
            patientId: r.patientId,
            fullName: r.patient.fullName,
            motivo: r.motivoUrgencia,
            clasif: r.classification,
            triageAt: triageAt.toISOString(),
            consultAt: consultAt ? consultAt.toISOString() : "",
            waitMin: waitMin ?? "",
            nurse: r.nurse?.name ?? "",
            doctor: r.medicalNote?.doctor?.name ?? "",
            dx: r.medicalNote?.diagnosisPrincipal ?? "",
        });
    });

    ws.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="reporte_triage_${startDate}_a_${endDate}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
}
