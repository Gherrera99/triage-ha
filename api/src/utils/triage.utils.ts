// Utilidades de dominio compartidas entre controllers de triage.
// Fuente de verdad para funciones duplicadas anteriormente en triage.ctrl.ts y payment.ctrl.ts.

import { TriageColor } from "@prisma/client";

/**
 * Normaliza el número de expediente del paciente.
 * Devuelve null si el valor está vacío o es una variación del texto "SIN EXPEDIENTE".
 */
export function normalizeExpediente(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const up = s.toUpperCase();

    // acepta variaciones/typos del texto "sin expediente"
    if (up === "SIN EXPEDIENTE" || up === "SIN EXPENDIENTE") return null;

    return s;
}

/**
 * Devuelve true si el motivo de urgencia corresponde a una consulta médica.
 */
export function isConsulta(motivo: unknown): boolean {
    const s = String(motivo ?? "").trim().toUpperCase();
    return s === "CONSULTA";
}

/**
 * Umbrales SLA en minutos por color de clasificación.
 * VERDE: 45 min, AMARILLO: 30 min, ROJO: 15 min.
 */
export function slaMinutes(color: TriageColor): number {
    if (color === TriageColor.VERDE) return 45;
    if (color === TriageColor.AMARILLO) return 30;
    if (color === TriageColor.ROJO) return 15;
    return 0;
}
