//web/src/stores/triageNurse.ts
import { defineStore } from "pinia";
import { http } from "../api/http";

export type TriageColor = "VERDE" | "AMARILLO" | "ROJO";

export type NurseTriageRow = {
    id: number;
    triageAt: string;
    motivoUrgencia: string;
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

    patient: {
        id: number;
        expediente?: string | null;
        fullName: string;
        age?: number | null;
        sex?: string | null;
        mayaHabla: boolean;
        responsibleName?: string | null;
    };

    paidStatus: "PENDING" | "PAID";
    payment?: { paidAt: string } | null;
    medicalNote?: {
        consultationStartedAt: string | null;
        consultationFinishedAt?: string | null
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
                // refresco simple
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
    },
});

