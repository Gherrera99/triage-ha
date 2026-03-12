import { defineStore } from "pinia";
import { http } from "../api/http";

export type TriageColor = "VERDE" | "AMARILLO" | "ROJO";

export type NurseTriageRow = {
    id: number;
    triageAt: string;
    motivoUrgencia: string;
    observaciones?: string | null;

    appearance: TriageColor;
    respiration: TriageColor;
    circulation: TriageColor;
    classification: TriageColor;

    weightKg?: number | null;
    heightCm?: number | null;
    temperatureC?: number | null;
    heartRate?: number | null;
    respiratoryRate?: number | null;
    bloodPressure?: string | null;

    hadPriorCareSamePathology: boolean;
    priorCarePlace?: string | null;
    hasReferral: boolean;
    referralPlace?: string | null;

    closedAt?: string | null;
    closedReason?: string | null;
    refusedPayment?: boolean;
    noShow?: boolean;

    patient: {
        id: number;
        expediente?: string | null;
        fullName: string;
        birthDate?: string | null;
        age?: string | null;
        sex?: string | null;
        mayaHabla: boolean;
        responsibleName?: string | null;
    };

    paidStatus: "PENDING" | "PAID";
    payment?: { paidAt: string } | null;
    medicalNote?: {
        consultationStartedAt: string | null;
        consultationFinishedAt?: string | null;
    } | null;
};

export const useTriageNurseStore = defineStore("triageNurse", {
    state: () => ({
        saving: false,
        loading: false,
        rows: [] as NurseTriageRow[],
        selected: null as NurseTriageRow | null,
    }),
    actions: {
        async createTriage(payload: any) {
            this.saving = true;
            try {
                const { data } = await http.post("/triage", payload);
                await this.fetchRecent();
                return data;
            } finally {
                this.saving = false;
            }
        },

        async fetchRecent() {
            this.loading = true;
            try {
                const { data } = await http.get("/triage/nurse/recent");
                this.rows = data;
            } finally {
                this.loading = false;
            }
        },

        select(id: number) {
            this.selected = this.rows.find((r) => r.id === id) || null;
        },

        async revalue(id: number, payload: any) {
            this.saving = true;
            try {
                const { data } = await http.put(`/triage/${id}/revalue`, payload);
                await this.fetchRecent();
                this.selected = data;
                return data;
            } finally {
                this.saving = false;
            }
        },

        async openOwnReportPdf() {
            const { data } = await http.get("/triage/nurse/report/pdf", {
                responseType: "blob",
            });

            const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        },
    },
});