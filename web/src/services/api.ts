import axios from "axios";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token") || "";
    if (token) {
        // axios v1: headers puede ser undefined
        (config.headers ??= {}).Authorization = `Bearer ${token}`;
    }
    return config;
});
