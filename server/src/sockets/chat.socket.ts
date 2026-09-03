import jwt, { JwtPayload } from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import Message from "../models/message.model.js";
import { validateMembership } from "../services/rideBackend.service.js";

interface ChatIdentity {
    userId: string;
    rideId: string;
    role: "creator" | "passenger";
}

interface RidePayload {
    rideId?: unknown;
    text?: unknown;
}

const roomName = (rideId: string): string => `ride:${rideId}`;

function readChatIdentity(socket: Socket): ChatIdentity {
    const token = socket.handshake.auth?.chatToken;
    const secret = process.env.CHAT_TOKEN_SECRET;

    if (typeof token !== "string" || !secret) {
        throw new Error("Chat authentication failed");
    }

    const decoded = jwt.verify(token, secret, {
        audience: "ouechat"
    });

    if (typeof decoded === "string") {
        throw new Error("Invalid chat token");
    }

    const payload = decoded as JwtPayload;
    const role = payload.role === "creator" ? "creator" : "passenger";

    if (typeof payload.sub !== "string" || typeof payload.rideId !== "string") {
        throw new Error("Invalid chat token");
    }

    return {
        userId: payload.sub,
        rideId: payload.rideId,
        role
    };
}

function sendError(socket: Socket, message: string): void {
    socket.emit("chat_error", { message });
}

function hasValidRidePayload(
    data: RidePayload
): data is { rideId: string; text?: unknown } {
    return typeof data.rideId === "string" && data.rideId.length > 0;
}

export function registerChatSocket(io: Server): void {
    io.on("connection", (socket) => {
        let identity: ChatIdentity;

        try {
            identity = readChatIdentity(socket);
        } catch (error) {
            sendError(socket, (error as Error).message);
            socket.disconnect();
            return;
        }

        socket.on("join_ride", async (data: RidePayload) => {
            try {
                if (!hasValidRidePayload(data) || data.rideId !== identity.rideId) {
                    sendError(socket, "You cannot join this ride room");
                    return;
                }

                const allowed = await validateMembership(
                    identity.rideId,
                    identity.userId
                );

                if (!allowed) {
                    sendError(socket, "You are no longer a member of this ride");
                    return;
                }

                await socket.join(roomName(identity.rideId));
                socket.emit("joined_ride", {
                    roomId: roomName(identity.rideId)
                });
            } catch (error) {
                sendError(socket, "Unable to join the ride room");
                console.error("Join ride error:", error);
            }
        });

        socket.on("get_messages", async (data: RidePayload) => {
            try {
                if (!hasValidRidePayload(data) || data.rideId !== identity.rideId) {
                    sendError(socket, "Invalid ride room");
                    return;
                }

                const allowed = await validateMembership(
                    identity.rideId,
                    identity.userId
                );

                if (!allowed) {
                    sendError(socket, "You are no longer a member of this ride");
                    return;
                }

                const messages = await Message
                    .find({ rideId: identity.rideId })
                    .sort({ createdAt: 1 })
                    .limit(100)
                    .lean();

                socket.emit("messages", messages);
            } catch (error) {
                sendError(socket, "Unable to load messages");
                console.error("Load messages error:", error);
            }
        });

        socket.on("send_message", async (data: RidePayload) => {
            try {
                if (!hasValidRidePayload(data) || data.rideId !== identity.rideId) {
                    sendError(socket, "Invalid ride room");
                    return;
                }

                if (typeof data.text !== "string" || !data.text.trim()) {
                    sendError(socket, "Message text is required");
                    return;
                }

                const text = data.text.trim();

                if (text.length > 1000) {
                    sendError(socket, "Message cannot exceed 1000 characters");
                    return;
                }

                const allowed = await validateMembership(
                    identity.rideId,
                    identity.userId
                );

                if (!allowed) {
                    sendError(socket, "You are no longer a member of this ride");
                    return;
                }

                if (!socket.rooms.has(roomName(identity.rideId))) {
                    sendError(socket, "Join the ride room first");
                    return;
                }

                const message = await Message.create({
                    rideId: identity.rideId,
                    senderId: identity.userId,
                    text
                });

                io.to(roomName(identity.rideId)).emit("new_message", {
                    id: message._id.toString(),
                    rideId: message.rideId,
                    senderId: message.senderId,
                    text: message.text,
                    createdAt: message.createdAt
                });
            } catch (error) {
                sendError(socket, "Unable to send message");
                console.error("Send message error:", error);
            }
        });
    });
}
