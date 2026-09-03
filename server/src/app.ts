import "dotenv/config";
import cors from "cors";
import express from "express";
import healthRoutes from "./routes/health.routes.js";

const app = express();
const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
    origin: frontendOrigin,
    credentials: true
}));

app.use(express.json());
app.use("/health", healthRoutes);

export default app;
