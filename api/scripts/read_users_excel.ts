import ExcelJS from "exceljs";
import path from "path";

async function main() {
  const wb = new ExcelJS.Workbook();
  const file = path.resolve(__dirname, "..", "listado_usuarios.xlsx");
  await wb.xlsx.readFile(file);
  wb.eachSheet((ws) => {
    console.log(`\n=== Sheet: ${ws.name} (rows=${ws.rowCount}, cols=${ws.columnCount}) ===`);
    ws.eachRow((row, n) => {
      const vals = row.values as any[];
      console.log(n, JSON.stringify(vals));
    });
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
