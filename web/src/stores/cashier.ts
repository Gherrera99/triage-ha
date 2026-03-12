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
    closedAt?: string | null;
    closedReason?: string | null;
    refusedPayment?: boolean;

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
        refusing: false,
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

        async markPaid(triageId: number, expediente?: string | null) {
            this.paying = true;
            try {
                await http.post(`/payments/${triageId}/pay`, {
                    expediente: expediente ?? null,
                });
                await this.fetchQueue();
            } finally {
                this.paying = false;
            }
        },

        async refusePayment(triageId: number) {
            this.refusing = true;
            try {
                await http.post(`/payments/${triageId}/refuse`);
                await this.fetchQueue();
            } finally {
                this.refusing = false;
            }
        },
    },
});