// api/src/controllers/reports.ctrl.ts
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { buildAdminExcel } from "../services/reports/adminExcel.service";

export const reportsCtrl = {
    getAdminReport: async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "startDate y endDate son requeridos" });
        }

        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);

        const rows = await prisma.triageRecord.findMany({
            where: { triageAt: { gte: start, lte: end } },
            include: {
                patient: true,
                nurse: { select: { name: true } },
                medicalNote: { include: { doctor: { select: { name: true } } } },
            },
            orderBy: { triageAt: "asc" },
        });

        const { wb, filename } = await buildAdminExcel(rows, startDate, endDate);

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        await wb.xlsx.write(res);
        res.end();
    },
};
