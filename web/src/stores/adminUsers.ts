// web/src/stores/adminUsers.ts
import { defineStore } from "pinia";
import { api } from "../services/api";

export type AdminUser = {
    id: number;
    email: string;
    name: string;
    role: "NURSE_TRIAGE" | "CASHIER" | "DOCTOR" | "ADMIN" | "CONSULTOR";
    cedula?: string | null;
};

export const useAdminUsersStore = defineStore("adminUsers", {
    state: () => ({
        users: [] as AdminUser[],
        loading: false,
    }),
    actions: {
        async fetch() {
            this.loading = true;
            try {
                const { data } = await api.get<AdminUser[]>("/users"); // ✅ NO /api/users
                this.users = data;
            } finally {
                this.loading = false;
            }
        },

        async create(payload: { email: string; name: string; role: AdminUser["role"]; password: string; cedula?: string | null }) {
            await api.post("/users", payload); // ✅ NO /api/users
            await this.fetch();
        },
    },
});
