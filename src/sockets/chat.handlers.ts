import { Server, Socket } from "socket.io";
import { env } from "../config/env.js";
import {
    ChatIdentity,
    RidePayload,
    StoredMessage
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

export interface ChatHandlerDependencies {
    hasChatAccess: (rideId: string, userId: string) => Promise<boolean>;
    getRecentMessages: (rideId: string) => Promise<StoredMessage[]>;
    createMessage: (
        rideId: string,
        userId: string,
        text: unknown
    ) => Promise<StoredMessage>;
}

const defaultDependencies: ChatHandlerDependencies = {
    hasChatAccess,
    getRecentMessages,
    createMessage
};

function readRideId(data: RidePayload | undefined): string | null {
    if (!data || typeof data.rideId !== "string") {
        return null;
    }

    const rideId = data.rideId.trim();
    return rideId.length > 0 ? rideId : null;
}

function revokeRideAccess(
    socket: Socket,
    rideId: string,
    message: string,
    joinedRideIds: Set<string>
): void {
    sendError(socket, message);
    socket.emit("chat_access_revoked", { rideId, message });
    socket.leave(roomName(rideId));
    joinedRideIds.delete(rideId);
}

function startMembershipRecheck(
    socket: Socket,
    identity: ChatIdentity,
    joinedRideIds: Set<string>,
    checkAccess: ChatHandlerDependencies["hasChatAccess"]
): () => void {
    let checking = false;

    const timer = setInterval(() => {
        if (joinedRideIds.size === 0) {
            clearInterval(timer);
            return;
        }

        if (checking || socket.disconnected) {
            return;
        }

        checking = true;
        const rideIds = [...joinedRideIds];

        void Promise.all(
            rideIds.map(async (rideId) => {
                try {
                    const allowed = await checkAccess(
                        rideId,
                        identity.userId
                    );

                    if (!allowed && joinedRideIds.has(rideId)) {
                        revokeRideAccess(
                            socket,
                            rideId,
                            "Your access to this ride chat has been revoked",
                            joinedRideIds
                        );
                    }
                } catch (error) {
                    // A temporary ride-backend failure should not revoke
                    // every active room. Chat actions still validate access.
                    const message = error instanceof Error
                        ? error.message
                        : "Unknown membership error";
                    console.error(
                        `Membership recheck error for ${rideId}:`,
                        message
                    );
                }
            })
        ).finally(() => {
            checking = false;
        });
    }, env.membershipRecheckIntervalMs);

    return () => clearInterval(timer);
}

export function registerChatHandlers(
    io: Server,
    socket: Socket,
    identity: ChatIdentity,
    dependencies: ChatHandlerDependencies = defaultDependencies
): void {
    const joinedRideIds = new Set<string>();
    let stopMembershipRecheck = (): void => undefined;

    socket.on("join_ride", async (data: RidePayload | undefined) => {
        try {
            const rideId = readRideId(data);

            if (!rideId) {
                sendError(socket, "A valid ride ID is required");
                return;
            }

            if (!(await dependencies.hasChatAccess(rideId, identity.userId))) {
                revokeRideAccess(
                    socket,
                    rideId,
                    "You are not a member of this ride",
                    joinedRideIds
                );
                return;
            }

            await socket.join(roomName(rideId));
            joinedRideIds.add(rideId);

            if (joinedRideIds.size === 1) {
                stopMembershipRecheck();
                stopMembershipRecheck = startMembershipRecheck(
                    socket,
                    identity,
                    joinedRideIds,
                    dependencies.hasChatAccess
                );
            }

            socket.emit("joined_ride", {
                rideId,
                roomId: roomName(rideId)
            });
        } catch (error) {
            sendError(socket, "Unable to join the ride room");
            console.error("Join ride error:", error);
        }
    });

    socket.on("leave_ride", async (data: RidePayload | undefined) => {
        try {
            const rideId = readRideId(data);

            if (!rideId) {
                sendError(socket, "A valid ride ID is required");
                return;
            }

            await socket.leave(roomName(rideId));
            joinedRideIds.delete(rideId);

            if (joinedRideIds.size === 0) {
                stopMembershipRecheck();
                stopMembershipRecheck = (): void => undefined;
            }

            socket.emit("left_ride", { rideId });
        } catch (error) {
            sendError(socket, "Unable to leave the ride room");
            console.error("Leave ride error:", error);
        }
    });

    socket.on("get_messages", async (data: RidePayload | undefined) => {
        try {
            const rideId = readRideId(data);

            if (!rideId) {
                sendError(socket, "A valid ride ID is required");
                return;
            }

            if (!(await dependencies.hasChatAccess(rideId, identity.userId))) {
                revokeRideAccess(
                    socket,
                    rideId,
                    "You are not a member of this ride",
                    joinedRideIds
                );
                return;
            }

            if (!socket.rooms.has(roomName(rideId))) {
                sendError(socket, "Join the ride room first");
                return;
            }

            const messages = await dependencies.getRecentMessages(rideId);
            socket.emit("messages", { rideId, messages });
        } catch (error) {
            sendError(socket, "Unable to load messages");
            console.error("Load messages error:", error);
        }
    });

    socket.on("send_message", async (data: RidePayload | undefined) => {
        try {
            const rideId = readRideId(data);

            if (!rideId) {
                sendError(socket, "A valid ride ID is required");
                return;
            }

            if (!(await dependencies.hasChatAccess(rideId, identity.userId))) {
                revokeRideAccess(
                    socket,
                    rideId,
                    "You are not a member of this ride",
                    joinedRideIds
                );
                return;
            }

            if (!socket.rooms.has(roomName(rideId))) {
                sendError(socket, "Join the ride room first");
                return;
            }

            const message = await dependencies.createMessage(
                rideId,
                identity.userId,
                data?.text
            );
            io.to(roomName(rideId)).emit("new_message", message);
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
