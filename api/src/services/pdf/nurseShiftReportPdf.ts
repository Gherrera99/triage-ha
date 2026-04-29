import PDFDocument from "pdfkit";
import type { Writable } from "stream";
import fs from "node:fs";
import path from "node:path";

const TZ = "America/Merida";

const ASSETS_DIR = path.resolve(process.cwd(), "src/assets/pdf");
const LOGO_LEFT  = process.env.TRIAGE_PDF_LOGO_LEFT  || path.join(ASSETS_DIR, "logo_yucatan.png");
const LOGO_RIGHT = process.env.TRIAGE_PDF_LOGO_RIGHT || path.join(ASSETS_DIR, "logo_hospital.png");

const C = {
    black:   "#111111",
    greyBar: "#d9d9d9",
    blueBar: "#cfe4f7",
    blueHead:"#2563eb",
    rowAlt:  "#f8fafc",
    green:   "#16a34a",
    yellow:  "#d97706",
    red:     "#dc2626",
};

function fmtDateTime(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    }).format(d);
}

function fmtDate(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
}

function drawLogoInBox(
    doc: PDFKit.PDFDocument,
    file: string,
    boxX: number, boxY: number,
    boxW: number, boxH: number,
    align: "left" | "right"
) {
    if (!fs.existsSync(file)) return;
    const img = (doc as any).openImage(file);
    const scale = Math.min(boxW / img.width, boxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = align === "right" ? boxX + boxW - w : boxX;
    const y = boxY + (boxH - h) / 2;
    doc.image(img, x, y, { width: w, height: h });
}

function textBox(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number, y: number, w: number, h: number,
    opts?: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; color?: string; pad?: number }
) {
    const size  = opts?.size  ?? 8;
    const pad   = opts?.pad   ?? 3;
    const align = opts?.align ?? "left";
    const color = opts?.color ?? C.black;

    doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(size)
        .fillColor(color);

    const th = doc.heightOfString(text || " ", { width: w - pad * 2 });
    const ty = y + Math.max(pad, (h - th) / 2);

    doc.text(text || "", x + pad, ty, {
        width: w - pad * 2,
        height: h - pad * 2,
        align,
        ellipsis: true,
    });
}

function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill: string) {
    doc.save().fillColor(fill).rect(x, y, w, h).fill().restore();
}

function clasifColor(c: string) {
    if (c === "ROJO")     return C.red;
    if (c === "AMARILLO") return C.yellow;
    return C.green;
}

