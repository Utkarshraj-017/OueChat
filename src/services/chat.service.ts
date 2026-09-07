import Message from "../models/message.model.js";
import { ChatIdentity, StoredMessage } from "../types/chat.types.js";
import { validateMembership } from "./rideBackend.service.js";

const MAX_MESSAGE_LENGTH = 1000;

export const roomName = (rideId: string): string => `ride:${rideId}`;

export async function hasChatAccess(identity: ChatIdentity): Promise<boolean> {
    return validateMembership(identity.rideId, identity.userId);
}

export async function getRecentMessages(
    rideId: string
): Promise<StoredMessage[]> {
    const messages = await Message
        .find({ rideId })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();

    return messages.map((message) => ({
        id: message._id.toString(),
        rideId: message.rideId,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt
    }));
}

export async function createMessage(
    identity: ChatIdentity,
    text: unknown
): Promise<StoredMessage> {
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Message text is required");
    }

    const normalizedText = text.trim();

    if (normalizedText.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
            `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`
        );
    }

    const message = await Message.create({
        rideId: identity.rideId,
        senderId: identity.userId,
        text: normalizedText
    });

    return {
        id: message._id.toString(),
        rideId: message.rideId,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt
    };
}
