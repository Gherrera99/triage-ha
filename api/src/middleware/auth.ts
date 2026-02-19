import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(401).json({ message: "User no existe" });

        (req as any).user = user;
        next();
    } catch {
        return res.status(401).json({ message: "Token inválido" });
    }
}

export function requireRole(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        // ✅ ADMIN como superusuario
        if (user?.role === "ADMIN") return next();

        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: "Sin permiso" });
        }

        next();
    };
}
