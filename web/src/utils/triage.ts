/**
 * Utilidades compartidas para lógica de triage.
 * Centraliza constantes y funciones de clasificación usadas en múltiples vistas y stores.
 */

export type TriageColor = "VERDE" | "AMARILLO" | "ROJO";

/**
 * Devuelve el umbral SLA en minutos según el color de clasificación de triage.
 * - VERDE:    45 minutos
 * - AMARILLO: 30 minutos
 * - ROJO:     15 minutos
 */
export function slaMinutes(color: TriageColor): number {
  if (color === "VERDE") return 45;
  if (color === "AMARILLO") return 30;
  return 15; // ROJO
}
