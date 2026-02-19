// api/src/services/pdf/triagePdf.ts
import PDFDocument from "pdfkit";
import type { Writable } from "stream";
import fs from "node:fs";
import path from "node:path";

const TZ = "America/Merida";

// === Logos ===
const ASSETS_DIR = path.resolve(process.cwd(), "src/assets/pdf");
const LOGO_LEFT = process.env.TRIAGE_PDF_LOGO_LEFT || path.join(ASSETS_DIR, "logo_yucatan.png");
const LOGO_RIGHT = process.env.TRIAGE_PDF_LOGO_RIGHT || path.join(ASSETS_DIR, "logo_hospital.png");

// === Page size: OFICIO (8.5x13) por defecto ===
function resolvePageSize() {
    const v = (process.env.TRIAGE_PDF_PAGE_SIZE || "OFICIO").toUpperCase();
    if (v === "OFICIO") return [612, 936]; // 8.5*72, 13*72
    if (v === "LEGAL") return "LEGAL";
    if (v === "LETTER" || v === "CARTA") return "LETTER";
    if (v === "A4") return "A4";
    return [612, 936];
}

// === Colores (aprox al formato) ===
const C = {
    black: "#111111",
    greyBar: "#d9d9d9",
    blueBar: "#cfe4f7",

    greenHead: "#8cc63e",
    yellowHead: "#fff200",
    redHead: "#ff4d4d",

    greenBody: "#cfeec5",
    yellowBody: "#fff3b0",
    redBody: "#f8b2b2",
};

function fmtDateMerida(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}
function fmtTimeMerida(d?: Date | null) {
    if (!d) return "";
    return new Intl.DateTimeFormat("es-MX", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}
function safeStr(v: any) {
    return (v ?? "").toString();
}

type Align = "left" | "center" | "right";

function rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill?: string) {
    if (fill) doc.save().fillColor(fill).rect(x, y, w, h).fill().restore();
    doc.rect(x, y, w, h).stroke();
}

function textInBox(
    doc: PDFKit.PDFDocument,
    txt: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: {
        size?: number;
        bold?: boolean;
        align?: Align;
        pad?: number;
        vCenter?: boolean;
        lineGap?: number;
        ellipsis?: boolean;
    }
) {
    const size = opts?.size ?? 8;
    const pad = opts?.pad ?? 2;
    const align = opts?.align ?? "left";
    const vCenter = opts?.vCenter ?? false;
    const lineGap = opts?.lineGap ?? 0;
    const ellipsis = opts?.ellipsis ?? false; // por defecto NO "..."

    doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica");
    doc.fontSize(size).fillColor(C.black);

    const text = txt || "";

    if (!vCenter) {
        doc.text(text, x + pad, y + pad, {
            width: w - pad * 2,
            height: h - pad * 2,
            align,
            lineGap,
            ellipsis,
        });
        return;
    }

    const th = doc.heightOfString(text, { width: w - pad * 2, lineGap });
    const ty = y + Math.max(pad, (h - th) / 2);
    doc.text(text, x + pad, ty, {
        width: w - pad * 2,
        height: h - pad * 2,
        align,
        lineGap,
        ellipsis,
    });
}

function drawCheck(doc: PDFKit.PDFDocument, x: number, y: number, s: number, checked: boolean) {
    doc.rect(x, y, s, s).stroke();
    if (!checked) return;
    doc.save();
    doc.lineWidth(1.05);
    doc.moveTo(x + 2, y + 2).lineTo(x + s - 2, y + s - 2).stroke();
    doc.moveTo(x + s - 2, y + 2).lineTo(x + 2, y + s - 2).stroke();
    doc.restore();
}

function drawXCentered(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
    doc.save();
    doc.font("Helvetica-Bold").fillColor(C.black).fontSize(10);
    doc.text("X", x, y + (h - 10) / 2 - 1, { width: w, align: "center" });
    doc.restore();
}

