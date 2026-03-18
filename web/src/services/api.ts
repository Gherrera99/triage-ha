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

// Si el servidor responde 401 (token expirado o inválido), limpiar sesión y redirigir al login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);
