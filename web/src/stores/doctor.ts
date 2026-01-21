import { defineStore } from "pinia";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

export const useDoctorStore = defineStore("doctor", {
    state: () => ({
        queue: [] as any[],
        current: null as any | null,
        note: {
            padecimientoActual: "",
            antecedentes: "",
            exploracionFisica: "",
            estudiosParaclinicos: "",
            diagnostico: "",
            diagnosisPrincipal: "",
            planTratamiento: "",
            contrarreferencia: "",
            pronostico: "",
        },
    }),
    actions: {
        async initRealtime() {
            const s = getSocket();
            s.on("triage:new", () => this.fetchQueue());
            s.on("payment:paid", () => this.fetchQueue());
        },
        async fetchQueue() {
            const { data } = await api.get("/triage/doctor-queue");
            this.queue = data;
        },
        select(triage: any) {
            this.current = triage;
        },
        async startConsultation() {
            if (!this.current) return;
            await api.post(`/medical/${this.current.id}/start`);
            await this.fetchQueue();
        },
        async saveNote() {
            if (!this.current) return;
            await api.put(`/medical/${this.current.id}/note`, this.note);
        },
        openPdf() {
            if (!this.current) return;
            window.open(`${import.meta.env.VITE_API_URL}/medical/${this.current.id}/pdf`, "_blank");
        },
    },
});
