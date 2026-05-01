import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { validatePasswordPolicy } from "../utils/passwordPolicy";

const MAX_FAILED_ATTEMPTS = 5;

const MSG_NO_EXISTE    = "El usuario ingresado no existe";
const MSG_DESACTIVADO  = "Usuario desactivado, comunícate con el área de tecnologías de la información";
const MSG_PWD_INCORRECTA = "La contraseña ingresada es incorrecta";

export async function login(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };

    // 1. El usuario debe existir
    const user = await prisma.user.findUnique({ where: { email: String(email ?? "").trim().toLowerCase() } });
    if (!user) {
        return res.status(404).json({ error: MSG_NO_EXISTE });
    }

    // 2. Verificar si ya está desactivado antes de consumir un intento
    if (!user.active) {
        return res.status(403).json({ error: MSG_DESACTIVADO });
    }

    // 3. Verificar contraseña
    const passwordOk = await bcrypt.compare(String(password ?? ""), user.passwordHash);

    if (!passwordOk) {
        const newAttempts = user.failedAttempts + 1;

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            // Bloquear al usuario en la misma transacción
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedAttempts:    newAttempts,
                    active:            false,
                    lockedAt:          new Date(),
                    deactivatedReason: "INTENTOS_FALLIDOS",
                },
            });
            // Devolver mensaje de desactivado (no de contraseña incorrecta) para que el usuario
            // entienda que su cuenta fue bloqueada y debe contactar a TI.
            return res.status(403).json({ error: MSG_DESACTIVADO });
        }

        // Aún no llega a 5 — incrementar contador
        await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: newAttempts },
        });

        return res.status(401).json({
            error: MSG_PWD_INCORRECTA,
            attemptsRemaining: MAX_FAILED_ATTEMPTS - newAttempts,
            maxAttempts: MAX_FAILED_ATTEMPTS,
        });
    }

    // 4. Login exitoso — resetear contador de intentos en transacción atómica
    await prisma.user.update({
        where: { id: user.id },
        data: {
            failedAttempts: 0,
            lockedAt:       null,
        },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "12h" });

    return res.json({
        token,
        user: {
            id:                 user.id,
            name:               user.name,
            email:              user.email,
            role:               user.role,
            cedula:             user.cedula,
            mustChangePassword: user.mustChangePassword,
        },
    });
}

export async function changePassword(req: Request, res: Response) {
    const userId = req.user!.id;
    const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
    };

    // Validaciones básicas de presencia
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "currentPassword, newPassword y confirmPassword son requeridos." });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "newPassword y confirmPassword no coinciden." });
    }

    if (newPassword === currentPassword) {
        return res.status(400).json({ error: "La nueva contraseña debe ser diferente a la actual." });
    }

    // Validar política
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.ok) {
        return res.status(400).json({ error: "La contraseña no cumple la política de seguridad.", details: policy.errors });
    }

    // Obtener hash actual desde BD (req.user puede tener datos del token, que es viejo)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) {
        return res.status(404).json({ error: MSG_NO_EXISTE });
    }

    const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) {
        return res.status(400).json({ error: "La contraseña actual es incorrecta." });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: {
            passwordHash:      newHash,
            mustChangePassword: false,
        },
    });

    return res.json({ ok: true });
}
