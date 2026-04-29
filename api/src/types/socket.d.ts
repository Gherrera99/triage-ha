// Extensión del tipo Socket de socket.io para que socket.user sea tipado.
// El middleware de autenticación en socket.ts asigna solo los campos mínimos necesarios.

import "socket.io";

declare module "socket.io" {
    interface Socket {
        user?: {
            id: number;
            role: "NURSE_TRIAGE" | "CASHIER" | "DOCTOR" | "ADMIN" | "CONSULTOR";
            name: string;
        };
    }
}
