// api/src/controllers/users.ctrl.ts
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { validatePasswordPolicy, generateTempPassword } from "../utils/passwordPolicy";
import { emitToUser } from "../socket";

// Selección de campos expuesta en listados y respuestas de usuario
const USER_SELECT = {
    id:                 true,
    name:               true,
    email:              true,
    role:               true,
    cedula:             true,
    createdAt:          true,
    updatedAt:          true,
    // Campos de seguridad
    active:             true,
    mustChangePassword: true,
    failedAttempts:     true,
    lockedAt:           true,
    deactivatedReason:  true,
} as const;

export const usersCtrl = {
    // GET /users?q=&role=
    list: async (req: Request, res: Response) => {
        const q    = String(req.query.q    ?? "").trim();
        const role = String(req.query.role ?? "").trim();

        const where: Record<string, unknown> = {};
        if (role) where.role = role;

        if (q) {
            where.OR = [
                { name:  { contains: q } },
                { email: { contains: q } },
            ];
        }

        const rows = await prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select:  USER_SELECT,
            take:    500,
        });

        res.json(rows);
    },

    // POST /users
    create: async (req: Request, res: Response) => {
        const { name, email, role, cedula, password } = req.body ?? {};

        if (!name || !email || !role || !password) {
            return res.status(400).json({ error: "name, email, role y password son requeridos." });
        }

        // Validar política de contraseña
        const policy = validatePasswordPolicy(String(password));
        if (!policy.ok) {
            return res.status(400).json({ error: "La contraseña no cumple la política de seguridad.", details: policy.errors });
        }

        const exists = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
        if (exists) return res.status(409).json({ error: "Ese usuario (email) ya existe." });

        const passwordHash = await bcrypt.hash(String(password), 10);

        const created = await prisma.user.create({
            data: {
                name:               String(name).trim(),
                email:              String(email).trim().toLowerCase(),
                role,
                cedula:             cedula ? String(cedula).trim() : null,
                passwordHash,
                // Los usuarios creados por admin deben cambiar su contraseña en el primer acceso
                mustChangePassword: true,
            },
            select: USER_SELECT,
        });

        res.status(201).json(created);
    },

    // PUT /users/:id
    update: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        const { name, email, role, cedula, password } = req.body ?? {};

        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido." });

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Usuario no encontrado." });

        const newEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;

        if (newEmail && newEmail !== existing.email) {
            const dup = await prisma.user.findUnique({ where: { email: newEmail } });
            if (dup) return res.status(409).json({ error: "Ese usuario (email) ya existe." });
        }

        // Si llega password, validar política antes de hashear
        let newPasswordHash: string | undefined;
        if (password) {
            const policy = validatePasswordPolicy(String(password));
            if (!policy.ok) {
                return res.status(400).json({ error: "La contraseña no cumple la política de seguridad.", details: policy.errors });
            }
            newPasswordHash = await bcrypt.hash(String(password), 10);
        }

        const data: {
            name?:         string;
            email?:        string;
            role?:         Role;
            cedula?:       string | null;
            passwordHash?: string;
        } = {
            name:   name  !== undefined ? String(name).trim()  : undefined,
            email:  newEmail,
            role:   role  !== undefined ? (role as Role)          : undefined,
            cedula: cedula !== undefined ? (cedula ? String(cedula).trim() : null) : undefined,
        };

        if (newPasswordHash) {
            data.passwordHash = newPasswordHash;
        }

        const updated = await prisma.user.update({
            where:  { id },
            data,
            select: USER_SELECT,
        });

        res.json(updated);
    },

    // DELETE /users/:id
    remove: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        const me = req.user;

        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido." });
        if (me?.id === id) return res.status(400).json({ error: "No puedes eliminar tu propio usuario." });

        try {
            await prisma.user.delete({ where: { id } });
            res.json({ ok: true });
        } catch {
            return res.status(409).json({
                error: "No se puede eliminar: el usuario tiene registros relacionados (triage/notas/pagos). Desactívalo en su lugar.",
            });
        }
    },

    // PATCH /users/:id/deactivate
    deactivate: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido." });

        const { reason } = req.body ?? {};

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Usuario no encontrado." });

        if (!existing.active) {
            return res.status(409).json({ error: "El usuario ya se encuentra desactivado." });
        }

        await prisma.user.update({
            where: { id },
            data: {
                active:            false,
                deactivatedReason: reason ? String(reason).trim() : "MANUAL",
            },
        });

        // Forzar logout en tiempo real — el frontend escucha auth:disabled y expulsa al usuario
        emitToUser(id, "auth:disabled", { reason: "Cuenta desactivada por un administrador." });

        res.json({ ok: true });
    },

    // PATCH /users/:id/activate
    activate: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido." });

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Usuario no encontrado." });

        if (existing.active) {
            return res.status(409).json({ error: "El usuario ya se encuentra activo." });
        }

        await prisma.user.update({
            where: { id },
            data: {
                active:            true,
                failedAttempts:    0,
                lockedAt:          null,
                deactivatedReason: null,
            },
        });

        res.json({ ok: true });
    },

    // POST /users/:id/reset-password
    resetPassword: async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) return res.status(400).json({ error: "id inválido." });

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: "Usuario no encontrado." });

        const tempPassword = generateTempPassword();
        const tempHash     = await bcrypt.hash(tempPassword, 10);

        // El reset también reactiva la cuenta y limpia el bloqueo
        await prisma.user.update({
            where: { id },
            data: {
                passwordHash:       tempHash,
                mustChangePassword: true,
                failedAttempts:     0,
                active:             true,
                lockedAt:           null,
                deactivatedReason:  null,
            },
        });

        // Forzar logout de la sesión activa para que el usuario tenga que ingresar con la nueva temp
        emitToUser(id, "auth:disabled", { reason: "Contraseña restablecida por un administrador." });

        // Devolver la contraseña temporal una sola vez — el admin la muestra en un modal
        res.json({ tempPassword });
    },
};
