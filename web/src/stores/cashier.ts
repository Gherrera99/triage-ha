import { defineStore } from "pinia";
import { http } from "../api/http";

export type TriageColor = "VERDE" | "AMARILLO" | "ROJO";
export type PaymentStatus = "PENDING" | "PAID";

export type CashierQueueRow = {
    id: number;
    triageAt: string;
    motivoUrgencia: string;
    classification: TriageColor;
    paidStatus: PaymentStatus;

    patient: {
        expediente: string | null;
        fullName: string;
        age: number | null;
        sex: "M" | "F" | "O" | null;
        mayaHabla: boolean;
        responsibleName: string | null;
    };

    nurse?: { name: string } | null;
};

export const useCashierStore = defineStore("cashier", {
    state: () => ({
        rows: [] as CashierQueueRow[],
        loading: false,
        paying: false,
    }),

    actions: {
        async fetchQueue() {
            this.loading = true;
            try {
                const { data } = await http.get("/triage/cashier-queue");
                this.rows = data;
            } finally {
                this.loading = false;
            }
        },

        async markPaid(triageId: number, amount: number | null) {
            this.paying = true;
            try {
                await http.post(`/payments/${triageId}/pay`, { amount });
                await this.fetchQueue();
            } finally {
                this.paying = false;
            }
        },
    },
});
