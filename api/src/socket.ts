import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

type JwtPayload = { userId: number };

export let io: Server;

/**
 * Presencia en tiempo real.
 * userId → Set de socketIds activos (un mismo usuario puede tener varias pestañas abiertas).
 * Se usa para emitir users:presence al panel admin y para snapshot al conectar.
 */
const connectedUsers = new Map<number, Set<string>>();

export function initSocket(server: HttpServer) {
    const allowlist = (process.env.CORS_ORIGIN ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    io = new Server(server, {
        cors: {
            origin: (origin, cb) => {
                if (!origin) return cb(null, true);
                if (allowlist.includes(origin)) return cb(null, true);
                // LAN del hospital (http o https)
                if (/^https?:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)) return cb(null, true);
                // Tailscale CGNAT range 100.64.0.0/10 (acceso remoto del equipo de TI)
                if (/^https?:\/\/100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+:5173$/.test(origin)) return cb(null, true);
                return cb(new Error(`CORS Socket bloqueado para: ${origin}`));
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        },
    });

    // Middleware de autenticación del handshake
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("No token"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (!user) return next(new Error("User not found"));

            // Bloquear conexión si el usuario fue desactivado
            if (!user.active) return next(new Error("Usuario desactivado"));

            socket.user = { id: user.id, role: user.role, name: user.name };
            socket.join(`role:${user.role}`);
            socket.join(`user:${user.id}`);
            return next();
        } catch {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        const u = socket.user!;
        console.log("socket connected", u);

        // --- Tracking de presencia ---
        // Agregar este socketId al set del usuario
        const wasPreviouslyConnected = connectedUsers.has(u.id);
        if (!wasPreviouslyConnected) {
            connectedUsers.set(u.id, new Set());
        }
        connectedUsers.get(u.id)!.add(socket.id);

        // Solo emitir "online" la primera vez que el usuario conecta (no en pestañas adicionales)
        if (!wasPreviouslyConnected) {
            io.to("role:ADMIN").emit("users:presence", { userId: u.id, online: true });
        }

        // Handler para que el panel admin se hidrate al conectar
        socket.on("admin:presence:snapshot", () => {
            if (socket.user?.role !== "ADMIN") return; // solo admins
            const onlineUserIds = Array.from(connectedUsers.keys());
            socket.emit("admin:presence:snapshot", { onlineUserIds });
        });

        socket.on("disconnect", () => {
            console.log("socket disconnected", u);

            // Eliminar este socketId del set
            const sockets = connectedUsers.get(u.id);
            if (sockets) {
                sockets.delete(socket.id);
                // Si el set quedó vacío, el usuario ya no tiene ninguna sesión activa
                if (sockets.size === 0) {
                    connectedUsers.delete(u.id);
                    io.to("role:ADMIN").emit("users:presence", { userId: u.id, online: false });
                }
            }
        });
    });
}

/** Emite un evento al room personal de un usuario específico. */
export function emitToUser(userId: number, event: string, payload?: unknown) {
    io?.to(`user:${userId}`).emit(event, payload);
}

/** Emite un evento a todos los sockets de un rol determinado. */
export function emitToRole(role: string, event: string, payload: unknown) {
    io?.to(`role:${role}`).emit(event, payload);
}
