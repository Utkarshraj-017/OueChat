import jwt, { JwtPayload } from "jsonwebtoken";
import { Socket } from "socket.io";
import { env } from "../config/env.js";
import { ChatIdentity } from "../types/chat.types.js";

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

    if (
        typeof payload.sub !== "string" ||
        payload.sub.trim().length === 0 ||
        typeof payload.exp !== "number" ||
        !Number.isFinite(payload.exp) ||
        payload.exp <= Math.floor(Date.now() / 1000) ||
        payload.scope !== "chat"
    ) {
        throw new Error("Invalid chat token");
    }

    return {
        userId: payload.sub,
        expiresAt: payload.exp * 1000
    };
}
