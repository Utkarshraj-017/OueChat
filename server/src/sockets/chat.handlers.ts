import { Server, Socket } from "socket.io";
import { env } from "../config/env.js";
import {
    ChatIdentity,
    RidePayload
} from "../types/chat.types.js";
import {
    createMessage,
    getRecentMessages,
    hasChatAccess,
    roomName
} from "../services/chat.service.js";

function sendError(socket: Socket, message: string): void {
    socket.emit("chat_error", { message });
}

function hasValidRidePayload(
    data: RidePayload | undefined
): data is { rideId: string; text?: unknown } {
    if (!data) {
        return false;
    }

    return typeof data.rideId === "string" && data.rideId.length > 0;
}

function revokeSocketAccess(
    socket: Socket,
    rideId: string,
    message: string
): void {
    sendError(socket, message);
    socket.emit("chat_access_revoked", { rideId, message });
    socket.leave(roomName(rideId));
    socket.disconnect(true);
}

function startMembershipRecheck(
    socket: Socket,
    identity: ChatIdentity
): () => void {
    let checking = false;

    const timer = setInterval(() => {
        if (checking || socket.disconnected) {
            return;
        }

        checking = true;

        void hasChatAccess(identity)
            .then((allowed) => {
                if (!allowed) {
                    revokeSocketAccess(
                        socket,
                        identity.rideId,
                        "Your access to this ride chat has been revoked"
                    );
                }
            })
            .catch((error: Error) => {
                // A temporary ride-backend failure should not revoke every
                // active socket. New chat actions still validate access.
                console.error("Membership recheck error:", error.message);
            })
            .finally(() => {
                checking = false;
            });
    }, env.membershipRecheckIntervalMs);

    return () => clearInterval(timer);
}

export function registerChatHandlers(
    io: Server,
    socket: Socket,
    identity: ChatIdentity
): void {
    let stopMembershipRecheck = (): void => undefined;

    socket.on("join_ride", async (data: RidePayload | undefined) => {
        try {
            if (!hasValidRidePayload(data) || data.rideId !== identity.rideId) {
                sendError(socket, "You cannot join this ride room");
                return;
            }

            if (!(await hasChatAccess(identity))) {
                revokeSocketAccess(
                    socket,
                    identity.rideId,
                    "You are no longer a member of this ride"
                );
                return;
            }

            await socket.join(roomName(identity.rideId));
            stopMembershipRecheck();
            stopMembershipRecheck = startMembershipRecheck(socket, identity);

            socket.emit("joined_ride", {
                roomId: roomName(identity.rideId)
            });
        } catch (error) {
            sendError(socket, "Unable to join the ride room");
            console.error("Join ride error:", error);
        }
    });

    socket.on("get_messages", async (data: RidePayload | undefined) => {
        try {
            if (!hasValidRidePayload(data) || data.rideId !== identity.rideId) {
                sendError(socket, "Invalid ride room");
                return;
            }

            if (!(await hasChatAccess(identity))) {
                revokeSocketAccess(
                    socket,
                    identity.rideId,
                    "You are no longer a member of this ride"
                );
                return;
            }

            socket.emit("messages", await getRecentMessages(identity.rideId));
        } catch (error) {
            sendError(socket, "Unable to load messages");
            console.error("Load messages error:", error);
        }
    });

    socket.on("send_message", async (data: RidePayload | undefined) => {
        try {
            if (!hasValidRidePayload(data) || data.rideId !== identity.rideId) {
                sendError(socket, "Invalid ride room");
                return;
            }

            if (!(await hasChatAccess(identity))) {
                revokeSocketAccess(
                    socket,
                    identity.rideId,
                    "You are no longer a member of this ride"
                );
                return;
            }

            if (!socket.rooms.has(roomName(identity.rideId))) {
                sendError(socket, "Join the ride room first");
                return;
            }

            const message = await createMessage(identity, data.text);
            io.to(roomName(identity.rideId)).emit("new_message", message);
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Unable to send message";

            sendError(socket, message);
            console.error("Send message error:", error);
        }
    });

    socket.on("disconnect", () => {
        stopMembershipRecheck();
    });
}
