import jwt, { JwtPayload } from "jsonwebtoken";
import { Socket } from "socket.io";
import { env } from "../config/env.js";
import { ChatIdentity, ChatRole } from "../types/chat.types.js";

export function readChatIdentity(socket: Socket): ChatIdentity {
    const token = socket.handshake.auth?.chatToken;

    if (typeof token !== "string" || !env.chatTokenSecret) {
        throw new Error("Chat authentication failed");
    }

    const decoded = jwt.verify(token, env.chatTokenSecret, {
        audience: "ouechat"
    });

    if (typeof decoded === "string") {
        throw new Error("Invalid chat token");
    }

    const payload = decoded as JwtPayload;
    const role = payload.role as ChatRole;

    if (
        typeof payload.sub !== "string" ||
        typeof payload.rideId !== "string" ||
        !["creator", "passenger"].includes(role)
    ) {
        throw new Error("Invalid chat token");
    }

    return {
        userId: payload.sub,
        rideId: payload.rideId,
        role
    };
}
