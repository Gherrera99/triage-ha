import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";

export async function login(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Credenciales inválidas" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "12h" });

    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, cedula: user.cedula },
    });
}

export async function register(req: Request, res: Response) {
    const { name, email, password, role, cedula } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: { name, email, passwordHash, role, cedula },
        select: { id: true, name: true, email: true, role: true, cedula: true },
    });

    res.status(201).json(user);
}
