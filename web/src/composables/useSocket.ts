// web/src/composables/useSocket.ts
import { getSocket, connectSocket, disconnectSocket } from "../services/socket";

export function useSocket() {
    const socket = getSocket();

    function connect() {
        const s = connectSocket();

        // Listener global: el servidor indica que esta cuenta fue desactivada.
        // Se monta aquí para que cualquier vista autenticada que llame a connect()
        // quede cubierta automáticamente.
        s.once("auth:disabled", async (payload: { reason?: string }) => {
            // Importaciones lazy para evitar ciclos: composable ← store ← api ← router
            const { useAuthStore } = await import("../stores/auth");
            const { default: router } = await import("../router/index");

            const auth = useAuthStore();
            const reason =
                payload?.reason ||
                "Tu cuenta fue desactivada. Comunícate con el área de tecnologías de la información.";

            auth.handleAuthDisabled(reason);
            await router.push({ path: "/login" });
        });

        return s;
    }

    function disconnect() {
        return disconnectSocket();
    }

    // helper: devuelve el "off" para limpiar listeners en onUnmounted
    function on(event: string, handler: (...args: unknown[]) => void) {
        socket.on(event, handler);
        return () => socket.off(event, handler);
    }

    return { socket, connect, disconnect, on };
}
