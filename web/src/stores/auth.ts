// web/src/stores/auth.ts
import { defineStore } from "pinia";
import { api } from "../services/api";
import { resetSocket } from "../services/socket";

export type User = {
    id: number;
    name: string;
    email: string;
    role: string;
    cedula?: string | null;
    mustChangePassword: boolean;
};

function safeParseUser(raw: string | null): User | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as User;
    } catch {
        // si está corrupto, lo borramos para que no vuelva a romper
        localStorage.removeItem("user");
        return null;
    }
}

export const useAuthStore = defineStore("auth", {
    state: () => ({
        token: localStorage.getItem("token") || "",
        user: safeParseUser(localStorage.getItem("user")),
        // Banner efímero que se muestra en LoginView cuando la cuenta
        // fue desactivada mientras el usuario tenía sesión activa.
        loginBanner: "" as string,
    }),
    getters: {
        isLoggedIn: (s) => !!s.token,
    },
    actions: {
        async login(email: string, password: string) {
            const { data } = await api.post("/auth/login", { email, password });
            this.token = data.token;
            // El backend garantiza que user incluye mustChangePassword
            this.user = data.user as User;

            localStorage.setItem("token", this.token);
            localStorage.setItem("user", JSON.stringify(this.user));
        },

        logout() {
            this.token = "";
            this.user = null;
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            resetSocket();
        },

        init() {
            this.token = localStorage.getItem("token") || "";
            this.user = safeParseUser(localStorage.getItem("user"));
        },

        /**
         * Cambia la contraseña del usuario autenticado.
         * En éxito limpia el flag mustChangePassword en estado y localStorage.
         * Errores 400 se propagan al caller para que la vista los muestre.
         */
        async changePassword(payload: {
            currentPassword: string;
            newPassword: string;
            confirmPassword: string;
        }) {
            await api.post("/auth/change-password", payload);
            // Limpiar flag en estado y en localStorage para que el guard
            // no vuelva a redirigir a /cambiar-password.
            if (this.user) {
                this.user.mustChangePassword = false;
                localStorage.setItem("user", JSON.stringify(this.user));
            }
        },

        /**
         * Llamado cuando el socket recibe `auth:disabled`.
         * Limpia la sesión y prepara el banner para LoginView.
         */
        handleAuthDisabled(reason: string) {
            const msg =
                reason ||
                "Tu cuenta fue desactivada. Comunícate con el área de tecnologías de la información.";
            this.logout();
            this.loginBanner = msg;
            // La redirección la hace quien llama a esta action (composable de socket)
            // para evitar importación circular con el router desde el store.
        },
    },
});
