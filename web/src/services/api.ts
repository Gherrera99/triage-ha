// web/src/services/api.ts
import axios from "axios";

const API_BASE =
    import.meta.env.VITE_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:3000`;

export const api = axios.create({
    baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token") || "";
    if (token) (config.headers ??= {}).Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const status: number | undefined = err.response?.status;

        // 401 — token expirado o inválido (NO en flujo de change-password, que usa 400)
        // 403 — cuenta desactivada en el servidor
        // Excluir /auth/login: ahí el 401/403 es una respuesta esperada del negocio
        // (password incorrecta, cuenta desactivada en el momento del intento de login).
        // LoginView maneja esos códigos directamente en su bloque catch.
        const requestUrl = err.config?.url ?? "";
        if ((status === 401 || status === 403) && !requestUrl.includes("/auth/login")) {
            // Importación lazy para evitar ciclo: api.ts ← router ← api.ts
            const { useAuthStore } = await import("../stores/auth");
            const { default: router } = await import("../router/index");

            const auth = useAuthStore();
            const msg =
                status === 403
                    ? "Tu cuenta fue desactivada. Comunícate con el área de tecnologías de la información."
                    : "";

            // logout limpia estado y localStorage
            auth.logout();
            if (msg) auth.loginBanner = msg;

            // Usar router.push en vez de window.location.href para no romper
            // el estado de Vue entre el flujo de cambio de contraseña y login.
            await router.push({ path: "/login" });
        }

        return Promise.reject(err);
    }
);
