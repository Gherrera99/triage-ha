import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth";

let socket: Socket | null = null;

export function getSocket() {
    const auth = useAuthStore();
    if (!socket) {
        socket = io(import.meta.env.VITE_WS_URL, {
            auth: { token: auth.token },
        });
    }
    return socket;
}

export function resetSocket() {
    socket?.disconnect();
    socket = null;
}
