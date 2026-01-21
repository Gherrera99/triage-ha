import { defineStore } from "pinia";
import { http } from "../api/http";

export type CashierItem = {
    id: number;
    triageTimestamp: string;
    classification: "GREEN" | "YELLOW" | "RED";
    patientFullName: string;
    motivoUrgencia: string;
    nurse: { fullName: string };
};

export const useCashierStore = defineStore("cashier", {
    state: () => ({
        queue: [] as CashierItem[],
        loading: false,
    }),
    actions: {
        async fetchQueue() {
            this.loading = true;
            try {
                const { data } = await http.get("/triage/cashier/queue");
                // si quieres ocultar rojos en caja:
                this.queue = data.filter((x: CashierItem) => x.classification !== "RED");
            } finally {
                this.loading = false;
            }
        },
        async markPaid(id: number, amount?: number) {
            await http.post(`/triage/${id}/pay`, { amount: amount ?? null });
            await this.fetchQueue();
        },
    },
});
