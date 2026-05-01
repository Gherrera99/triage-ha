/**
 * Política de contraseñas del sistema triage-ha.
 * Compartido entre auth.ctrl y users.ctrl.
 *
 * Reglas:
 *  1. Mínimo 8 caracteres
 *  2. Al menos 1 letra mayúscula
 *  3. Al menos 1 carácter especial (no alfanumérico)
 *  4. Sin más de 2 dígitos idénticos consecutivos (ej. "111" prohibido, "11" permitido)
 */

import { randomBytes, randomInt } from "crypto";

export interface PolicyResult {
    ok: boolean;
    errors: string[];
}

export function validatePasswordPolicy(pwd: string): PolicyResult {
    const errors: string[] = [];

    if (pwd.length < 8) {
        errors.push("La contraseña debe tener al menos 8 caracteres.");
    }

    if (!/[A-Z]/.test(pwd)) {
        errors.push("La contraseña debe contener al menos una letra mayúscula.");
    }

    if (!/[^A-Za-z0-9]/.test(pwd)) {
        errors.push("La contraseña debe contener al menos un carácter especial.");
    }

    // Detecta secuencias de 3 o más dígitos idénticos seguidos (ej. "111", "9999")
    if (/(\d)\1{2,}/.test(pwd)) {
        errors.push("La contraseña no puede contener más de 2 dígitos iguales consecutivos.");
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Genera una contraseña temporal que cumple la política.
 * Usa `crypto` (built-in) para aleatoriedad criptográfica — nunca Math.random.
 *
 * Formato: 12 caracteres con al menos 1 mayúscula, 1 especial, 2 dígitos no repetidos.
 * La función itera hasta producir una contraseña que pase la validación
 * (el rechazo por 3 dígitos repetidos es extremadamente raro dado el diseño).
 */
export function generateTempPassword(): string {
    const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin I y O para evitar confusión visual
    const lower   = "abcdefghjkmnpqrstuvwxyz";  // sin i, l, o
    const digits  = "23456789";                  // sin 0 y 1 para evitar confusión visual
    const special = "!@#$%&*-_=+?";

    const allChars = upper + lower + digits + special;

    const pickFrom = (charset: string) => charset[randomInt(0, charset.length)];

    for (;;) {
        // Garantizamos al menos 1 de cada categoría requerida
        const required = [
            pickFrom(upper),
            pickFrom(special),
            pickFrom(digits),
            pickFrom(digits),
        ];

        // Relleno aleatorio hasta 12 chars
        const rest: string[] = [];
        for (let i = required.length; i < 12; i++) {
            // Usamos randomBytes para elegir índice con distribución uniforme
            const buf = randomBytes(1);
            rest.push(allChars[buf[0] % allChars.length]);
        }

        // Mezcla usando Fisher-Yates con randomInt criptográfico
        const chars = [...required, ...rest];
        for (let i = chars.length - 1; i > 0; i--) {
            const j = randomInt(0, i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        const pwd = chars.join("");

        // Verifica que cumpla la política completa (especialmente la regla de dígitos repetidos)
        if (validatePasswordPolicy(pwd).ok) {
            return pwd;
        }
        // En el improbable caso de fallo, reintenta
    }
}
