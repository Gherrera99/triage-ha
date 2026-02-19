// web/src/services/socket.ts
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth";

let socket: Socket | null = null;

function resolveServerUrl() {
    // 1) prioridad a WS_URL (si lo defines)
    const fromEnv =
        import.meta.env.VITE_WS_URL ||
        import.meta.env.VITE_API_URL;

    if (fromEnv) return fromEnv;

    // 2) fallback dinámico: mismo host donde abriste el frontend, puerto 3000
    return `${window.location.protocol}//${window.location.hostname}:3000`;
}

export function getSocket() {
    if (!socket) {
        socket = io(resolveServerUrl(), {
            autoConnect: false,
            transports: ["websocket"], // si te falla en alguna red, quita esto para permitir polling
            auth: {},
        });
    }
    return socket;
}

export function connectSocket() {
    const auth = useAuthStore();
    const s = getSocket();
    if (s.connected) return s;

    // backend lee handshake.auth.token
    s.auth = { token: auth.token };
    s.connect();
    return s;
}

export function disconnectSocket() {
    if (socket) socket.disconnect();
}

export function resetSocket() {
    if (!socket) return;
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
}
