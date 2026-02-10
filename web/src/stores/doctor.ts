// web/src/stores/doctor.ts
import { defineStore } from "pinia";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

type TriageRow = any;

const emptyNote = () => ({
    padecimientoActual: "",
    antecedentes: "",
    exploracionFisica: "",
    estudiosParaclinicos: "",
    diagnostico: "",
    diagnosisPrincipal: "",
    planTratamiento: "",
    contrarreferencia: "",
    pronostico: "",
});

export const useDoctorStore = defineStore("doctor", {
    state: () => ({
        queue: [] as TriageRow[],
        current: null as TriageRow | null,
        note: emptyNote(),

        // ✅ evita listeners duplicados si navegas
        _rtInited: false,
        _rtOff: [] as Array<() => void>,
        loading: false,
    }),
    actions: {
        initRealtime() {
            if (this._rtInited) return;
            this._rtInited = true;

            const s = getSocket();

            const refetch = () => this.fetchQueue();

            s.on("triage:new", refetch);
            s.on("triage:updated", refetch);   // ✅ revaloración + pago emiten esto
            s.on("payment:paid", refetch);     // opcional pero útil
            s.on("triage:updated", () => this.fetchQueue());
            s.on("consultation:started", () => this.fetchQueue());
            s.on("consultation:finished", () => this.fetchQueue());

            this._rtOff = [
                () => s.off("triage:new", refetch),
                () => s.off("triage:updated", refetch),
                () => s.off("payment:paid", refetch),
            ];
        },

        disposeRealtime() {
            for (const off of this._rtOff) off();
            this._rtOff = [];
            this._rtInited = false;
        },

        async fetchQueue() {
            this.loading = true;
            try {
                // ✅ usa tu endpoint nuevo (waiting)
                const { data } = await api.get("/triage/doctor/waiting");
                this.queue = data;

                // si ya tenías un seleccionado, intenta mantenerlo
                if (this.current) {
                    const same = this.queue.find((x: any) => x.id === this.current?.id);
                    if (same) this.select(same);
                }
            } finally {
                this.loading = false;
            }
        },

        select(triage: any) {
            this.current = triage;

            // ✅ si ya existe nota médica en el row, precárgala para editar
            const n = triage?.medicalNote;
            if (n) {
                this.note = {
                    padecimientoActual: n.padecimientoActual ?? "",
                    antecedentes: n.antecedentes ?? "",
                    exploracionFisica: n.exploracionFisica ?? "",
                    estudiosParaclinicos: n.estudiosParaclinicos ?? "",
                    diagnostico: n.diagnostico ?? "",
                    diagnosisPrincipal: n.diagnosisPrincipal ?? "",
                    planTratamiento: n.planTratamiento ?? "",
                    contrarreferencia: n.contrarreferencia ?? "",
                    pronostico: n.pronostico ?? "",
                };
            } else {
                this.note = emptyNote();
            }
        },

        async startConsultation() {
            if (!this.current) return;

            await api.post(`/medical/${this.current.id}/start`);

            // refresca lista para que se refleje consulta iniciada
            await this.fetchQueue();
        },

        async saveNote() {
            if (!this.current) return;
            await api.put(`/medical/${this.current.id}/note`, this.note);
            // opcional: refrescar para que el reporte/estado se vea actualizado
            await this.fetchQueue();
        },

        async openPdf() {
            if (!this.current) return;

            // ✅ Importante: window.open NO manda Bearer token.
            // Descargamos como blob con axios (que sí lleva Authorization) y abrimos el PDF.
            const { data } = await api.get(`/medical/${this.current.id}/pdf`, {
                responseType: "blob",
            });

            const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
            window.open(url, "_blank");
            // cleanup
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },

        async finishConsultation() {
            if (!this.current) return;
            await api.post(`/medical/${this.current.id}/finish`);
            await this.fetchQueue();
        }
    },
});
