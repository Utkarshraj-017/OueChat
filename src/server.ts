import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env, validateEnvironment } from "./config/env.js";
import { registerChatSocket } from "./sockets/chat.socket.js";

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: env.frontendOrigin,
        credentials: true
    }
});

async function startServer(): Promise<void> {
    validateEnvironment();
    await connectDB();
    registerChatSocket(io);

    httpServer.listen(env.port, () => {
        console.log(`ouechat running on port ${env.port}`);
    });
}

startServer().catch((error: Error) => {
    console.error("ouechat startup failed:", error.message);
    process.exit(1);
});
