import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma";

export async function listUsers(req: Request, res: Response) {
    const users = await prisma.user.findMany({
        orderBy: { id: "asc" },
        select: { id: true, email: true, name: true, role: true, cedula: true, createdAt: true },
    });
    return res.json(users);
}

export async function createUser(req: Request, res: Response) {
    const { email, name, password, role, cedula } = req.body as {
        email?: string; name?: string; password?: string; role?: string; cedula?: string | null;
    };

    if (!email || !name || !password || !role) {
        return res.status(400).json({ message: "email, name, password y role son requeridos" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: { email, name, role: role as any, passwordHash, cedula: cedula || null },
        select: { id: true, email: true, name: true, role: true, cedula: true },
    });

    return res.status(201).json(user);
}
