// web/src/services/socket.ts
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth";

let socket: Socket | null = null;

export function getSocket() {
    if (!socket) {
        socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", {
            autoConnect: false,
            transports: ["websocket"],
            auth: {},
        });
    }
    return socket;
}

export function connectSocket() {
    const auth = useAuthStore();
    const s = getSocket();
    if (s.connected) return s;

    s.auth = { token: auth.token }; // 👈 backend debe leer handshake.auth.token
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
