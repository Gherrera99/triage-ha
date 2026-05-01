import ExcelJS from "exceljs";
import path from "path";
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
function clean(s: string) {
  return stripAccents(String(s)).toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

interface Row {
  n: number;
  rawName: string;
  cedula: string;
  rawRole: string;
  role: string;
  firstName: string;
  paterno: string;
  email: string;
  password: string;
  warnings: string[];
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(__dirname, "..", "listado_usuarios.xlsx"));
  const ws = wb.getWorksheet("Hoja1")!;
  const rows: Row[] = [];

  ws.eachRow((row, n) => {
    if (n < 3) return;
    const v = row.values as any[];
    const num = v[1];
    const name = String(v[2] ?? "").trim();
    const cedula = String(v[3] ?? "").trim();
    const rawRole = String(v[4] ?? "").trim();
    if (!name) return;

    const warnings: string[] = [];
    const cleaned = clean(name);
    const parts = cleaned.split(" ").filter(Boolean);
    if (parts.length < 2) {
      warnings.push("nombre con menos de 2 palabras");
    }

    let firstName = parts[0] ?? "";
    let paterno = parts.length >= 2 ? parts[parts.length - 2] : "";
    // 3-word names: nombre paterno materno → paterno is index 1 (= len-2). OK.
    // 2-word names: nombre paterno → paterno is index 0 (= len-2 = 0). That equals firstName, bad.
    if (parts.length === 2) {
      paterno = parts[1];
      warnings.push("solo 2 palabras: asume nombre+paterno");
    }
    // single trailing letter (e.g., "JOSE FERNANDO NADAL CRUZ N")
    if (parts.length >= 2 && parts[parts.length - 1].length === 1) {
      // drop the trailing letter
      const trimmed = parts.slice(0, -1);
      paterno = trimmed[trimmed.length - 2] ?? trimmed[trimmed.length - 1];
      warnings.push(`letra suelta al final ('${parts[parts.length - 1]}') ignorada`);
    }

    const email = `${firstName}.${paterno}`;
    const password = `${firstName}2026*`;

    const roleKey = stripAccents(rawRole).toLowerCase().trim();
    const role = ROLE_MAP[roleKey];
    if (!role) warnings.push(`rol no mapeado: '${rawRole}'`);

    const ced = (cedula === "NA" || cedula === "NO APLICA" || !cedula) ? "" : cedula;

    rows.push({
      n: Number(num),
      rawName: name,
      cedula: ced,
      rawRole,
      role: role ?? "?",
      firstName,
      paterno,
      email,
      password,
      warnings,
    });
  });

  // detect duplicate emails
  const emailMap = new Map<string, number[]>();
  rows.forEach((r) => {
    const arr = emailMap.get(r.email) ?? [];
    arr.push(r.n);
    emailMap.set(r.email, arr);
  });
  rows.forEach((r) => {
    const arr = emailMap.get(r.email)!;
    if (arr.length > 1) r.warnings.push(`email duplicado con filas: ${arr.filter(x => x !== r.n).join(",")}`);
  });

  // detect duplicate cedulas
  const cedMap = new Map<string, number[]>();
  rows.forEach((r) => {
    if (!r.cedula) return;
    const arr = cedMap.get(r.cedula) ?? [];
    arr.push(r.n);
    cedMap.set(r.cedula, arr);
  });
  rows.forEach((r) => {
    if (!r.cedula) return;
    const arr = cedMap.get(r.cedula)!;
    if (arr.length > 1) r.warnings.push(`cedula duplicada con filas: ${arr.filter(x => x !== r.n).join(",")}`);
  });

  // print
  console.log("\n=== PREVIEW ===");
  console.log(`Total filas: ${rows.length}`);
  const byRole: Record<string, number> = {};
  rows.forEach((r) => { byRole[r.role] = (byRole[r.role] ?? 0) + 1; });
  console.log("Por rol:", byRole);

  console.log("\n=== TODAS LAS FILAS ===");
  rows.forEach((r) => {
    const w = r.warnings.length ? `  [!] ${r.warnings.join(" | ")}` : "";
    console.log(`${String(r.n).padStart(2)} ${r.role.padEnd(13)} ${r.email.padEnd(30)} ${r.password.padEnd(20)} | ${r.rawName}${w}`);
  });

  console.log("\n=== SOLO CONFLICTOS ===");
  rows.filter((r) => r.warnings.length > 0).forEach((r) => {
    console.log(`fila ${r.n}: ${r.rawName} (cedula=${r.cedula}, rol=${r.rawRole}) → ${r.email} :: ${r.warnings.join(" | ")}`);
  });

  // counts of existing data we'd wipe
  const [users, patients, triages, payments, notes] = await Promise.all([
    prisma.user.count(),
    prisma.patient.count(),
    prisma.triageRecord.count(),
    prisma.payment.count(),
    prisma.medicalNote.count(),
  ]);
  console.log("\n=== DATOS ACTUALES EN BD (a borrar) ===");
  console.log({ users, patients, triages, payments, notes });

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
