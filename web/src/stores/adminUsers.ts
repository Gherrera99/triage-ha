// web/src/stores/adminUsers.ts
import { defineStore } from "pinia";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

export type Role = "NURSE_TRIAGE" | "CASHIER" | "DOCTOR" | "ADMIN" | "CONSULTOR";

export type UserRow = {
    id: number;
    name: string;
    email: string;
    role: Role;
    cedula: string | null;
    active: boolean;
    mustChangePassword: boolean;
    failedAttempts: number;
    lockedAt: string | null;
    deactivatedReason: string | null;
};

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
        rows: [] as UserRow[],
        loading: false,
        saving: false,
        saveError: "" as string,

        q: "",
        role: "" as "" | Role,

        modalOpen: false,
        mode: "create" as "create" | "edit",
        form: emptyForm(),

        // Presencia en tiempo real: IDs de usuarios conectados al socket
        connectedUserIds: new Set<number>() as Set<number>,

        // Estado de operaciones sobre usuarios individuales
        deactivateModalOpen: false,
        deactivateTargetId: 0,
        deactivateReason: "",
        deactivating: false,

        // Modal resultado de reset de password — muestra tempPassword una sola vez
        tempPasswordModal: false,
        tempPassword: "",
        tempPasswordCopied: false,
    }),

    actions: {
        async fetch() {
            this.loading = true;
            try {
                const { data } = await api.get("/users", {
                    params: { q: this.q || undefined, role: this.role || undefined },
                });
                this.rows = data as UserRow[];
            } finally {
                this.loading = false;
            }
        },

        openCreate() {
            this.mode = "create";
            this.form = emptyForm();
            this.saveError = "";
            this.modalOpen = true;
        },

        openEdit(u: UserRow) {
            this.mode = "edit";
            this.form = {
                id: u.id,
                name: u.name ?? "",
                email: u.email ?? "",
                role: u.role,
                cedula: u.cedula ?? "",
                password: "",
            };
            this.saveError = "";
            this.modalOpen = true;
        },

        async save() {
            this.saving = true;
            this.saveError = "";
            try {
                const payload: Record<string, unknown> = {
                    name: this.form.name,
                    email: this.form.email,
                    role: this.form.role,
                    cedula: this.form.cedula || null,
                };

                if (this.mode === "create") {
                    if (!this.form.password) {
                        this.saveError = "La contraseña es obligatoria al crear un usuario.";
                        return;
                    }
                    payload.password = this.form.password;
                    await api.post("/users", payload);
                } else {
                    if (this.form.password) payload.password = this.form.password;
                    await api.put(`/users/${this.form.id}`, payload);
                }

                this.modalOpen = false;
                await this.fetch();
            } catch (err: unknown) {
                const axErr = err as { response?: { data?: { error?: string } } };
                this.saveError =
                    axErr.response?.data?.error ||
                    "Ocurrió un error al guardar. Intenta de nuevo.";
            } finally {
                this.saving = false;
            }
        },

        async remove(id: number) {
            if (!confirm("¿Eliminar usuario?")) return;
            await api.delete(`/users/${id}`);
            await this.fetch();
        },

        // --- Desactivar usuario ---
        openDeactivate(id: number) {
            this.deactivateTargetId = id;
            this.deactivateReason = "";
            this.deactivateModalOpen = true;
        },

        async deactivate() {
            if (!this.deactivateTargetId) return;
            this.deactivating = true;
            try {
                await api.patch(`/users/${this.deactivateTargetId}/deactivate`, {
                    reason: this.deactivateReason || undefined,
                });
                this.deactivateModalOpen = false;
                await this.fetch();
            } finally {
                this.deactivating = false;
            }
        },

        // --- Activar usuario ---
        async activate(id: number) {
            await api.patch(`/users/${id}/activate`);
            await this.fetch();
        },

        // --- Resetear contraseña ---
        async resetPassword(id: number) {
            const { data } = await api.post<{ tempPassword: string }>(
                `/users/${id}/reset-password`
            );
            this.tempPassword = data.tempPassword;
            this.tempPasswordCopied = false;
            this.tempPasswordModal = true;
        },

        copyTempPassword() {
            if (!this.tempPassword) return;
            navigator.clipboard.writeText(this.tempPassword).then(() => {
                this.tempPasswordCopied = true;
            });
        },

        // --- Presencia en tiempo real ---
        subscribePresence() {
            const socket = getSocket();

            // Hidratar: escuchar la respuesta del snapshot ANTES de emitir la petición,
            // para no perder la respuesta si llega muy rápido.
            // El backend responde emitiendo "admin:presence:snapshot" de vuelta al mismo socket.
            socket.once(
                "admin:presence:snapshot",
                (response: { onlineUserIds: number[] }) => {
                    if (response?.onlineUserIds) {
                        this.connectedUserIds = new Set(response.onlineUserIds);
                    }
                }
            );
            // Solicitar snapshot al conectar
            socket.emit("admin:presence:snapshot");

            // Escuchar cambios de presencia en tiempo real
            socket.on("users:presence", (payload: { userId: number; online: boolean }) => {
                const updated = new Set(this.connectedUserIds);
                if (payload.online) {
                    updated.add(payload.userId);
                } else {
                    updated.delete(payload.userId);
                }
                this.connectedUserIds = updated;
            });
        },

        unsubscribePresence() {
            const socket = getSocket();
            socket.off("users:presence");
        },
    },
});
