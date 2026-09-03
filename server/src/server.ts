import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { registerChatSocket } from "./sockets/chat.socket.js";

const port = Number(process.env.PORT || 4000);
const httpServer = createServer(app);
const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(httpServer, {
    cors: {
        origin: frontendOrigin,
        credentials: true
    }
});

async function startServer(): Promise<void> {
    await connectDB();
    registerChatSocket(io);

    httpServer.listen(port, () => {
        console.log(`ouechat running on port ${port}`);
    });
}

startServer().catch((error: Error) => {
    console.error("ouechat startup failed:", error.message);
    process.exit(1);
});