function drawLogoInBox(
    doc: PDFKit.PDFDocument,
    file: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    align: "left" | "right"
) {
    if (!fs.existsSync(file)) return;

    // openImage no siempre está en typings, por eso el any
    const img = (doc as any).openImage(file);
    const scale = Math.min(boxW / img.width, boxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;

    const x = align === "right" ? boxX + boxW - w : boxX;
    const y = boxY + (boxH - h) / 2;

    doc.image(img, x, y, { width: w, height: h });
}

function textSingleLineAutoFit(
    doc: PDFKit.PDFDocument,
    txt: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { bold?: boolean; align?: Align; pad?: number; size?: number; minSize?: number }
) {
    const pad = opts?.pad ?? 2;
    const align = opts?.align ?? "left";
    const minSize = opts?.minSize ?? 6.8;
    let size = opts?.size ?? 8.5;

    doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica");

    while (size >= minSize) {
        doc.fontSize(size);
        if (doc.widthOfString(txt) <= w - pad * 2) break;
        size -= 0.2;
    }

    const ty = y + (h - size) / 2 - 0.5;

    doc.fillColor(C.black).text(txt, x + pad, ty, {
        width: w - pad * 2,
        align,
        lineBreak: false,
    });
}

function textMultiLineAutoFit(
    doc: PDFKit.PDFDocument,
    txt: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { bold?: boolean; align?: Align; pad?: number; size?: number; minSize?: number; lineGap?: number }
) {
    const pad = opts?.pad ?? 1;
    const align = opts?.align ?? "left";
    const lineGap = opts?.lineGap ?? 0.6;
    const minSize = opts?.minSize ?? 5.4;
    let size = opts?.size ?? 6.2;

    doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica");

    while (size >= minSize) {
        doc.fontSize(size);
        const th = doc.heightOfString(txt, { width: w - pad * 2, lineGap });
        if (th <= h - pad * 2) break;
        size -= 0.2;
    }

    doc.fillColor(C.black).text(txt, x + pad, y + pad, {
        width: w - pad * 2,
        height: h - pad * 2,
        align,
        lineGap,
        ellipsis: false,
    });
}

// intenta bajar tamaño hasta que quepa en una sola línea
function drawInlineAutoFit(
    doc: PDFKit.PDFDocument,
    parts: string[],
    x: number,
    y: number,
    maxW: number,
    startSize = 7.6,
    minSize = 6.2
) {
    let size = startSize;
    while (size >= minSize) {
        doc.font("Helvetica").fontSize(size);
        const total = parts.reduce((acc, t) => acc + doc.widthOfString(t), 0);
        if (total <= maxW) break;
        size -= 0.2;
    }
    let cx = x;
    doc.font("Helvetica").fontSize(size).fillColor(C.black);
    for (const t of parts) {
        doc.text(t, cx, y, { lineBreak: false });
        cx += doc.widthOfString(t);
    }
}

function mapVigilancia(v: any): Record<string, boolean> {
    if (!v) return {};
    if (typeof v === "object" && !Array.isArray(v)) return v as any;
    if (Array.isArray(v)) {
        const txt = v.map(String).join(" ").toLowerCase();
        return {
            vigFiebre38: txt.includes("fiebre"),
            vigConvulsiones: txt.includes("convuls"),
            vigAlteracionAlerta: txt.includes("alerta"),
            vigSangradoActivo: txt.includes("sangrado"),
            vigDeshidratacion: txt.includes("deshidra"),
            vigVomitosFrecuentes: txt.includes("vomit") || txt.includes("vómit"),
            vigIrritabilidad: txt.includes("irrit"),
            vigLlantoInconsolable: txt.includes("llanto"),
            vigDificultadRespiratoria: txt.includes("respir"),
            vigChoque: txt.includes("choque"),
            vigDeterioroNeurologico: txt.includes("neuro"),
        };
    }
    return {};
}

// ========= Textos del formato =========
const PARAM_TXT = {
    APARIENCIA: {
        VERDE: "Despierto, atento, consciente,\ncon respuesta a estímulos, sonriente",
        AMARILLO:
            "Somnoliento, desconectado con el medio,\nirritable (llanto inconsolable), luce sin\nfuerzas, lenguaje perdido o incoherente,\nno responde, despierta solo a estímulos",
        ROJO: "Inconsciente, convulsiones, mirada perdida,\nsin respuesta a estímulos, mal aspecto,\nno despierta",
    },
    RESPIRACION: {
        VERDE: "Respiración rítmica, tranquila, sin\ndificultad respiratoria",
        AMARILLO:
            "Rápida o lenta (según la edad), tiene signos\nde dificultad respiratoria, se escuchan\nruidos respiratorios (estridor, sibilancias,\nronquido, disfonía)",
        ROJO: "No respira (apnea), quejido respiratorio,\ndificultad respiratoria severa",
    },
    CIRCULACION: {
        VERDE: "Tegumentos rosados normales, mucosas\nhidratadas",
        AMARILLO: "Palidez, mucosa seca, signos de\ndeshidratación, hemorragia contenida",
        ROJO: "Cianosis, hemorragia activa, piel\nmarmórea, diaforesis, palidez intensa",
    },
};

const CLASIF_TXT = {
    VERDE: {
        title: "URGENCIA NO CALIFICADA",
        desc: "Atención según disponibilidad del servicio,\nhasta 120 minutos de tiempo de espera,\npuede ser referido a su CS en caso necesario.",
    },
    AMARILLO: {
        title: "URGENCIA CALIFICADA",
        desc: "Se actúa según el caso: pasa a consultorio\no cama de observación, se toman signos vitales,tiene atención prioritaria, la respuesta debe ser de 15 a 60 minutos",
    },
    ROJO: {
        title: "EMERGENCIA O CRÍTICO",
        desc: "Eventos que ponen en peligro su vida.\nIngresa a cama de choque o reanimación\npara atención inmediata",
    },
};

// helper: bloque SI/NO + Lugar dentro de un ancho dado (nunca se pasa del límite)
function drawYesNoLugar(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    valueYes: boolean,
    place: string
) {
    const font = 8.1;
    const padL = 6;

    let cx = x + padL;

    // label
    const labelW = Math.min(168, Math.max(130, w * 0.52));
    textInBox(doc, label, cx, y, labelW, h, { bold: true, vCenter: true, size: font, pad: 1 });
    cx += labelW + 4;

    // No
    textInBox(doc, "No", cx, y, 14, h, { vCenter: true, size: font, pad: 0 });
    cx += 14;
    drawCheck(doc, cx, y + 4, 10, !valueYes);
    cx += 14;

    // Sí
    textInBox(doc, "Sí", cx, y, 14, h, { vCenter: true, size: font, pad: 0 });
    cx += 14;
    drawCheck(doc, cx, y + 4, 10, valueYes);
    cx += 16;

    // Lugar
    textInBox(doc, "Lugar:", cx, y, 38, h, { bold: true, vCenter: true, size: font, pad: 1 });
    cx += 40;

    const placeW = Math.max(10, x + w - 6 - cx);
    // aquí sí permitimos ellipsis para que jamás invada al bloque derecho
    textInBox(doc, place, cx, y, placeW, h, { vCenter: true, size: font, pad: 1, ellipsis: true });
}

export function buildTriagePdf(triage: any, out: Writable) {
    const doc = new PDFDocument({ size: resolvePageSize() as any, margin: 16 });
    doc.pipe(out);

    doc.lineWidth(1);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const M = 16;
    const W = pageW - M * 2;

    let y = M;

    // ============ HEADER ============
    const logoBoxH = 46;
    const logoBoxW = 96;

    drawLogoInBox(doc, LOGO_LEFT, M, y, logoBoxW, logoBoxH, "left");
    drawLogoInBox(doc, LOGO_RIGHT, pageW - M - logoBoxW, y, logoBoxW, logoBoxH, "right");

    const titleX = M + logoBoxW + 8;
    const titleW = W - (logoBoxW + 8) * 2;

    textInBox(doc, "SERVICIOS MÉDICOS ESTATALES", titleX, y + 0, titleW, 12, { bold: true, align: "center", vCenter: true, size: 10 });
    textInBox(doc, "HOSPITAL DE LA AMISTAD", titleX, y + 12, titleW, 12, { bold: true, align: "center", vCenter: true, size: 10 });
    textInBox(doc, "HOJA DE VALORACIÓN EN URGENCIAS PEDIÁTRICAS.", titleX, y + 24, titleW, 12, { bold: true, align: "center", vCenter: true, size: 9 });
    textInBox(doc, "TRIAGE", titleX, y + 36, titleW, 16, { bold: true, align: "center", vCenter: true, size: 14 });

// antes tenías y += 56;
    y += 60;


    // ============ DATOS IDENTIFICACIÓN ============
    const idTitleH = 12;
    rect(doc, M, y, W, idTitleH, C.greyBar);
    textInBox(doc, "DATOS DE IDENTIFICACIÓN", M, y, W, idTitleH, { bold: true, align: "center", vCenter: true, size: 9.5 });
    y += idTitleH;

    const idBoxH = 54;
    rect(doc, M, y, W, idBoxH);

    const p = triage.patient ?? {};
    const n = triage.medicalNote ?? {};
    const horaAtencion = n.consultationStartedAt ?? triage.triageAt;

    const rowH = idBoxH / 3;

    // Fila 1: Fecha / Hora / Expediente
    const c1 = Math.round(W * 0.33);
    const c2 = Math.round(W * 0.30);
    const c3 = W - c1 - c2;

    doc.moveTo(M + c1, y).lineTo(M + c1, y + rowH).stroke();
    doc.moveTo(M + c1 + c2, y).lineTo(M + c1 + c2, y + rowH).stroke();
    doc.moveTo(M, y + rowH).lineTo(M + W, y + rowH).stroke();
    doc.moveTo(M, y + rowH * 2).lineTo(M + W, y + rowH * 2).stroke();

    textInBox(doc, "FECHA:", M + 6, y, 44, rowH, { bold: true, vCenter: true, size: 8.8 });
    textInBox(doc, fmtDateMerida(triage.triageAt), M + 50, y, c1 - 56, rowH, { vCenter: true, size: 8.8 });

    textInBox(doc, "HORA DE ATENCIÓN:", M + c1 + 6, y, 110, rowH, { bold: true, vCenter: true, size: 8.8 });
    textInBox(doc, fmtTimeMerida(horaAtencion), M + c1 + 118, y, c2 - 124, rowH, { vCenter: true, size: 8.8 });

    textInBox(doc, "NÚMERO EXPEDIENTE:", M + c1 + c2 + 6, y, 132, rowH, { bold: true, vCenter: true, size: 8.8 });
    textInBox(doc, safeStr(p.expediente), M + c1 + c2 + 140, y, c3 - 146, rowH, { vCenter: true, size: 8.8 });

    // Fila 2: Motivo + Nombre
    const row2Y = y + rowH;
    const split2 = Math.round(W * 0.52);
    doc.moveTo(M + split2, row2Y).lineTo(M + split2, row2Y + rowH).stroke();

    textInBox(doc, "MOTIVO DE LA URGENCIA:", M + 6, row2Y, 150, rowH, { bold: true, vCenter: true, size: 8.6 });
    textInBox(doc, safeStr(triage.motivoUrgencia).toUpperCase(), M + 158, row2Y, split2 - 164, rowH, { vCenter: true, size: 8.6 });

    textInBox(doc, "NOMBRE COMPLETO:", M + split2 + 6, row2Y, 120, rowH, { bold: true, vCenter: true, size: 8.6 });
    textInBox(doc, safeStr(p.fullName).toUpperCase(), M + split2 + 128, row2Y, W - split2 - 134, rowH, { vCenter: true, size: 8.6 });

    // Fila 3: Fecha nac + Edad/Sexo
    const row3Y = y + rowH * 2;
    const rightW = 190;
    doc.moveTo(M + W - rightW, row3Y).lineTo(M + W - rightW, row3Y + rowH).stroke();

    textInBox(doc, "FECHA DE NACIMIENTO:", M + 6, row3Y, 140, rowH, { bold: true, vCenter: true, size: 8.6 });
    textInBox(doc, fmtDateMerida(p.dateNacimiento), M + 148, row3Y, W - rightW - 154, rowH, { vCenter: true, size: 8.6 });

    textInBox(doc, "EDAD:", M + W - rightW + 6, row3Y, 40, rowH, { bold: true, vCenter: true, size: 8.6 });
    textInBox(doc, safeStr(p.age), M + W - rightW + 46, row3Y, 38, rowH, { vCenter: true, size: 8.6 });

    textInBox(doc, "SEXO:", M + W - rightW + 92, row3Y, 44, rowH, { bold: true, vCenter: true, size: 8.6 });
    textInBox(doc, safeStr(p.sex), M + W - rightW + 136, row3Y, rightW - 142, rowH, { vCenter: true, size: 8.6 });

    y += idBoxH;

    // ============ Banda instrucción ============
    const instrH = 11;
    rect(doc, M, y, W, instrH, C.blueBar);
    textInBox(
        doc,
        "Se deberá seleccionar la casilla según lo observado en cada uno de los parámetros y subrayar lo que se observe.",
        M,
        y,
        W,
        instrH,
        { bold: true, align: "center", vCenter: true, size: 7.8 }
    );
    y += instrH;

    // ============ TABLA PARÁMETROS ============
    const tblX = M;
    const leftW2 = 120;

    // ✅ tick más angosto para ganar ancho de texto
    const tickW = 18;
    const groupW = (W - leftW2) / 3;
    const txtW = groupW - tickW;

    const headH = 24;
    const rowPH = 34;

    rect(doc, tblX, y, leftW2, headH, C.blueBar);
    textInBox(doc, "PARÁMETROS:", tblX, y, leftW2, headH, { bold: true, align: "center", vCenter: true, size: 12 });

    rect(doc, tblX + leftW2, y, groupW, headH, C.greenHead);
    textInBox(doc, "VERDE", tblX + leftW2, y, groupW, headH, { bold: true, align: "center", vCenter: true, size: 14 });

    rect(doc, tblX + leftW2 + groupW, y, groupW, headH, C.yellowHead);
    textInBox(doc, "AMARILLO", tblX + leftW2 + groupW, y, groupW, headH, { bold: true, align: "center", vCenter: true, size: 14 });

    rect(doc, tblX + leftW2 + groupW * 2, y, groupW, headH, C.redHead);
    textInBox(doc, "ROJO", tblX + leftW2 + groupW * 2, y, groupW, headH, { bold: true, align: "center", vCenter: true, size: 14 });

    y += headH;

    const paramRows = [
        { label: "APARIENCIA", pick: String(triage.appearance ?? "VERDE") },
        { label: "RESPIRACION", pick: String(triage.respiration ?? "VERDE") },
        { label: "CIRCULACION", pick: String(triage.circulation ?? "VERDE") },
    ] as const;

    for (const r of paramRows) {
        rect(doc, tblX, y, leftW2, rowPH);
        textInBox(doc, r.label, tblX, y, leftW2, rowPH, { bold: true, align: "center", vCenter: true, size: 11 });

        rect(doc, tblX + leftW2, y, txtW, rowPH, C.greenBody);
        rect(doc, tblX + leftW2 + txtW, y, tickW, rowPH);
        textInBox(doc, (PARAM_TXT as any)[r.label].VERDE, tblX + leftW2, y, txtW, rowPH, { align: "center", vCenter: true, size: 7, lineGap: 1 });

        rect(doc, tblX + leftW2 + groupW, y, txtW, rowPH, C.yellowBody);
        rect(doc, tblX + leftW2 + groupW + txtW, y, tickW, rowPH);
        textInBox(doc, (PARAM_TXT as any)[r.label].AMARILLO, tblX + leftW2 + groupW, y, txtW, rowPH, {
            align: "center",
            vCenter: true,
            size: 6.5,
            lineGap: 1,
        });

        rect(doc, tblX + leftW2 + groupW * 2, y, txtW, rowPH, C.redBody);
        rect(doc, tblX + leftW2 + groupW * 2 + txtW, y, tickW, rowPH);
        textInBox(doc, (PARAM_TXT as any)[r.label].ROJO, tblX + leftW2 + groupW * 2, y, txtW, rowPH, {
            align: "center",
            vCenter: true,
            size: 6.5,
            lineGap: 1,
        });

        const pick = r.pick === "AMARILLO" ? "AMARILLO" : r.pick === "ROJO" ? "ROJO" : "VERDE";
        const tickX =
            pick === "VERDE"
                ? tblX + leftW2 + txtW
                : pick === "AMARILLO"
                    ? tblX + leftW2 + groupW + txtW
                    : tblX + leftW2 + groupW * 2 + txtW;

        drawXCentered(doc, tickX, y, tickW, rowPH);

        y += rowPH;
    }

    // ============ CLASIFICACIÓN ============
    const classH = 72;
    rect(doc, tblX, y, leftW2, classH, C.blueBar);
    textInBox(doc, "CLASIFICACIÓN DE\nLA URGENCIA", tblX, y, leftW2, classH, { bold: true, align: "center", vCenter: true, size: 9.2 });

    // ✅ más alto arriba para que quepa "URGENCIA NO CALIFICADA" sin truncar
    const topH = 36;
    const botH = classH - topH;

    function clasifBlock(ix: number, headFill: string, bodyFill: string, name: "VERDE" | "AMARILLO" | "ROJO") {
        const gx = tblX + leftW2 + groupW * ix;

        rect(doc, gx, y, txtW, topH, headFill);
        rect(doc, gx + txtW, y, tickW, classH);

        textInBox(doc, name, gx, y, txtW, 14, { bold: true, align: "center", vCenter: true, size: 12 });
        textInBox(doc, (CLASIF_TXT as any)[name].title, gx, y + 14, txtW, topH - 14, {
            bold: true,
            align: "center",
            vCenter: true,
            size: 8.2,
            lineGap: 0.6,
        });

        rect(doc, gx, y + topH, txtW, botH, bodyFill);
        textInBox(doc, (CLASIF_TXT as any)[name].desc, gx, y + topH, txtW, botH, {
            align: "center",
            vCenter: true,
            size: 6.2,
            lineGap: 0.8,
        });
    }

    clasifBlock(0, C.greenHead, C.greenBody, "VERDE");
    clasifBlock(1, C.yellowHead, C.yellowBody, "AMARILLO");
    clasifBlock(2, C.redHead, C.redBody, "ROJO");

    const pickC = triage.classification === "AMARILLO" ? "AMARILLO" : triage.classification === "ROJO" ? "ROJO" : "VERDE";
    const tickCX =
        pickC === "VERDE"
            ? tblX + leftW2 + txtW
            : pickC === "AMARILLO"
                ? tblX + leftW2 + groupW + txtW
                : tblX + leftW2 + groupW * 2 + txtW;

    drawXCentered(doc, tickCX, y, tickW, classH);

    y += classH;

    // ============ Responsable / Maya ============
    const miniH = 18;
    rect(doc, M, y, W, miniH);

    const mayaW = 170;               // ↓ más compacto
    const leftW = W - mayaW;         // ancho real para el responsable
    doc.moveTo(M + leftW, y).lineTo(M + leftW, y + miniH).stroke();

// label + value (auto-fit)
    const respLabelW = 190;
    textInBox(doc, "Nombre del Responsable del paciente:", M + 6, y, respLabelW, miniH, { bold: true, vCenter: true, size: 8.5, pad: 1 });

    const respValueX = M + 6 + respLabelW + 4;
    const respValueW = leftW - (respLabelW + 14);
    textSingleLineAutoFit(doc, safeStr(p.responsibleName).toUpperCase(), respValueX, y, respValueW, miniH, {
        size: 8.5,
        minSize: 6.8,
        pad: 1,
        align: "left",
    });

// maya hablante (en su bloque)
    const mx = M + leftW + 6;
    textInBox(doc, "Maya Hablante:", mx, y, 74, miniH, { bold: true, vCenter: true, size: 8.5, pad: 1 });

    textInBox(doc, "SI", mx + 76, y, 12, miniH, { vCenter: true, size: 8.5, pad: 0 });
    drawCheck(doc, mx + 90, y + 4, 10, !!p.mayaHabla);

    textInBox(doc, "NO", mx + 106, y, 14, miniH, { vCenter: true, size: 8.5, pad: 0 });
    drawCheck(doc, mx + 122, y + 4, 10, !p.mayaHabla);

    y += miniH;


    // ============ Atención previa / Referencia (FIX: layout relativo por mitad) ============
    rect(doc, M, y, W, miniH);
    const half = W / 2;
    doc.moveTo(M + half, y).lineTo(M + half, y + miniH).stroke();

    // izquierda (dentro de [M, M+half])
    drawYesNoLugar(
        doc,
        M,
        y,
        half,
        miniH,
        "Atención previa por la misma patología:",
        !!triage.hadPriorCareSamePathology,
        safeStr(triage.priorCarePlace)
    );

    // derecha (dentro de [M+half, M+W])
    drawYesNoLugar(
        doc,
        M + half,
        y,
        half,
        miniH,
        "Paciente con Referencia:",
        !!triage.hasReferral,
        safeStr(triage.referralPlace)
    );

    y += miniH;

    // ============ Signos vitales ============
    rect(doc, M, y, W, miniH);
    textInBox(doc, "SIGNOS VITALES / SOMATOMETRÍA", M + 6, y, 220, miniH, { bold: true, vCenter: true, size: 8.4 });

    const sx = M + 230;
    const sy = y + 5;
    const maxW = W - 236;

    const parts = [
        `Peso: ${safeStr(triage.weightKg)}  `,
        "Kg   ",
        `Talla: ${safeStr(triage.heightCm)}  `,
        "cm   ",
        `Temp: ${safeStr(triage.temperatureC)}  `,
        "°C   ",
        `F.C.: ${safeStr(triage.heartRate)}  `,
        "x'   ",
        `F.R.: ${safeStr(triage.respiratoryRate)}  `,
        "x'   ",
        `T.A.: ${safeStr(triage.bloodPressure)}  `,
        "mmHg",
    ];
    drawInlineAutoFit(doc, parts, sx, sy, maxW, 7.6, 6.2);

    y += miniH;

    // ================== BLOQUES INFERIORES ANCLADOS ==================
    const footerH = 12;
    const footerTop = pageH - M - footerH;

    const sigH = 56;
    const sigTop = footerTop - 6 - sigH;

    const contraTitleH = 12;
    const contraRowH = 18;
    const contraH = contraTitleH + contraRowH;

    const proH = 18;

    // ✅ gaps mínimos (para ganar espacio)
    const proTop = sigTop - 2 - proH;
    const contraTop = proTop - 2 - contraH;

    // Área disponible para secciones (PA, ANT, EF, EP, DX, PLAN)
    const titleH = 12;
    const sectionsTopY = y;
    const availableForSections = Math.max(120, contraTop - sectionsTopY);

    const totalTitle = titleH * 6;
    const contentAvail = Math.max(160, availableForSections - totalTitle);

    // alturas base con mínimos
    const mins = { pa: 28, ant: 28, ef: 34, ep: 28, dx: 52 };
    const weights = { pa: 0.9, ant: 0.9, ef: 1.15, ep: 0.85, dx: 1.2 };

    const sumW = Object.values(weights).reduce((a, b) => a + b, 0);
    const unit = contentAvail / (sumW + 2.5); // + plan weight

    let hPA = Math.max(mins.pa, Math.round(unit * weights.pa));
    let hANT = Math.max(mins.ant, Math.round(unit * weights.ant));
    let hEF = Math.max(mins.ef, Math.round(unit * weights.ef));
    let hEP = Math.max(mins.ep, Math.round(unit * weights.ep));
    let hDX = Math.max(mins.dx, Math.round(unit * weights.dx));

    // ✅ PLAN = lo que SOBRA (garantiza que NO se monta con contrarreferencia)
    let used = hPA + hANT + hEF + hEP + hDX;
    let hPLAN = contentAvail - used;

    const planMin = 110;
    if (hPLAN < planMin) {
        // si falta, recorta un poco de las otras secciones (sin bajar de mínimos)
        let need = planMin - hPLAN;
        const order: Array<[keyof typeof mins, () => number, (v: number) => void]> = [
            ["dx", () => hDX, (v) => (hDX = v)],
            ["ef", () => hEF, (v) => (hEF = v)],
            ["pa", () => hPA, (v) => (hPA = v)],
            ["ant", () => hANT, (v) => (hANT = v)],
            ["ep", () => hEP, (v) => (hEP = v)],
        ];

        for (const [k, get, set] of order) {
            if (need <= 0) break;
            const cur = get();
            const min = (mins as any)[k] as number;
            const can = Math.max(0, cur - min);
            const take = Math.min(can, need);
            set(cur - take);
            need -= take;
        }
        used = hPA + hANT + hEF + hEP + hDX;
        hPLAN = Math.max(80, contentAvail - used); // ya nunca se pasa
    }

    function section(title: string, content: string, h: number) {
        rect(doc, M, y, W, titleH, C.greyBar);
        textInBox(doc, title, M + 6, y, W - 12, titleH, { bold: true, vCenter: true, size: 8.8 });
        y += titleH;

        rect(doc, M, y, W, h);
        textInBox(doc, content, M + 2, y + 1, W - 4, h - 2, { size: 8, pad: 5 });
        y += h;
    }

    section("PADECIMIENTO ACTUAL:", safeStr(n.padecimientoActual), hPA);
    section("ANTECEDENTES DE IMPORTANCIA RELACIONADOS CON EL PADECIMIENTO:", safeStr(n.antecedentes), hANT);
    section("EXPLORACIÓN FÍSICA:", safeStr(n.exploracionFisica), hEF);
    section("ESTUDIOS PARACLÍNICOS REALIZADOS Y/O SOLICITADOS:", safeStr(n.estudiosParaclinicos), hEP);
    section("DIAGNÓSTICO(S):", safeStr(n.diagnostico), hDX);

    // PLAN + VIGILANCIA
    rect(doc, M, y, W, titleH, C.greyBar);
    textInBox(doc, "PLAN O TRATAMIENTO A SEGUIR:", M + 6, y, W - 12, titleH, { bold: true, vCenter: true, size: 8.8 });
    y += titleH;

    const planRightW = 240;
    const planLeftW = W - planRightW;

    rect(doc, M, y, planLeftW, hPLAN);
    textInBox(doc, safeStr(n.planTratamiento), M + 2, y + 1, planLeftW - 4, hPLAN - 2, { size: 8, pad: 5 });

    const alarmX = M + planLeftW;
    rect(doc, alarmX, y, planRightW, hPLAN);

    const v = mapVigilancia(n.vigilancia);

    const vertLabelW = 14;
    rect(doc, alarmX, y, vertLabelW, hPLAN, C.greyBar);

    // ✅ solo este título, corto (no se desborda)
    doc.save();
    doc.translate(alarmX + 6, y + hPLAN - 6);
    doc.rotate(-90);
    doc.font("Helvetica-Bold").fontSize(6.2).fillColor(C.black);
    doc.text("Vigilancia estrecha", 0, 0, { width: hPLAN - 10, align: "center" });
    doc.restore();

    const items: Array<[string, string]> = [
        ["vigFiebre38", "Fiebre continua > 38 °C"],
        ["vigConvulsiones", "Convulsiones"],
        ["vigAlteracionAlerta", "Alteración del estado de alerta"],
        ["vigSangradoActivo", "Sangrado activo"],
        ["vigDeshidratacion", "Datos de deshidratación"],
        ["vigVomitosFrecuentes", "Vómitos frecuentes"],
        ["vigIrritabilidad", "Irritabilidad"],
        ["vigLlantoInconsolable", "Llanto que no cede"],
        ["vigDificultadRespiratoria", "Dificultad respiratoria"],
        ["vigChoque", "Datos de choque"],
        ["vigDeterioroNeurologico", "Deterioro neurológico"],
    ];

    const rowAH = Math.floor(hPLAN / items.length);
    let ay = y;

    for (let i = 0; i < items.length; i++) {
        const [k, label] = items[i];
        const h = i === items.length - 1 ? y + hPLAN - ay : rowAH;

        rect(doc, alarmX + vertLabelW, ay, planRightW - vertLabelW, h);

        const cx = alarmX + vertLabelW + 4;
        const cy = ay + Math.max(2, (h - 8) / 2);
        drawCheck(doc, cx, cy, 8, !!(v as any)[k]);

        textInBox(doc, label, alarmX + vertLabelW + 16, ay, planRightW - vertLabelW - 18, h, {
            size: 6.9,
            vCenter: true,
            pad: 1,
            ellipsis: false,
        });

        ay += h;
    }

    y += hPLAN;

    // ================== CONTRARREFERENCIA (ANCLADA) ==================
    y = contraTop;

    rect(doc, M, y, W, contraTitleH, C.greyBar);
    textInBox(doc, "CONTRARREFERENCIA", M, y, W, contraTitleH, { bold: true, align: "center", vCenter: true, size: 8.8 });
    y += contraTitleH;

    rect(doc, M, y, W, contraRowH);

    const crYes = !!n.contraRefFollowUp;

    textInBox(doc, "Solicitar seguimiento en su Centro de salud o unidad de 1er nivel:", M + 6, y, 360, contraRowH, {
        vCenter: true,
        size: 8.2,
        pad: 1,
    });

    textInBox(doc, "No", M + 370, y, 14, contraRowH, { vCenter: true, size: 8.2, pad: 0 });
    drawCheck(doc, M + 386, y + 4, 10, !crYes);

    textInBox(doc, "Sí", M + 408, y, 14, contraRowH, { vCenter: true, size: 8.2, pad: 0 });
    drawCheck(doc, M + 424, y + 4, 10, crYes);

    textInBox(doc, "En cuánto tiempo:", M + 446, y, 96, contraRowH, { vCenter: true, size: 8.2, pad: 1 });
    const lineX1 = M + 542;
    const lineX2 = M + W - 10;
    const lineY = y + contraRowH - 6;
    doc.moveTo(lineX1, lineY).lineTo(lineX2, lineY).stroke();
    textInBox(doc, crYes ? safeStr(n.contraRefWhen) : "", lineX1, y, lineX2 - lineX1, contraRowH, { vCenter: true, size: 8.2, pad: 1 });

    // ================== PRONÓSTICO (1 sola fila, pegado) ==================
    y = proTop;

    const proTitleW = 95;
    rect(doc, M, y, proTitleW, proH, C.greyBar);
    rect(doc, M + proTitleW, y, W - proTitleW, proH);
    textInBox(doc, "PRONÓSTICO", M + 6, y, proTitleW - 12, proH, { bold: true, vCenter: true, size: 8.8 });
    textInBox(doc, safeStr(n.pronostico), M + proTitleW + 4, y, W - proTitleW - 8, proH, { vCenter: true, size: 8.2, pad: 2 });

    // ================== FIRMAS (ANCLADAS) ==================
    const sigY = sigTop;

    rect(doc, M, sigY, W, sigH);
    doc.moveTo(M + W / 2, sigY).lineTo(M + W / 2, sigY + sigH).stroke();

    textInBox(doc, "Nombre / Cédula / Firma del médico.", M + 6, sigY + 4, W / 2 - 12, 14, { size: 8 });
    const doctorName = safeStr(n.doctor?.name ?? "");
    const doctorCed = safeStr(n.doctor?.cedula ?? "");
    textInBox(doc, `${doctorName}${doctorCed ? " / " + doctorCed : ""}`, M + 6, sigY + 18, W / 2 - 12, 16, { bold: true, size: 9 });

    textInBox(doc, "Nombre y Firma de responsable del paciente", M + W / 2 + 6, sigY + 4, W / 2 - 12, 14, { size: 8 });
    textInBox(doc, safeStr(p.responsibleName).toUpperCase(), M + W / 2 + 6, sigY + 18, W / 2 - 12, 16, { bold: true, size: 9 });

    const manifesto =
        "Manifiesto haber sido informado(a) a mi satisfacción del diagnóstico y plan de tratamiento, así como también de los riesgos, complicaciones y signos de alarma del padecimiento de mi familiar";

// área inferior derecha: más alta y con autofit por altura
    const manX = M + W / 2 + 6;
    const manY = sigY + 32;
    const manW = W / 2 - 12;
    const manH = sigH - 34;

    textMultiLineAutoFit(doc, manifesto, manX, manY, manW, manH, {
        size: 6.2,
        minSize: 5.4,
        align: "center",
        pad: 1,
        lineGap: 0.6,
    });


    // ================== FOOTER (abajo, sin montar) ==================
    const footerY = footerTop + 2;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(C.black);
    doc.text(
        "Hospital de la Amistad, calle 60 sur S/Nx periférico sur col. San Jose Tecoh 2, Mérida Yuc. Tel: 1-68-70-72.",
        M,
        footerY,
        { width: W, align: "center" }
    );
    doc.font("Helvetica-Bold").fontSize(8).text("HA-HVUP-V05", M, footerY, { width: W, align: "right" });

    doc.end();
}
