import { defineStore } from "pinia";
import { http } from "../api/http";

export type TriageRecord = {
    id: number;
    triageTimestamp: string;
    classification: "GREEN" | "YELLOW" | "RED";
    motivoUrgencia: string;
    patientFullName: string;
    nurse?: { fullName: string };
    payment?: { paidAt: string };
    medicalNote?: { consultationStartAt: string; doctorId: number };
};

export const useTriageStore = defineStore("triage", {
    state: () => ({
        doctorQueue: [] as TriageRecord[],
        selected: null as TriageRecord | null,
        loading: false,
    }),
    actions: {
        async fetchDoctorQueue() {
            this.loading = true;
            try {
                const { data } = await http.get("/triage/doctor/queue");
                this.doctorQueue = data;
            } finally {
                this.loading = false;
            }
        },

        async selectRecord(id: number) {
            const { data } = await http.get(`/triage/${id}`);
            this.selected = data;
        },

        async startConsultation(id: number) {
            await http.post(`/triage/${id}/start`);
            await this.selectRecord(id);
        },

        async saveMedicalNote(id: number, note: any) {
            await http.put(`/triage/${id}/note`, note);
            await this.selectRecord(id);
        },

        async openPdf(id: number) {
            // abre PDF en nueva pestaña (stream)
            window.open(`${import.meta.env.VITE_API_URL}/api/triage/${id}/pdf`, "_blank");
        },

        // sockets
        onTriageNew(payload: any) {
            // médico: refresco simple (o push inteligente)
            // aquí lo más estable: re-fetch si estás en vista
        },
        onPaymentPaid(payload: any) {
            // lo mismo: re-fetch o update puntual
        },
        onConsultationStarted(payload: any) {},
    },
});
