import ExcelJS from "exceljs";
import path from "path";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma";

const ROLE_MAP: Record<string, string> = {
  "medica": "DOCTOR",
  "medico": "DOCTOR",
  "consultor": "CONSULTOR",
  "enfermero": "NURSE_TRIAGE",
  "enfermera": "NURSE_TRIAGE",
  "administrador": "ADMIN",
  "admin": "ADMIN",
  "cajero": "CASHIER",
  "cajera": "CASHIER",
};

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N");
}
function cleanLower(s: string) {
  return stripAccents(String(s)).toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}
function normalizeName(s: string) {
  // collapse repeated whitespace and uppercase
  return String(s).replace(/\s+/g, " ").trim().toUpperCase();
}

interface Plan {
  rowN: number;
  name: string;
  email: string;
  password: string;
  role: string;
  cedula: string | null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(__dirname, "..", "listado_usuarios.xlsx"));
  const ws = wb.getWorksheet("Hoja1")!;
  const plans: Plan[] = [];

  // rows to skip per user decision
  // sheet row numbers (eachRow n), no las del col "No."
  const SKIP_ROWS = new Set<number>([28]); // No.26 jose.nadal CONSULTOR (queda solo No.48 ENFERMERO en sheet row 50)
  const NO_CEDULA_ROWS = new Set<number>([18, 20]); // No.16 GEOVANNY y No.18 MARIANA — cedula 13089219 duplicada

  ws.eachRow((row, n) => {
    if (n < 3) return;
    if (SKIP_ROWS.has(n)) return;
    const v = row.values as any[];
    const name = String(v[2] ?? "").trim();
    const cedulaRaw = String(v[3] ?? "").trim();
    const rawRole = String(v[4] ?? "").trim();
    if (!name) return;

    const cleaned = cleanLower(name);
    const parts = cleaned.split(" ").filter(Boolean);
    let firstName = parts[0] ?? "";
    let paterno = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (parts.length === 2) paterno = parts[1];
    if (parts.length >= 2 && parts[parts.length - 1].length === 1) {
      const trimmed = parts.slice(0, -1);
      paterno = trimmed[trimmed.length - 2] ?? trimmed[trimmed.length - 1];
    }

    const email = `${firstName}.${paterno}`;
    const password = `${firstName}2026*`;

    const roleKey = stripAccents(rawRole).toLowerCase().trim();
    const role = ROLE_MAP[roleKey];
    if (!role) throw new Error(`Rol no mapeado en fila ${n}: '${rawRole}'`);

    let cedula: string | null = null;
    if (!NO_CEDULA_ROWS.has(n)) {
      if (cedulaRaw && cedulaRaw !== "NA" && cedulaRaw.toUpperCase() !== "NO APLICA") {
        cedula = cedulaRaw;
      }
    }

    plans.push({
      rowN: n,
      name: normalizeName(name),
      email,
      password,
      role,
      cedula,
    });
  });

  // sanity: detect duplicate emails
  const emailSet = new Map<string, number[]>();
  plans.forEach((p) => {
    const arr = emailSet.get(p.email) ?? [];
    arr.push(p.rowN);
    emailSet.set(p.email, arr);
  });
  const dupes = [...emailSet.entries()].filter(([, v]) => v.length > 1);
  if (dupes.length) {
    console.error("Emails duplicados detectados:", dupes);
    throw new Error("Emails duplicados — abortando");
  }

  console.log(`Plan: ${plans.length} usuarios a crear`);

  // wipe test data in order respecting FKs
  console.log("\n--- Borrando datos de prueba ---");
  const delNotes = await prisma.medicalNote.deleteMany({});
  const delPayments = await prisma.payment.deleteMany({});
  const delTriages = await prisma.triageRecord.deleteMany({});
  const delPatients = await prisma.patient.deleteMany({});
  const delUsers = await prisma.user.deleteMany({});
  console.log({
    medicalNotes: delNotes.count,
    payments: delPayments.count,
    triages: delTriages.count,
    patients: delPatients.count,
    users: delUsers.count,
  });

  // insert
  console.log("\n--- Creando usuarios ---");
  let created = 0;
  for (const p of plans) {
    const passwordHash = await bcrypt.hash(p.password, 10);
    await prisma.user.create({
      data: {
        name: p.name,
        email: p.email,
        passwordHash,
        role: p.role as any,
        cedula: p.cedula,
        mustChangePassword: true,
      },
    });
    created++;
  }
  console.log(`Creados: ${created}`);

  const byRole = await prisma.user.groupBy({ by: ["role"], _count: true });
  console.log("Distribución final:", byRole);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
