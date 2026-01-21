import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    const pass = await bcrypt.hash("Admin123*", 10);

    const users = [
        { email: "admin@hospital.local", name: "Administrador Sistema", role: Role.ADMIN, passwordHash: pass },
        { email: "triage@hospital.local", name: "Enfermero Triage", role: Role.NURSE_TRIAGE, passwordHash: pass },
        { email: "caja@hospital.local", name: "Cajero Turno", role: Role.CASHIER, passwordHash: pass },
        { email: "doctor@hospital.local", name: "Médico Urgencias", role: Role.DOCTOR, passwordHash: pass, cedula: "1234567" }
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: u as any,
        });
    }

    console.log("✅ Seed listo. Password default: Admin123*");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
