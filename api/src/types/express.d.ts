// Extensión de tipos de Express para que req.user sea tipado en todos los controllers.
// El middleware requireAuth guarda el objeto completo del User de Prisma en req.user.

import "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                name: string;
                email: string;
                role: "NURSE_TRIAGE" | "CASHIER" | "DOCTOR" | "ADMIN" | "CONSULTOR";
                cedula?: string | null;
                passwordHash: string;
                createdAt: Date;
                updatedAt: Date;
            };
        }
    }
}

export {};
