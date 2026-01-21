import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth";
import { useTriageStore } from "../stores/triage";

let socket: Socket | null = null;

export function useSocket() {
    const auth = useAuthStore();
    const triage = useTriageStore();

    function connect() {
        if (!auth.token) return;
        if (socket) return;

        socket = io(import.meta.env.VITE_API_URL, {
            auth: { token: auth.token },
            transports: ["websocket"],
        });

        socket.on("triage:new", (payload) => {
            triage.onTriageNew(payload);
        });

        socket.on("payment:paid", (payload) => {
            triage.onPaymentPaid(payload);
        });

        socket.on("consultation:started", (payload) => {
            triage.onConsultationStarted(payload);
        });
    }

    function disconnect() {
        socket?.disconnect();
        socket = null;
    }

    return { connect, disconnect };
}
