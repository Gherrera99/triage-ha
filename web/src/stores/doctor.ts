// web/src/stores/doctor.ts
import { defineStore } from "pinia";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

type Row = any;
type Tab = "WAITING" | "CONSULTING" | "ATTENDED" | "CANCELLED";

const emptyNote = () => ({
    padecimientoActual: "",
    antecedentes: "",
    exploracionFisica: "",
    estudiosParaclinicos: "",
    diagnostico: "",
    planTratamiento: "",

    // ✅ ahora texto libre
    vigilanciaTexto: "",

    // ✅ contrarreferencia real
    contraRefFollowUp: false,
    contraRefWhen: "",

    pronostico: "",
});

// ✅ fallback para registros viejos donde aún existía contrarreferencia string tipo "SI - 48 hrs"
function parseContraLegacy(s: any) {
    const raw = String(s ?? "").trim();
    if (!raw) return { followUp: false, when: "" };
    const up = raw.toUpperCase();
    if (!up.startsWith("SI")) return { followUp: false, when: "" };
    const parts = raw.split("-");
    return { followUp: true, when: (parts[1] ?? "").trim() };
}

export const useDoctorStore = defineStore("doctor", {
    state: () => ({
        tab: "WAITING" as Tab,

        waiting: [] as Row[],
        consulting: [] as Row[],
        attended: [] as Row[],
        cancelled: [] as Row[],

        selected: null as Row | null,
        detail: null as Row | null,

        note: emptyNote(),

        loading: false,

        _rtInited: false,
        _rtOff: [] as Array<() => void>,

        // alertas
        alertQueue: [] as any[],
        _beepTimer: null as any,
        _notifiedIds: [] as number[],
    }),

    actions: {
        initRealtime() {
            if (this._rtInited) return;
            this._rtInited = true;

            const s = getSocket();

            const onStarted = () => {
                this.fetchWaiting();
                this.fetchConsulting();
            };
            const onFinished = () => {
                this.fetchConsulting();
                this.fetchAttended();
            };

            const onPaid = (payload: any) => {
                if (!payload?.id) return;

                // ✅ si no es CONSULTA, no alertar (esos se cierran en caja)
                const motivo = String(payload.motivoUrgencia ?? "").toUpperCase();
                if (motivo !== "CONSULTA") return;

                // ✅ si el backend ya lo cerró por alguna razón, no alertar
                if (payload.closedAt || payload.refusedPayment || payload.noShow) return;

                if (payload.paidStatus !== "PAID") return;

                // ✅ NUEVO: 24h exactas (no “hoy”)
                if (!this.isWithin24h(payload.triageAt)) return;

                if (this.consulting.some((x: any) => x.id === payload.id)) return;
                if (this.attended.some((x: any) => x.id === payload.id)) return;

                if (!this.waiting.some((x: any) => x.id === payload.id)) {
                    this.waiting.unshift(payload);
                    this.sortWaiting();
                }

                this.enqueueAlert(payload);

                this.fetchWaiting().then(() => this.sortWaiting()).catch(() => {});
            };

            const onTriageUpdated = () => {
                if (this.tab === "WAITING") this.fetchWaiting();
                if (this.tab === "CANCELLED") this.fetchCancelled();
            };

            s.on("payment:paid", onPaid);
            s.on("consultation:started", onStarted);
            s.on("consultation:finished", onFinished);
            s.on("triage:updated", onTriageUpdated);

            this._rtOff = [
                () => s.off("payment:paid", onPaid),
                () => s.off("consultation:started", onStarted),
                () => s.off("consultation:finished", onFinished),
                () => s.off("triage:updated", onTriageUpdated),
            ];
        },

        disposeRealtime() {
            for (const off of this._rtOff) off();
            this._rtOff = [];
            this._rtInited = false;
        },

        async fetchWaiting() {
            const { data } = await api.get("/triage/doctor/waiting");
            // ✅ seguridad extra: aplicar 24h en front por si backend aún filtra por día
            this.waiting = (data ?? []).filter((r: any) => this.isWithin24h(r.triageAt));
            this.sortWaiting();
        },
        async fetchConsulting() {
            const { data } = await api.get("/triage/doctor/consulting");
            this.consulting = (data ?? []).filter((r: any) => this.isWithin24h(r.triageAt));
        },
        async fetchAttended() {
            const { data } = await api.get("/triage/doctor/attended");
            this.attended = (data ?? []).filter((r: any) => this.isWithin24h(r.triageAt));
        },
        async fetchCancelled() {
            const { data } = await api.get("/triage/doctor/cancelled");
            this.cancelled = (data ?? []).filter((r: any) => this.isWithin24h(r.triageAt));
        },

        async refreshAll() {
            this.loading = true;
            try {
                await Promise.all([this.fetchWaiting(), this.fetchConsulting(), this.fetchAttended(), this.fetchCancelled()]);
            } finally {
                this.loading = false;
            }
        },

        select(row: Row) {
            this.selected = row;
        },

        async loadDetail(triageId: number) {
            const { data } = await api.get(`/triage/doctor/${triageId}/detail`);
            this.detail = data;

            const n = data?.medicalNote;
            if (n) {
                const legacy = parseContraLegacy(n.contrarreferencia);
                this.note = {
                    ...emptyNote(),
                    padecimientoActual: n.padecimientoActual ?? "",
                    antecedentes: n.antecedentes ?? "",
                    exploracionFisica: n.exploracionFisica ?? "",
                    estudiosParaclinicos: n.estudiosParaclinicos ?? "",
                    diagnostico: n.diagnostico ?? "",
                    planTratamiento: n.planTratamiento ?? "",

                    vigilanciaTexto: n.vigilanciaTexto ?? "",

                    // ✅ usa campos nuevos, si vienen vacíos cae al legacy
                    contraRefFollowUp: n.contraRefFollowUp ?? legacy.followUp,
                    contraRefWhen: n.contraRefWhen ?? legacy.when,

                    pronostico: n.pronostico ?? "",
                };
            } else {
                this.note = emptyNote();
            }

            return data;
        },

        async start(triageId: number) {
            await api.post(`/medical/${triageId}/start`);
            await Promise.all([this.fetchWaiting(), this.fetchConsulting()]);
        },

        async save(triageId: number) {
            const payload = {
                padecimientoActual: this.note.padecimientoActual,
                antecedentes: this.note.antecedentes,
                exploracionFisica: this.note.exploracionFisica,
                estudiosParaclinicos: this.note.estudiosParaclinicos,
                diagnostico: this.note.diagnostico,
                planTratamiento: this.note.planTratamiento,

                // ✅ texto libre
                vigilanciaTexto: this.note.vigilanciaTexto,

                // ✅ contrarreferencia nueva
                contraRefFollowUp: this.note.contraRefFollowUp,
                contraRefWhen: this.note.contraRefWhen,

                pronostico: this.note.pronostico,
            };

            await api.put(`/medical/${triageId}/note`, payload);
            await this.loadDetail(triageId);
        },

        async finish(triageId: number) {
            await api.post(`/medical/${triageId}/finish`);
            await Promise.all([this.fetchConsulting(), this.fetchAttended()]);
            await this.loadDetail(triageId);
        },

        async markNoShow(triageId: number, reason: string) {
            await api.post(`/medical/${triageId}/no-show`, { reason });
            await this.fetchWaiting();
        },

        async openPdf(triageId: number) {
            const { data } = await api.get(`/medical/${triageId}/pdf`, { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },

        async fetchTriageDetail(triageId: number) {
            const { data } = await api.get(`/triage/doctor/${triageId}/detail`);
            return data;
        },

        sortWaiting() {
            const rank: Record<string, number> = { VERDE: 1, AMARILLO: 2, ROJO: 3 };
            this.waiting.sort((a: any, b: any) => {
                const rc = (rank[b.classification] ?? 0) - (rank[a.classification] ?? 0);
                if (rc !== 0) return rc;
                return new Date(a.triageAt).getTime() - new Date(b.triageAt).getTime();
            });
        },

        // ✅ NUEVO: “visible en vistas operativas” por 24h exactas desde triageAt
        isWithin24h(iso: string) {
            const t = new Date(iso).getTime();
            if (!Number.isFinite(t)) return false;
            const diff = Date.now() - t;
            return diff >= 0 && diff < 24 * 60 * 60 * 1000;
        },

        // ====== ALERTAS SONORAS ======
        announcePatient() {
            try {
                if (!window.speechSynthesis) return;
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance("Nuevo Paciente en espera");
                utter.lang = "es-MX";
                utter.rate = 0.9;
                utter.pitch = 1;
                utter.volume = 1;
                window.speechSynthesis.speak(utter);
            } catch {}
        },

        startAlertSound(_classification: string) {
            this.stopAlertSound();
            this.announcePatient();
            this._beepTimer = setInterval(() => this.announcePatient(), 6000);
        },

        stopAlertSound() {
            if (this._beepTimer) {
                clearInterval(this._beepTimer);
                this._beepTimer = null;
            }
            try { window.speechSynthesis.cancel(); } catch {}
        },

        enqueueAlert(row: any) {
            if (this._notifiedIds.includes(row.id)) return;
            this._notifiedIds.push(row.id);
            this.alertQueue.push(row);

            if (this.alertQueue.length === 1) {
                this.startAlertSound(row.classification);
            }
        },

        acknowledgeCurrentAlert() {
            if (!this.alertQueue.length) return;

            this.alertQueue.shift();

            if (!this.alertQueue.length) {
                this.stopAlertSound();
            } else {
                this.startAlertSound(this.alertQueue[0].classification);
            }
        },

        focusAlert(triageId: number) {
            const idx = this.alertQueue.findIndex((a: any) => a.id === triageId);
            if (idx <= 0) return;
            const [item] = this.alertQueue.splice(idx, 1);
            this.alertQueue.unshift(item);
            this.startAlertSound(item.classification);
        },
    },
});