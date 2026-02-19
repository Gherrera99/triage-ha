import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

type JwtPayload = { userId: number };

export let io: Server;

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
                if (/^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)) return cb(null, true);
                return cb(new Error(`CORS Socket bloqueado para: ${origin}`));
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        },
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("No token"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (!user) return next(new Error("User not found"));

            (socket as any).user = { id: user.id, role: user.role, name: user.name };
            socket.join(`role:${user.role}`);
            socket.join(`user:${user.id}`);
            return next();
        } catch {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        const u = (socket as any).user;
        console.log("socket connected", u);

        socket.on("disconnect", () => console.log("socket disconnected", u));
    });
}

export function emitToRole(role: string, event: string, payload: any) {
    io?.to(`role:${role}`).emit(event, payload);
}
