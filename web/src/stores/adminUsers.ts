import { defineStore } from "pinia";
import { api } from "../services/api";

export type Role = "NURSE_TRIAGE" | "CASHIER" | "DOCTOR" | "ADMIN" | "CONSULTOR";

const emptyForm = () => ({
    id: 0,
    name: "",
    email: "",
    role: "DOCTOR" as Role,
    cedula: "",
    password: "",
});

export const useAdminUsersStore = defineStore("adminUsers", {
    state: () => ({
        rows: [] as any[],
        loading: false,
        saving: false,

        q: "",
        role: "" as "" | Role,

        modalOpen: false,
        mode: "create" as "create" | "edit",
        form: emptyForm(),
    }),

    actions: {
        async fetch() {
            this.loading = true;
            try {
                const { data } = await api.get("/users", {
                    params: { q: this.q || undefined, role: this.role || undefined },
                });
                this.rows = data;
            } finally {
                this.loading = false;
            }
        },

        openCreate() {
            this.mode = "create";
            this.form = emptyForm();
            this.modalOpen = true;
        },

        openEdit(u: any) {
            this.mode = "edit";
            this.form = {
                id: u.id,
                name: u.name ?? "",
                email: u.email ?? "",
                role: u.role,
                cedula: u.cedula ?? "",
                password: "",
            };
            this.modalOpen = true;
        },

        async save() {
            this.saving = true;
            try {
                const payload: any = {
                    name: this.form.name,
                    email: this.form.email,
                    role: this.form.role,
                    cedula: this.form.cedula || null,
                };

                // password: requerido en create, opcional en edit
                if (this.mode === "create") {
                    if (!this.form.password) throw new Error("Password requerido");
                    payload.password = this.form.password;
                    await api.post("/users", payload);
                } else {
                    if (this.form.password) payload.password = this.form.password;
                    await api.put(`/users/${this.form.id}`, payload);
                }

                this.modalOpen = false;
                await this.fetch();
            } finally {
                this.saving = false;
            }
        },

        async remove(id: number) {
            if (!confirm("¿Eliminar usuario?")) return;
            await api.delete(`/users/${id}`);
            await this.fetch();
        },
    },
});
