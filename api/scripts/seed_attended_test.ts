/**
 * Genera pacientes de prueba ATENDIDOS por un doctor especifico, para probar
 * paginacion / filtros en la pestana "Atendido" del Doctor Dashboard.
 *
 * Marcador: todos los pacientes generados llevan expediente con prefijo "TEST-"
 * y fullName con prefijo "[TEST] " para borrarlos facilmente con el script
 * paralelo `delete_attended_test.ts`.
 *
 * Uso (dentro del contenedor api):
 *   npx ts-node scripts/seed_attended_test.ts --doctor=ana.castro --count=50
 *
 * Defaults: doctor=ana.castro, count=50
 */
import { PrismaClient, TriageColor, PaymentStatus, CloseReason, Sex } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string, def?: string): string | undefined {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    if (!a) return def;
    return a.slice(name.length + 3);
}

const NOMBRES = [
    "Maria", "Jose", "Juan", "Ana", "Pedro", "Lucia", "Carlos", "Sofia",
    "Miguel", "Carmen", "Luis", "Elena", "Roberto", "Patricia", "Diego",
    "Laura", "Fernando", "Gabriela", "Ricardo", "Adriana", "Manuel", "Rosa",
    "Javier", "Teresa", "Antonio", "Beatriz", "Eduardo", "Monica", "Raul", "Daniela",
];
const APELLIDOS = [
    "Hernandez", "Garcia", "Martinez", "Lopez", "Gonzalez", "Perez", "Rodriguez",
    "Sanchez", "Ramirez", "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Reyes",
    "Cruz", "Morales", "Ortiz", "Gutierrez", "Chavez", "Ramos", "Aguilar",
    "Mendoza", "Castillo", "Vargas", "Jimenez", "Romero", "Alvarez", "Ruiz", "Silva",
];
const MOTIVOS = ["CONSULTA"]; // todos consulta porque queremos que entren a "atendido"
const DIAGNOSTICOS = [
    "Faringoamigdalitis aguda",
    "Gastroenteritis aguda",
    "Cefalea tensional",
    "Lumbalgia mecanica",
    "Infeccion de vias urinarias",
    "Hipertension arterial descompensada",
    "Crisis asmatica leve",
    "Dolor abdominal en estudio",
    "Sindrome febril",
    "Bronquitis aguda",
    "Mareo postural",
    "Conjuntivitis bacteriana",
    "Otitis media aguda",
    "Cefalea migranosa",
    "Dispepsia funcional",
];
const COLORS: TriageColor[] = [
    TriageColor.VERDE, TriageColor.VERDE, TriageColor.VERDE,
    TriageColor.AMARILLO, TriageColor.AMARILLO,
    TriageColor.ROJO,
];
const SEXES: Sex[] = [Sex.M, Sex.F];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    const doctorEmail = arg("doctor", "ana.castro")!;
    const count = Number(arg("count", "50"));

    const doctor = await prisma.user.findUnique({ where: { email: doctorEmail } });
    if (!doctor || doctor.role !== "DOCTOR") {
        throw new Error(`Doctor con email '${doctorEmail}' no existe o no tiene rol DOCTOR.`);
    }

    const nurse = await prisma.user.findFirst({ where: { role: "NURSE_TRIAGE" } });
    if (!nurse) throw new Error("No hay ningun usuario NURSE_TRIAGE en la BD.");

    const cashier = await prisma.user.findFirst({ where: { role: "CASHIER" } });
    if (!cashier) throw new Error("No hay ningun usuario CASHIER en la BD.");

    console.log(`Generando ${count} pacientes ATENDIDOS para doctor ${doctor.name} (${doctor.email})`);
    console.log(`  nurse: ${nurse.name}  cashier: ${cashier.name}`);

    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const nombre = pick(NOMBRES);
        const apellido1 = pick(APELLIDOS);
        const apellido2 = pick(APELLIDOS);
        const fullName = `[TEST] ${nombre.toUpperCase()} ${apellido1.toUpperCase()} ${apellido2.toUpperCase()}`;
        const expediente = `TEST-${String(i + 1).padStart(4, "0")}-${randInt(1000, 9999)}`;

        // Distribuir triageAt en los ultimos 30 dias
        const daysAgo = Math.floor(i * 30 / Math.max(1, count - 1)); // 0..30 dias atras
        const hourOffset = randInt(0, 23);
        const minuteOffset = randInt(0, 59);
        const triageAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
        triageAt.setHours(hourOffset, minuteOffset, 0, 0);

        // Atencion: 30-90 min despues del triage
        const consultStart = new Date(triageAt.getTime() + randInt(15, 45) * 60 * 1000);
        const consultEnd = new Date(consultStart.getTime() + randInt(15, 60) * 60 * 1000);

        const sex = pick(SEXES);
        const ageYears = randInt(1, 89);
        const color = pick(COLORS);
        const diagnostico = pick(DIAGNOSTICOS);

        await prisma.$transaction(async (tx) => {
            const patient = await tx.patient.create({
                data: {
                    expediente,
                    fullName,
                    age: `${ageYears} anos`,
                    sex,
                },
            });

            const triage = await tx.triageRecord.create({
                data: {
                    patientId: patient.id,
                    nurseId: nurse.id,
                    motivoUrgencia: pick(MOTIVOS),
                    triageAt,
                    appearance: color,
                    respiration: color,
                    circulation: color,
                    classification: color,
                    weightKg: 50 + Math.random() * 40,
                    heightCm: 150 + Math.random() * 30,
                    temperatureC: 36 + Math.random() * 2,
                    heartRate: randInt(60, 110),
                    respiratoryRate: randInt(12, 22),
                    bloodPressure: `${randInt(100, 140)}/${randInt(60, 90)}`,
                    paidStatus: PaymentStatus.PAID,
                    closedAt: consultEnd,
                    closedReason: CloseReason.DOCTOR_FINISHED,
                    createdAt: triageAt,
                },
            });

            await tx.payment.create({
                data: {
                    triageId: triage.id,
                    cashierId: cashier.id,
                    status: PaymentStatus.PAID,
                    paidAt: new Date(triageAt.getTime() + randInt(5, 20) * 60 * 1000),
                },
            });

            await tx.medicalNote.create({
                data: {
                    triageId: triage.id,
                    doctorId: doctor.id,
                    consultationStartedAt: consultStart,
                    consultationFinishedAt: consultEnd,
                    padecimientoActual: "Paciente acude por sintomatologia descrita en motivo. (DATO DE PRUEBA)",
                    antecedentes: "Sin antecedentes relevantes. (DATO DE PRUEBA)",
                    exploracionFisica: "Paciente consciente, orientado, signos vitales estables. (DATO DE PRUEBA)",
                    estudiosParaclinicos: "No se solicitan en esta consulta. (DATO DE PRUEBA)",
                    diagnostico,
                    planTratamiento: "Manejo sintomatico, hidratacion y reposo. (DATO DE PRUEBA)",
                    vigilanciaTexto: "Vigilar evolucion en 24-48 horas. (DATO DE PRUEBA)",
                    contraRefFollowUp: Math.random() > 0.7,
                    contraRefWhen: Math.random() > 0.7 ? "48 hrs" : null,
                    contrarreferencia: "",
                    pronostico: "Bueno para la vida y la funcion. (DATO DE PRUEBA)",
                },
            });
        });

        if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${count}`);
    }

    console.log("Listo. Pacientes de prueba generados.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