export function buildNurseShiftReportPdf(params: {
    nurseName: string;
    rows: any[];
    generatedAt?: Date;
}, out: Writable) {
    const { nurseName, rows, generatedAt = new Date() } = params;

    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    doc.pipe(out);

    const M  = 36;
    const PW = doc.page.width;
    const PH = doc.page.height;
    const W  = PW - M * 2;

    // ─── HEADER ──────────────────────────────────────────────────
    const logoW = 90;
    const logoH = 52;
    const headerH = logoH + 8;

    const hY = M;

    drawLogoInBox(doc, LOGO_LEFT,  M,              hY, logoW, logoH, "left");
    drawLogoInBox(doc, LOGO_RIGHT, M + W - logoW,  hY, logoW, logoH, "right");

    const titleX = M + logoW + 6;
    const titleW = W - (logoW + 6) * 2;
    const titleY = hY;

    textBox(doc, "SERVICIOS MÉDICOS ESTATALES",        titleX, titleY,      titleW, 14, { bold: true, align: "center", size: 9 });
    textBox(doc, "HOSPITAL DE LA AMISTAD",             titleX, titleY + 14, titleW, 14, { bold: true, align: "center", size: 9 });
    textBox(doc, "REPORTE DE PACIENTES ATENDIDOS",     titleX, titleY + 28, titleW, 12, { bold: true, align: "center", size: 8.5 });
    textBox(doc, "ÁREA DE TRIAGE — TURNO DE ENFERMERÍA", titleX, titleY + 40, titleW, 12, { bold: true, align: "center", size: 8 });

    let y = M + headerH + 4;

    // Línea separadora
    doc.save().lineWidth(1.5).strokeColor("#2563eb")
        .moveTo(M, y).lineTo(M + W, y).stroke().restore();
    y += 6;

    // ─── INFO STRIP ──────────────────────────────────────────────
    const stripH = 22;
    fillRect(doc, M, y, W, stripH, C.blueBar);
    doc.rect(M, y, W, stripH).stroke();

    const col1W = Math.round(W * 0.42);
    const col2W = Math.round(W * 0.30);
    const col3W = W - col1W - col2W;

    doc.save().strokeColor("#9ca3af").lineWidth(0.5)
        .moveTo(M + col1W, y).lineTo(M + col1W, y + stripH).stroke()
        .moveTo(M + col1W + col2W, y).lineTo(M + col1W + col2W, y + stripH).stroke()
        .restore();

    textBox(doc, `Enfermero(a): ${nurseName}`,                    M,                  y, col1W, stripH, { bold: true, size: 8.5, pad: 6 });
    textBox(doc, `Fecha: ${fmtDateTime(generatedAt)}`,             M + col1W,          y, col2W, stripH, { size: 8.5, align: "center" });
    textBox(doc, `Total de pacientes: ${rows.length}`,            M + col1W + col2W,  y, col3W, stripH, { bold: true, size: 8.5, align: "center" });

    y += stripH + 8;

    // ─── TABLE ───────────────────────────────────────────────────
    // Ancho total disponible (W = page - 2*M = 540pt en LETTER).
    // Se ensancha 'edad' para acomodar "X anios Y meses" sin truncar,
    // y se estrechan 'expediente' y 'motivo' compensando.
    const cols = {
        fecha:      105,
        expediente:  65,
        paciente:   160,
        edad:        65,
        motivo:      95,
        clasif:      W - 105 - 65 - 160 - 65 - 95, // remaining = 50pt
    };

    const headerH2 = 22;
    fillRect(doc, M, y, W, headerH2, C.blueHead);

    let cx = M;
    function head(label: string, w: number) {
        textBox(doc, label, cx, y, w, headerH2, { bold: true, align: "center", size: 8, color: "#ffffff" });
        if (cx + w < M + W) {
            doc.save().strokeColor("rgba(255,255,255,0.3)").lineWidth(0.5)
                .moveTo(cx + w, y).lineTo(cx + w, y + headerH2).stroke().restore();
        }
        cx += w;
    }

    head("Fecha / Hora",  cols.fecha);
    head("Expediente",    cols.expediente);
    head("Paciente",      cols.paciente);
    head("Edad",          cols.edad);
    head("Motivo",        cols.motivo);
    head("Clasif.",       cols.clasif);

    doc.rect(M, y, W, headerH2).lineWidth(0.8).stroke();

    y += headerH2;

    const rowH = 24;
    let rowIndex = 0;

    function drawRow(r: any, yy: number) {
        const alt = rowIndex % 2 === 1;
        if (alt) fillRect(doc, M, yy, W, rowH, C.rowAlt);
        doc.rect(M, yy, W, rowH).lineWidth(0.4).strokeColor("#e5e7eb").stroke();

        let rx = M;
        function cell(text: string, w: number, opts?: { align?: "left" | "center" | "right"; color?: string; bold?: boolean }) {
            textBox(doc, text, rx, yy, w, rowH, { size: 7.8, align: opts?.align ?? "left", color: opts?.color, bold: opts?.bold });
            if (rx + w < M + W) {
                doc.save().strokeColor("#e5e7eb").lineWidth(0.4)
                    .moveTo(rx + w, yy).lineTo(rx + w, yy + rowH).stroke().restore();
            }
            rx += w;
        }

        cell(fmtDateTime(r.triageAt),              cols.fecha);
        cell(r.patient?.expediente || "—",         cols.expediente, { align: "center" });
        cell(r.patient?.fullName   || "—",         cols.paciente,   { bold: true });
        cell(r.patient?.age        || "—",         cols.edad,       { align: "center" });
        cell(r.motivoUrgencia      || "—",         cols.motivo);

        // Clasificacion: texto en color (sin fondo ni borde) para que se imprima
        // claramente y no se vea opaco con tintas de transparencia.
        const cl = (r.classification || "").toUpperCase();
        const clColor = clasifColor(cl);
        textBox(doc, cl, rx, yy, cols.clasif, rowH, {
            bold: true,
            align: "center",
            color: clColor,
            size: 8,
        });

        rowIndex++;
    }

    function drawPageHeader(yy: number): number {
        fillRect(doc, M, yy, W, headerH2, C.blueHead);
        cx = M;
        head("Fecha / Hora",  cols.fecha);
        head("Expediente",    cols.expediente);
        head("Paciente",      cols.paciente);
        head("Edad",          cols.edad);
        head("Motivo",        cols.motivo);
        head("Clasif.",       cols.clasif);
        doc.rect(M, yy, W, headerH2).lineWidth(0.8).stroke();
        return yy + headerH2;
    }

    const footerReserve = 90; // firma + footer text

    for (const r of rows) {
        if (y + rowH > PH - M - footerReserve) {
            doc.addPage();
            y = M;
            // small header on continuation pages
            textBox(doc, `Reporte de Enfermería — ${nurseName} (cont.)`, M, y, W, 18, { bold: true, size: 8, align: "center" });
            y += 22;
            y = drawPageHeader(y);
        }
        drawRow(r, y);
        y += rowH;
    }

    if (rows.length === 0) {
        fillRect(doc, M, y, W, 36, C.rowAlt);
        doc.rect(M, y, W, 36).lineWidth(0.4).strokeColor("#e5e7eb").stroke();
        textBox(doc, "Sin registros para el turno actual.", M, y, W, 36, { align: "center", size: 9, color: "#6b7280" });
        y += 36;
    }

    y += 16;

    // ─── FIRMA ───────────────────────────────────────────────────
    // anchored near bottom
    const sigY = PH - M - 60;
    if (y < sigY) y = sigY;

    doc.save().lineWidth(0.8).strokeColor(C.black);

    // Línea firma enfermero
    const lineStartX = M + 30;
    const lineEndX   = M + W / 2 - 20;
    doc.moveTo(lineStartX, y + 24).lineTo(lineEndX, y + 24).stroke();
    textBox(doc, "Firma del personal de enfermería", lineStartX, y + 26, lineEndX - lineStartX, 14, { align: "center", size: 7.5 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.black)
        .text(nurseName, lineStartX, y + 38, { width: lineEndX - lineStartX, align: "center" });

    // Línea jefe de turno
    const line2StartX = M + W / 2 + 20;
    const line2EndX   = M + W - 30;
    doc.moveTo(line2StartX, y + 24).lineTo(line2EndX, y + 24).stroke();
    textBox(doc, "Vo.Bo. Jefe de turno / Supervisión", line2StartX, y + 26, line2EndX - line2StartX, 14, { align: "center", size: 7.5 });

    doc.restore();

    // ─── FOOTER ──────────────────────────────────────────────────
    const footerY = PH - M + 4;
    doc.save().lineWidth(0.5).strokeColor("#9ca3af")
        .moveTo(M, footerY - 6).lineTo(M + W, footerY - 6).stroke().restore();

    doc.font("Helvetica").fontSize(6.5).fillColor("#6b7280")
        .text(
            `Hospital de la Amistad · Calle 60 sur S/N × Periférico Sur, Col. San José Tecoh 2, Mérida, Yuc. · Tel: 1-68-70-72`,
            M, footerY, { width: W, align: "center" }
        );

    doc.font("Helvetica").fontSize(6.5).fillColor("#9ca3af")
        .text(`Generado: ${fmtDateTime(generatedAt)}`, M, footerY, { width: W, align: "right" });

    doc.end();
}
