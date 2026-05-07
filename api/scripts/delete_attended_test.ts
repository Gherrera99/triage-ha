/**
 * Borra todos los pacientes de prueba creados por seed_attended_test.ts.
 * Identifica los registros por fullName que empieza con "[TEST] " o expediente
 * que empieza con "TEST-". Cascada: TriageRecord -> Payment, MedicalNote.
 *
 * Uso (dentro del contenedor api):
 *   npx ts-node scripts/delete_attended_test.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const patients = await prisma.patient.findMany({
        where: {
            OR: [
                { fullName: { startsWith: "[TEST] " } },
                { expediente: { startsWith: "TEST-" } },
            ],
        },
        select: { id: true, fullName: true, expediente: true },
    });

    console.log(`Encontrados ${patients.length} pacientes de prueba para eliminar.`);
    if (!patients.length) return;

    const ids = patients.map((p) => p.id);
    const deleted = await prisma.patient.deleteMany({ where: { id: { in: ids } } });
    console.log(`Eliminados ${deleted.count} pacientes (cascade borra triages, payments, notes).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
