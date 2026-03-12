import PDFDocument from "pdfkit";
import type { Writable } from "stream";

const TZ = "America/Merida";

function fmtDateTime(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function fmtDate(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

export function buildNurseShiftReportPdf(params: {
    nurseName: string;
    rows: any[];
    generatedAt?: Date;
}, out: Writable) {
    const { nurseName, rows, generatedAt = new Date() } = params;

    const doc = new PDFDocument({
        size: "LETTER",
        margin: 36,
    });

    doc.pipe(out);

    doc.font("Helvetica-Bold").fontSize(14).text("REPORTE DE PACIENTES ATENDIDOS - TRIAGE", {
        align: "center",
    });

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Enfermero(a): ${nurseName}`);
    doc.text(`Fecha de emisión: ${fmtDateTime(generatedAt)}`);
    doc.text(`Total de pacientes: ${rows.length}`);

    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(
        "Descripción: Reporte de pacientes atendidos/capturados por el personal de enfermería en el área de triage.",
        { align: "left" }
    );

    doc.moveDown(1);

    const startX = 36;
    let y = doc.y;
    const widths = {
        id: 35,
        fecha: 95,
        expediente: 85,
        paciente: 150,
        motivo: 100,
        clasif: 55,
    };

    function cell(text: string, x: number, yy: number, w: number, h: number, bold = false) {
        doc.rect(x, yy, w, h).stroke();
        doc.font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8)
            .text(text || "", x + 3, yy + 4, {
                width: w - 6,
                height: h - 6,
                ellipsis: true,
            });
    }

    const headerH = 22;
    let x = startX;
    cell("ID", x, y, widths.id, headerH, true); x += widths.id;
    cell("Fecha/Hora", x, y, widths.fecha, headerH, true); x += widths.fecha;
    cell("Expediente", x, y, widths.expediente, headerH, true); x += widths.expediente;
    cell("Paciente", x, y, widths.paciente, headerH, true); x += widths.paciente;
    cell("Motivo", x, y, widths.motivo, headerH, true); x += widths.motivo;
    cell("Clasif.", x, y, widths.clasif, headerH, true);

    y += headerH;

    for (const r of rows) {
        const rowH = 28;

        if (y + rowH > doc.page.height - 120) {
            doc.addPage();
            y = 36;
            x = startX;
            cell("ID", x, y, widths.id, headerH, true); x += widths.id;
            cell("Fecha/Hora", x, y, widths.fecha, headerH, true); x += widths.fecha;
            cell("Expediente", x, y, widths.expediente, headerH, true); x += widths.expediente;
            cell("Paciente", x, y, widths.paciente, headerH, true); x += widths.paciente;
            cell("Motivo", x, y, widths.motivo, headerH, true); x += widths.motivo;
            cell("Clasif.", x, y, widths.clasif, headerH, true);
            y += headerH;
        }

        x = startX;
        cell(String(r.id ?? ""), x, y, widths.id, rowH); x += widths.id;
        cell(fmtDateTime(r.triageAt), x, y, widths.fecha, rowH); x += widths.fecha;
        cell(r.patient?.expediente || "SIN EXPEDIENTE", x, y, widths.expediente, rowH); x += widths.expediente;
        cell(r.patient?.fullName || "", x, y, widths.paciente, rowH); x += widths.paciente;
        cell(r.motivoUrgencia || "", x, y, widths.motivo, rowH); x += widths.motivo;
        cell(r.classification || "", x, y, widths.clasif, rowH);

        y += rowH;
    }

    y += 30;

    doc.font("Helvetica").fontSize(10).text("Firma del personal de enfermería:", 60, y);
    doc.moveTo(220, y + 14).lineTo(500, y + 14).stroke();

    y += 28;
    doc.font("Helvetica-Bold").fontSize(10).text(nurseName, 220, y);

    doc.end();
}