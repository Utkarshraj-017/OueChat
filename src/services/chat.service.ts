import Message from "../models/message.model.js";
import { StoredMessage } from "../types/chat.types.js";
import { validateMembership } from "./rideBackend.service.js";

const MAX_MESSAGE_LENGTH = 1000;

export const roomName = (rideId: string): string => `ride:${rideId}`;

export async function hasChatAccess(
    rideId: string,
    userId: string
): Promise<boolean> {
    return validateMembership(rideId, userId);
}

export async function getRecentMessages(
    rideId: string
): Promise<StoredMessage[]> {
    const messages = await Message
        .find({ rideId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    return messages.reverse().map((message) => ({
        id: message._id.toString(),
        rideId: message.rideId,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt
    }));
}

export async function createMessage(
    rideId: string,
    userId: string,
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
        rideId,
        senderId: userId,
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
