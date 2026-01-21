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



dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);

app.get("/health", (_, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/triage", triageRouter);
app.use("/payments", paymentRouter);
app.use("/medical", medicalRouter);
app.use("/admin", adminRouter);
app.use("/users", usersRouter);


const server = http.createServer(app);
initSocket(server);

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
