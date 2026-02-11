import { defineStore } from "pinia";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

type Row = any;
type Tab = "WAITING" | "CONSULTING" | "ATTENDED";

const emptyNote = () => ({
    padecimientoActual: "",
    antecedentes: "",
    exploracionFisica: "",
    estudiosParaclinicos: "",
    diagnostico: "",
    planTratamiento: "",
    vigilancia: null as string | null,         // guardaremos JSON string
    contrarreferencia: "",                     // "NO" o "SI - <tiempo>"
    pronostico: "",

    // helpers UI (no van directo al backend)
    contraRefFollowUp: false,
    contraRefWhen: "",
    vig: {
        fiebre38: false,
        convulsiones: false,
        alteracionAlerta: false,
        sangradoActivo: false,
        deshidratacion: false,
        vomitosFrecuentes: false,
        irritabilidad: false,
        llantoInconsolable: false,
        dificultadRespiratoria: false,
        choque: false,
        deterioroNeurologico: false,
    },
});

function packVigilancia(vig: any) {
    return JSON.stringify(vig ?? {});
}
function unpackVigilancia(s: any) {
    try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function packContra(followUp: boolean, when: string) {
    if (!followUp) return "NO";
    const w = (when ?? "").trim();
    return w ? `SI - ${w}` : "SI";
}
function unpackContra(s: string) {
    const t = (s ?? "").toUpperCase();
    if (!t) return { followUp: false, when: "" };
    if (t.startsWith("SI")) {
        const parts = (s ?? "").split("-");
        return { followUp: true, when: (parts[1] ?? "").trim() };
    }
    return { followUp: false, when: "" };
}

export const useDoctorStore = defineStore("doctor", {
    state: () => ({
        tab: "WAITING" as Tab,

        waiting: [] as Row[],
        consulting: [] as Row[],
        attended: [] as Row[],

        selected: null as Row | null,
        detail: null as Row | null,

        note: emptyNote(),

        loading: false,

        _rtInited: false,
        _rtOff: [] as Array<() => void>,

        alertQueue: [] as any[],
        _audioUnlocked: false,
        _audioCtx: null as AudioContext | null,
        _beepTimer: null as any,
        _notifiedIds: [] as number[],

    }),

    actions: {
        initRealtime() {
            if (this._rtInited) return;
            this._rtInited = true;

            const s = getSocket();

            const onPaid = () => this.fetchWaiting();
            const onStarted = () => { this.fetchWaiting(); this.fetchConsulting(); };
            const onFinished = () => { this.fetchConsulting(); this.fetchAttended(); };

            const onPaid = (payload: any) => {
                // payload normalmente trae triageRecord con patient/nurse/payment
                // Solo alertar si entra a waiting (pagado y sin nota) y es del día
                if (!payload?.id) return;
                if (payload.paidStatus !== "PAID") return;
                if (!this.isToday(payload.triageAt)) return;

                // Si ya está en consulting/attended, ignorar
                if (this.consulting.some((x: any) => x.id === payload.id)) return;
                if (this.attended.some((x: any) => x.id === payload.id)) return;

                // Meterlo a waiting si no existe
                if (!this.waiting.some((x: any) => x.id === payload.id)) {
                    this.waiting.unshift(payload);
                    this.sortWaiting();
                }

                this.enqueueAlert(payload);

                // opcional: sincroniza con backend para evitar desfaces
                this.fetchWaiting().then(() => this.sortWaiting()).catch(() => {});
            };

            s.on("payment:paid", onPaid);
            this._rtOff.push(() => s.off("payment:paid", onPaid));

            s.on("consultation:started", onStarted);
            s.on("consultation:finished", onFinished);

            // por si revaloran antes de pagar (o ajustes)
            s.on("triage:updated", () => {
                if (this.tab === "WAITING") this.fetchWaiting();
            });

            this._rtOff = [
                () => s.off("payment:paid", onPaid),
                () => s.off("consultation:started", onStarted),
                () => s.off("consultation:finished", onFinished),
                () => s.off("triage:updated", onPaid),
            ];
        },

        disposeRealtime() {
            for (const off of this._rtOff) off();
            this._rtOff = [];
            this._rtInited = false;
        },

        async fetchWaiting() {
            const { data } = await api.get("/triage/doctor/waiting");
            this.waiting = data;
        },
        async fetchConsulting() {
            const { data } = await api.get("/triage/doctor/consulting");
            this.consulting = data;
        },
        async fetchAttended() {
            const { data } = await api.get("/triage/doctor/attended");
            this.attended = data;
        },

        async refreshAll() {
            this.loading = true;
            try {
                await Promise.all([this.fetchWaiting(), this.fetchConsulting(), this.fetchAttended()]);
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

            // hidratar note desde la nota existente si ya hay
            const n = data?.medicalNote;
            if (n) {
                const contra = unpackContra(n.contrarreferencia ?? "");
                this.note = {
                    ...emptyNote(),
                    padecimientoActual: n.padecimientoActual ?? "",
                    antecedentes: n.antecedentes ?? "",
                    exploracionFisica: n.exploracionFisica ?? "",
                    estudiosParaclinicos: n.estudiosParaclinicos ?? "",
                    diagnostico: n.diagnostico ?? "",
                    planTratamiento: n.planTratamiento ?? "",
                    vigilancia: n.vigilancia ?? null,
                    contrarreferencia: n.contrarreferencia ?? "",
                    pronostico: n.pronostico ?? "",
                    contraRefFollowUp: contra.followUp,
                    contraRefWhen: contra.when,
                    vig: { ...emptyNote().vig, ...unpackVigilancia(n.vigilancia) },
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
                vigilancia: packVigilancia(this.note.vig),
                contrarreferencia: packContra(this.note.contraRefFollowUp, this.note.contraRefWhen),
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

        async openPdf(triageId: number) {
            const { data } = await api.get(`/medical/${triageId}/pdf`, { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },

        sortWaiting() {
            const rank: Record<string, number> = { VERDE: 1, AMARILLO: 2, ROJO: 3 };
            this.waiting.sort((a: any, b: any) => {
                const rc = (rank[b.classification] ?? 0) - (rank[a.classification] ?? 0);
                if (rc !== 0) return rc;
                return new Date(a.triageAt).getTime() - new Date(b.triageAt).getTime();
            });
        },

        isToday(iso: string) {
            const d = new Date(iso);
            const now = new Date();
            return d.getFullYear() === now.getFullYear()
                && d.getMonth() === now.getMonth()
                && d.getDate() === now.getDate();
        },

        unlockAudio() {
            // Esto debe llamarse tras interacción del usuario (click) para evitar bloqueo del navegador
            try {
                if (!this._audioCtx) this._audioCtx = new AudioContext();
                if (this._audioCtx.state === "suspended") this._audioCtx.resume();
                this._audioUnlocked = true;
            } catch {
                // si el navegador bloquea, no pasa nada, solo no sonará
            }
        },

        beepOnce(freq: number, ms = 180) {
            if (!this._audioUnlocked) return;
            if (!this._audioCtx) this._audioCtx = new AudioContext();
            const ctx = this._audioCtx;

            if (ctx.state === "suspended") ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.value = 0.08;

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            setTimeout(() => {
                try { osc.stop(); } catch {}
                try { osc.disconnect(); gain.disconnect(); } catch {}
            }, ms);
        },

        startAlertSound(classification: string) {
            this.stopAlertSound();

            // patrón por color
            if (classification === "ROJO") {
                this._beepTimer = setInterval(() => {
                    this.beepOnce(880, 160);
                    setTimeout(() => this.beepOnce(880, 160), 220);
                }, 900);
            } else if (classification === "AMARILLO") {
                this._beepTimer = setInterval(() => this.beepOnce(660, 180), 1200);
            } else {
                this._beepTimer = setInterval(() => this.beepOnce(440, 160), 1600);
            }
        },

        stopAlertSound() {
            if (this._beepTimer) {
                clearInterval(this._beepTimer);
                this._beepTimer = null;
            }
        },

        enqueueAlert(row: any) {
            if (this._notifiedIds.includes(row.id)) return;
            this._notifiedIds.push(row.id);
            this.alertQueue.push(row);

            // si es la primera alerta, arrancamos sonido ya
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
                // cambia patrón según el siguiente paciente
                this.startAlertSound(this.alertQueue[0].classification);
            }
        },

    },
});
