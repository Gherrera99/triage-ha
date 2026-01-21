//web/src/stores/auth.ts
import { defineStore } from "pinia";
import { api } from "../services/api";
import { resetSocket } from "../services/socket";

type User = { id: number; name: string; email: string; role: string; cedula?: string | null };

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
    }),
    getters: {
        isLoggedIn: (s) => !!s.token,
    },
    actions: {
        async login(email: string, password: string) {
            const { data } = await api.post("/auth/login", { email, password });
            this.token = data.token;
            this.user = data.user;

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
    },
});
