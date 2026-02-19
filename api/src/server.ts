import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { initSocket } from "./socket";
import { authRouter } from "./routes/auth.routes";
import { triageRouter } from "./routes/triage.routes";
import { paymentRouter } from "./routes/payment.routes";
import { medicalRouter } from "./routes/medical.routes";
import { adminRouter } from "./routes/admin.routes";
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

        // DEV: permite cualquier IP LAN (Vite 5173)
        if (/^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin)) return cb(null, true);

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
app.use("/admin", adminRouter);
app.use("/users", usersRouter);
app.use("/admin-reports", adminReportsRouter);


const server = http.createServer(app);
initSocket(server);

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
