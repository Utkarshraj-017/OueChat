import "dotenv/config";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";

const app = express();

app.use(cors({
    origin: env.frontendOrigin,
    credentials: true
}));

app.use(express.json());

// HTTP health route. OueChat has no public REST chat routes; chat actions
// are handled by the Socket.IO event handlers in chat.socket.ts.
app.get("/health", (_req, res) => {
    res.status(200).json({
        service: "ouechat",
        status: "ok"
    });
});

export default app;
