import express, { NextFunction, Request, Response } from "express";
import http from "http";
import https from "https";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { initSocket } from "./socket";
import { authRouter } from "./routes/auth.routes";
import { triageRouter } from "./routes/triage.routes";
import { paymentRouter } from "./routes/payment.routes";
import { medicalRouter } from "./routes/medical.routes";
import { usersRouter } from "./routes/users.routes";
import adminReportsRouter from "./routes/admin.reports.routes";



dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

// acepta lista en .env: "http://localhost:5173,http://192.168.1.90:5173"
const allowlist = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const corsOptions: cors.CorsOptions = {
    origin: (origin, cb) => {
        // permite requests sin Origin (Postman/curl)
        if (!origin) return cb(null, true);

        // allowlist exacta
        if (allowlist.includes(origin)) return cb(null, true);

        // DEV: permite cualquier IP LAN (Vite 5173) en http o https
        if (/^https?:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)) return cb(null, true);

        // Tailscale CGNAT range 100.64.0.0/10 (acceso remoto del equipo de TI)
        if (/^https?:\/\/100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+:5173$/.test(origin)) return cb(null, true);

        return cb(new Error(`CORS bloqueado para: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ importante para preflight

app.get("/health", (_, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/triage", triageRouter);
app.use("/payments", paymentRouter);
app.use("/medical", medicalRouter);
app.use("/users", usersRouter);
app.use("/admin-reports", adminReportsRouter);


// Middleware de error global — debe registrarse DESPUÉS de todas las rutas.
// Captura errores lanzados con next(err) o desde asyncHandler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[error global]", err);
    const status: number = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({ error: err?.message || "Error interno del servidor" });
});

// HTTPS opcional: si TLS_CERT_PATH y TLS_KEY_PATH apuntan a archivos
// existentes, el server arranca en HTTPS. Si no, queda en HTTP plano
// (modo dev local sin certificados).
const TLS_CERT_PATH = process.env.TLS_CERT_PATH;
const TLS_KEY_PATH = process.env.TLS_KEY_PATH;
const tlsEnabled =
    !!TLS_CERT_PATH &&
    !!TLS_KEY_PATH &&
    fs.existsSync(TLS_CERT_PATH) &&
    fs.existsSync(TLS_KEY_PATH);

const server = tlsEnabled
    ? https.createServer(
          {
              cert: fs.readFileSync(TLS_CERT_PATH!),
              key: fs.readFileSync(TLS_KEY_PATH!),
          },
          app
      )
    : http.createServer(app);

initSocket(server);

const PORT = Number(process.env.PORT || 3000);
const proto = tlsEnabled ? "https" : "http";
server.listen(PORT, () => console.log(`API on ${proto}://localhost:${PORT}`));
