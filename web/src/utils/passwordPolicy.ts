// web/src/utils/passwordPolicy.ts
// Réplica frontend de la política de contraseñas del backend.
// Permite feedback en vivo sin esperar al servidor.

export interface PasswordCheck {
    id: string;
    label: string;
    ok: boolean;
}

/**
 * Devuelve los 4 checks de política en orden estable.
 * Usar los `id` como keys en v-for.
 */
export function passwordChecks(pwd: string): PasswordCheck[] {
    return [
        {
            id: "min8",
            label: "Mínimo 8 caracteres",
            ok: pwd.length >= 8,
        },
        {
            id: "upper",
            label: "Al menos una mayúscula",
            ok: /[A-Z]/.test(pwd),
        },
        {
            id: "special",
            label: "Al menos un carácter especial",
            ok: /[^A-Za-z0-9]/.test(pwd),
        },
        {
            id: "noRepeatDigits",
            label: "Sin más de 2 dígitos repetidos seguidos",
            // Falla si hay 3 o más dígitos iguales consecutivos (ej: 111, 444)
            ok: pwd.length === 0 ? true : !/(\d)\1{2,}/.test(pwd),
        },
    ];
}

/**
 * true si todos los checks pasan.
 * Usar para habilitar/deshabilitar el botón de guardar.
 */
export function isPasswordValid(pwd: string): boolean {
    return passwordChecks(pwd).every((c) => c.ok);
}
