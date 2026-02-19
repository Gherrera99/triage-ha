// api/src/controllers/users.ctrl.ts
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import * as bcrypt from "bcrypt"; // ✅ aquí

export const usersCtrl = {
    // GET /users?q=&role=
    list: async (req: Request, res: Response) => {
        const q = String(req.query.q ?? "").trim();
        const role = String(req.query.role ?? "").trim();

        const where: any = {};
        if (role) where.role = role;

        if (q) {
            where.OR = [
                // Nota: en MySQL normalmente ya es case-insensitive por collation.
                // Si te llega a fallar "mode: insensitive", bórralo.
                { name: { contains: q /* , mode: "insensitive" */ } },
                { email: { contains: q /* , mode: "insensitive" */ } },
            ];
        }

        const rows = await prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                cedula: true,
                createdAt: true,
                updatedAt: true,
            },
            take: 500,
        });

        res.json(rows);
    },

    // POST /users
    create: async (req: Request, res: Response) => {
        const { name, email, role, cedula, password } = req.body ?? {};

        if (!name || !email || !role || !password) {
            return res.status(400).json({ error: "name, email, role y password son requeridos" });
        }

        const exists = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
        if (exists) return res.status(409).json({ error: "Ese usuario (email) ya existe" });

        const passwordHash = await bcrypt.hash(String(password), 10);

        const created = await prisma.user.create({
            data: {
                name: String(name).trim(),
                email: String(email).trim().toLowerCase(),
                role,
                cedula: cedula ? String(cedula).trim() : null,
                passwordHash,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                cedula: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.status(201).json(created);
    },

    // PUT /users/:id
    update: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        const { name, email, role, cedula, password } = req.body ?? {};

        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido" });

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Usuario no existe" });

        const newEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;

        if (newEmail && newEmail !== existing.email) {
            const dup = await prisma.user.findUnique({ where: { email: newEmail } });
            if (dup) return res.status(409).json({ error: "Ese usuario (email) ya existe" });
        }

        const data: any = {
            name: name !== undefined ? String(name).trim() : undefined,
            email: newEmail,
            role: role !== undefined ? role : undefined,
            cedula: cedula !== undefined ? (cedula ? String(cedula).trim() : null) : undefined,
        };

        if (password) {
            data.passwordHash = await bcrypt.hash(String(password), 10);
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                cedula: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.json(updated);
    },

    // DELETE /users/:id
    remove: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        const me = (req as any).user;

        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido" });
        if (me?.id === id) return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });

        try {
            await prisma.user.delete({ where: { id } });
            res.json({ ok: true });
        } catch {
            return res.status(409).json({
                error: "No se puede eliminar: el usuario tiene registros relacionados (triage/notas/pagos). Cambia el rol o deja de usarlo.",
            });
        }
    },
};
