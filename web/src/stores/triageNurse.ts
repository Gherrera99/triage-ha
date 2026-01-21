import { defineStore } from "pinia";
import { http } from "../api/http";

export const useTriageNurseStore = defineStore("triageNurse", {
    state: () => ({
        saving: false,
    }),
    actions: {
        async createTriage(payload: any) {
            this.saving = true;
            try {
                const { data } = await http.post("/triage", payload);
                return data;
            } finally {
                this.saving = false;
            }
        },
    },
});
