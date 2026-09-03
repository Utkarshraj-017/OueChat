import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
    origin: frontendOrigin,
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
