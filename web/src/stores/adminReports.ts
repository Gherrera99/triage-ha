import { defineStore } from "pinia";
import { api } from "../services/api";

const VIG_DEFAULTS = {
    vigFiebre38: false,
    vigConvulsiones: false,
    vigAlteracionAlerta: false,
    vigSangradoActivo: false,
    vigDeshidratacion: false,
    vigVomitosFrecuentes: false,
    vigIrritabilidad: false,
    vigLlantoInconsolable: false,
    vigDificultadRespiratoria: false,
    vigChoque: false,
    vigDeterioroNeurologico: false,
};

function normalizeSelected(row: any) {
    if (!row) return row;

    // ✅ patient defaults
    row.patient ??= {};
    row.patient.mayaHabla = !!row.patient.mayaHabla;

    // ✅ medicalNote defaults (para que el modal siempre tenga qué renderizar)
    row.medicalNote ??= {
        padecimientoActual: "",
        antecedentes: "",
        exploracionFisica: "",
        estudiosParaclinicos: "",
        diagnostico: "",
        planTratamiento: "",
        pronostico: "",
        vigilancia: {},
        contraRefFollowUp: false,
        contraRefWhen: "",
    };

    // ✅ vigilancia: objeto con todas las keys
    row.medicalNote.vigilancia = {
        ...VIG_DEFAULTS,
        ...(row.medicalNote.vigilancia && typeof row.medicalNote.vigilancia === "object"
            ? row.medicalNote.vigilancia
            : {}),
    };

    // ✅ contraRef: asegúralos para checkbox + input
    row.medicalNote.contraRefFollowUp = !!row.medicalNote.contraRefFollowUp;
    row.medicalNote.contraRefWhen = row.medicalNote.contraRefWhen ?? "";

    return row;
}

export const useAdminReportsStore = defineStore("adminReports", {
    state: () => ({
        rows: [] as any[],
        kpi: null as any | null,

        q: "",
        classification: "" as "" | "VERDE" | "AMARILLO" | "ROJO",
        startDate: "", // yyyy-mm-dd
        endDate: "",

        selected: null as any | null,
        modalOpen: false,

        loading: false,
        saving: false,
    }),

    actions: {
        setDefaultToday() {
            const d = new Date();
            const iso = d.toISOString().slice(0, 10);
            this.startDate = iso;
            this.endDate = iso;
        },

        async fetch() {
            this.loading = true;
            try {
                const { data } = await api.get("/admin-reports/attended", {
                    params: {
                        q: this.q || undefined,
                        classification: this.classification || undefined,
                        startDate: this.startDate || undefined,
                        endDate: this.endDate || undefined,
                    },
                });
                this.rows = data.rows;
                this.kpi = data.kpi;
            } finally {
                this.loading = false;
            }
        },

        async open(id: number) {
            const { data } = await api.get(`/admin-reports/attended/${id}`);
            this.selected = normalizeSelected(data);
            this.modalOpen = true;
        },

        async save() {
            if (!this.selected) return;
            this.selected = normalizeSelected(this.selected); // ✅ por si algo vino incompleto
            this.saving = true;
            try {
                const payload = {
                    patient: this.selected.patient,
                    triage: {
                        motivoUrgencia: this.selected.motivoUrgencia,
                        appearance: this.selected.appearance,
                        respiration: this.selected.respiration,
                        circulation: this.selected.circulation,
                        classification: this.selected.classification,
                        weightKg: this.selected.weightKg,
                        heightCm: this.selected.heightCm,
                        temperatureC: this.selected.temperatureC,
                        heartRate: this.selected.heartRate,
                        respiratoryRate: this.selected.respiratoryRate,
                        bloodPressure: this.selected.bloodPressure,
                        hadPriorCareSamePathology: this.selected.hadPriorCareSamePathology,
                        priorCarePlace: this.selected.priorCarePlace,
                        hasReferral: this.selected.hasReferral,
                        referralPlace: this.selected.referralPlace,
                    },
                    payment: this.selected.payment
                        ? {
                            cashierId: this.selected.payment.cashierId,
                            status: this.selected.payment.status,
                            amount: this.selected.payment.amount,
                            paidAt: this.selected.payment.paidAt,
                        }
                        : {},
                    medicalNote: this.selected.medicalNote
                        ? {
                            padecimientoActual: this.selected.medicalNote.padecimientoActual,
                            antecedentes: this.selected.medicalNote.antecedentes,
                            exploracionFisica: this.selected.medicalNote.exploracionFisica,
                            estudiosParaclinicos: this.selected.medicalNote.estudiosParaclinicos,
                            diagnostico: this.selected.medicalNote.diagnostico,
                            planTratamiento: this.selected.medicalNote.planTratamiento,
                            vigilancia: this.selected.medicalNote.vigilancia,
                            contraRefFollowUp: this.selected.medicalNote.contraRefFollowUp,
                            contraRefWhen: this.selected.medicalNote.contraRefWhen,
                            pronostico: this.selected.medicalNote.pronostico,
                            consultationStartedAt: this.selected.medicalNote.consultationStartedAt,
                            consultationFinishedAt: this.selected.medicalNote.consultationFinishedAt,
                        }
                        : {},
                };

                const { data } = await api.put(`/admin-reports/attended/${this.selected.id}`, payload);
                this.selected = data;
                await this.fetch();
            } finally {
                this.saving = false;
            }
        },

        async exportExcel() {
            const { data } = await api.get("/admin-reports/attended-excel", {
                params: {
                    q: this.q || undefined,
                    classification: this.classification || undefined,
                    startDate: this.startDate || undefined,
                    endDate: this.endDate || undefined,
                },
                responseType: "blob",
            });

            const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "reporte_admin.xlsx";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
    },
});
