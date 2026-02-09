// web/src/composables/useSocket.ts
import { getSocket, connectSocket, disconnectSocket } from "../services/socket";

export function useSocket() {
    const socket = getSocket();

    function connect() {
        return connectSocket();
    }

    function disconnect() {
        return disconnectSocket();
    }

    // helper: te devuelve el "off" para limpiar listeners
    function on(event: string, handler: (...args: any[]) => void) {
        socket.on(event, handler);
        return () => socket.off(event, handler);
    }

    return { socket, connect, disconnect, on };
}
