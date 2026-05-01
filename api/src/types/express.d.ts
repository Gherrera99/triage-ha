// Extensión de tipos de Express para que req.user sea tipado en todos los controllers.
// El middleware requireAuth guarda el objeto completo del User de Prisma en req.user.

import "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id:                 number;
                name:               string;
                email:              string;
                role:               "NURSE_TRIAGE" | "CASHIER" | "DOCTOR" | "ADMIN" | "CONSULTOR";
                cedula?:            string | null;
                passwordHash:       string;
                createdAt:          Date;
                updatedAt:          Date;
                // Campos de seguridad (lote autenticación endurecida)
                active:             boolean;
                failedAttempts:     number;
                lockedAt:           Date | null;
                mustChangePassword: boolean;
                deactivatedReason:  string | null;
            };
        }
    }
}

export {};
