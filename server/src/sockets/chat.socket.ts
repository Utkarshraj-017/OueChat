import { Server } from "socket.io";
import { readChatIdentity } from "../middleware/socketAuth.js";
import { registerChatHandlers } from "./chat.handlers.js";

// Socket.IO composition root for the chat feature. Authentication and event
// behavior live in focused modules so this file only wires them together.
export function registerChatSocket(io: Server): void {
    io.on("connection", (socket) => {
        try {
            const identity = readChatIdentity(socket);
            registerChatHandlers(io, socket, identity);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Chat authentication failed";
            socket.emit("chat_error", { message });
            socket.disconnect();
        }
    });
}
