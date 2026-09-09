import { Server, Socket } from "socket.io";
import { readChatIdentity } from "../middleware/socketAuth.js";
import { registerChatHandlers } from "./chat.handlers.js";

const MAX_TIMEOUT_MS = 2_147_000_000;

export function enforceTokenLifetime(
    socket: Socket,
    expiresAt: number
): void {
    let timer: NodeJS.Timeout | undefined;

    const expireSocket = (): void => {
        if (socket.disconnected) {
            return;
        }

        socket.emit("chat_error", { message: "Chat token expired" });
        socket.disconnect(true);
    };

    const scheduleExpiry = (): void => {
        const remainingMs = expiresAt - Date.now();

        if (remainingMs <= 0) {
            expireSocket();
            return;
        }

        timer = setTimeout(scheduleExpiry, Math.min(remainingMs, MAX_TIMEOUT_MS));
        timer.unref();
    };

    scheduleExpiry();

    socket.use((_packet, next) => {
        if (Date.now() >= expiresAt) {
            expireSocket();
            next(new Error("Chat token expired"));
            return;
        }

        next();
    });

    socket.once("disconnect", () => {
        if (timer) {
            clearTimeout(timer);
        }
    });
}

// Socket.IO composition root for the chat feature. Authentication and event
// behavior live in focused modules so this file only wires them together.
export function registerChatSocket(io: Server): void {
    io.on("connection", (socket) => {
        try {
            const identity = readChatIdentity(socket);
            enforceTokenLifetime(socket, identity.expiresAt);
            registerChatHandlers(io, socket, identity);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Chat authentication failed";
            socket.emit("chat_error", { message });
            socket.disconnect();
        }
    });
}
