// api/src/services/reports/adminExcel.service.ts
import ExcelJS from "exceljs";

function fmtMerida(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Merida",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function minutesDiff(a?: Date | null, b?: Date | null) {
    if (!a || !b) return "";
    return Math.round((b.getTime() - a.getTime()) / 60000);
}

export async function buildAdminExcel(rows: any[], startDate: string, endDate: string) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Triage Report");

    ws.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Expediente", key: "expediente", width: 16 },
        { header: "Nombre Completo", key: "name", width: 30 },
        { header: "Motivo de Urgencia", key: "motivo", width: 30 },
        { header: "Clasificación", key: "class", width: 14 },
        { header: "Fecha/Hora Registro (Triage)", key: "triageAt", width: 22 },
        { header: "Fecha/Hora Inicio Consulta", key: "startAt", width: 22 },
        { header: "Tiempo Espera (min)", key: "wait", width: 18 },
        { header: "Enfermero", key: "nurse", width: 22 },
        { header: "Médico", key: "doctor", width: 22 },
        { header: "Diagnóstico", key: "dx", width: 35 },
        { header: "Pago", key: "paid", width: 10 },
    ];

    ws.getRow(1).font = { bold: true };

    for (const r of rows) {
        const triageAt = r.triageAt ?? null;
        const startAt = r.medicalNote?.consultationStartedAt ?? null;

        ws.addRow({
            id: r.id,
            expediente: r.patient?.expediente ?? "",
            name: r.patient?.fullName ?? "",
            motivo: r.motivoUrgencia ?? "",
            class: r.classification ?? "",
            triageAt: fmtMerida(triageAt),
            startAt: fmtMerida(startAt),
            wait: minutesDiff(triageAt, startAt),
            nurse: r.nurse?.name ?? "",
            doctor: r.medicalNote?.doctor?.name ?? "",
            dx: r.medicalNote?.diagnostico ?? "",
            paid: r.paidStatus ?? "",
        });
    }

    // estilos simples
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const filename = `reporte-triage_${startDate}_a_${endDate}.xlsx`;
    return { wb, filename };
}
