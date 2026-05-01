import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";

const MSG_DESACTIVADO = "Usuario desactivado, comunícate con el área de tecnologías de la información";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

        // Si el usuario fue desactivado después de emitir el token, bloquear acceso.
        // NO se bloquea por mustChangePassword aquí — el frontend lo maneja con un route guard.
        if (!user.active) {
            return res.status(403).json({ error: MSG_DESACTIVADO });
        }

        req.user = user;
        next();
    } catch {
        return res.status(401).json({ error: "Token inválido" });
    }
}

// Firma variadic: requireRole("ADMIN") o requireRole("DOCTOR", "NURSE_TRIAGE")
export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        // ADMIN actúa como superusuario: tiene acceso a cualquier recurso
        if (user?.role === "ADMIN") return next();

        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ error: "Sin permiso" });
        }

        next();
    };
}
