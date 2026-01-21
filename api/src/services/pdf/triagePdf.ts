import PDFDocument from "pdfkit";

export function buildTriagePdf(triage: any, res: any) {
    const doc = new PDFDocument({ size: "A4", margin: 24 });
    doc.pipe(res);

    const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left;
    let y = doc.page.margins.top;

    // Header (logos como placeholders)
    doc.fontSize(10).text("SERVICIOS MEDICOS ESTATALES", x, y, { width: W, align: "center" });
    y += 14;
    doc.fontSize(10).text("HOSPITAL DE LA AMISTAD", x, y, { width: W, align: "center" });
    y += 14;
    doc.fontSize(11).text("HOJA DE VALORACIÓN EN URGENCIAS PEDIÁTRICAS", x, y, { width: W, align: "center" });
    y += 18;
    doc.fontSize(14).text("TRIAGE", x, y, { width: W, align: "center" });
    y += 16;

    // Caja identificación
    doc.rect(x, y, W, 92).stroke();
    doc.fontSize(9).text("DATOS DE IDENTIFICACIÓN", x, y + 4, { width: W, align: "center" });

    const yy = y + 18;
    doc.fontSize(9)
        .text(`FECHA: ${fmtDate(triage.triageAt)}`, x + 8, yy)
        .text(`HORA DE ATENCIÓN: ${fmtTime(triage.triageAt)}`, x + 180, yy)
        .text(`NÚMERO EXPEDIENTE: ${triage.patient.expediente ?? ""}`, x + 360, yy);

    doc.text(`MOTIVO DE LA URGENCIA: ${triage.motivoUrgencia}`, x + 8, yy + 16);
    doc.text(`NOMBRE COMPLETO: ${triage.patient.fullName}`, x + 8, yy + 32);
    doc.text(`FECHA DE NACIMIENTO: ${triage.patient.birthDate ? fmtDate(triage.patient.birthDate) : ""}`, x + 8, yy + 48);
    doc.text(`EDAD: ${triage.patient.age ?? ""}`, x + 260, yy + 48);
    doc.text(`SEXO: ${triage.patient.sex ?? ""}`, x + 360, yy + 48);

    y += 104;

    // Tabla semáforo (simplificada pero fiel)
    doc.rect(x, y, W, 140).stroke();
    doc.fontSize(9).text("PARAMETROS", x + 8, y + 6);

    const col1 = 120; // labels
    const colW = (W - col1) / 3;
    const hHead = 24;

    // headers colores
    drawHeader(doc, x + col1, y, colW, hHead, "VERDE", "#b7e1a1");
    drawHeader(doc, x + col1 + colW, y, colW, hHead, "AMARILLO", "#ffe699");
    drawHeader(doc, x + col1 + colW * 2, y, colW, hHead, "ROJO", "#f4b6b6");

    // filas
    const rows = [
        { label: "APARIENCIA", value: triage.appearance },
        { label: "RESPIRACIÓN", value: triage.respiration },
        { label: "CIRCULACIÓN", value: triage.circulation },
    ];

    let ry = y + hHead;
    const rh = 36;

    for (const r of rows) {
        doc.rect(x, ry, col1, rh).stroke();
        doc.fontSize(9).text(r.label, x + 8, ry + 12);

        drawCell(doc, x + col1, ry, colW, rh, r.value === "VERDE");
        drawCell(doc, x + col1 + colW, ry, colW, rh, r.value === "AMARILLO");
        drawCell(doc, x + col1 + colW * 2, ry, colW, rh, r.value === "ROJO");

        ry += rh;
    }

    // Clasificación final
    const cy = y + hHead + rh * 3;
    doc.rect(x, cy, col1, 32).stroke();
    doc.fontSize(9).text("CLASIFICACIÓN", x + 8, cy + 10);

    drawHeader(doc, x + col1, cy, colW, 32, "VERDE", "#b7e1a1", triage.classification === "VERDE");
    drawHeader(doc, x + col1 + colW, cy, colW, 32, "AMARILLO", "#ffe699", triage.classification === "AMARILLO");
    drawHeader(doc, x + col1 + colW * 2, cy, colW, 32, "ROJO", "#f4b6b6", triage.classification === "ROJO");

    y += 152;

    // Secciones nota médica
    const note = triage.medicalNote;

    y = section(doc, x, y, W, "PADECIMIENTO ACTUAL", note?.padecimientoActual ?? "");
    y = section(doc, x, y, W, "ANTECEDENTES DE IMPORTANCIA", note?.antecedentes ?? "");
    y = section(doc, x, y, W, "EXPLORACIÓN FÍSICA", note?.exploracionFisica ?? "");
    y = section(doc, x, y, W, "ESTUDIOS PARACLÍNICOS", note?.estudiosParaclinicos ?? "");
    y = section(doc, x, y, W, "DIAGNÓSTICO(S)", note?.diagnostico ?? "");
    y = section(doc, x, y, W, "PLAN O TRATAMIENTO A SEGUIR", note?.planTratamiento ?? "");

    // Firmas
    y += 8;
    doc.rect(x, y, W, 70).stroke();
    doc.fontSize(9).text("Nombre / Cédula / Firma del médico:", x + 8, y + 8);
    doc.text(`${note?.doctor?.name ?? ""} ${note?.doctor?.cedula ? `- ${note.doctor.cedula}` : ""}`, x + 8, y + 24);

    doc.text("Nombre y firma responsable del paciente:", x + W / 2, y + 8);

    doc.end();
}

function section(doc: any, x: number, y: number, w: number, title: string, body: string) {
    const h = 70;
    doc.rect(x, y, w, h).stroke();
    doc.fontSize(9).text(title, x + 8, y + 6);
    doc.fontSize(9).text(body || "", x + 8, y + 22, { width: w - 16, height: h - 26 });
    return y + h;
}

function drawHeader(doc: any, x: number, y: number, w: number, h: number, text: string, fill: string, strong = false) {
    doc.save();
    doc.rect(x, y, w, h).fill(fill).stroke();
    doc.fillColor("#000").fontSize(10).text(text, x, y + 7, { width: w, align: "center" });
    if (strong) doc.rect(x + 2, y + 2, w - 4, h - 4).stroke();
    doc.restore();
}

function drawCell(doc: any, x: number, y: number, w: number, h: number, checked: boolean) {
    doc.rect(x, y, w, h).stroke();
    if (checked) {
        doc.save();
        doc.fontSize(18).text("✓", x + w / 2 - 6, y + h / 2 - 10);
        doc.restore();
    }
}

function fmtDate(d: Date | string) {
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
}
function fmtTime(d: Date | string) {
    const dt = new Date(d);
    return dt.toTimeString().slice(0, 5);
}
