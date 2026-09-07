export type ChatRole = "creator" | "passenger";

export interface ChatIdentity {
    userId: string;
    rideId: string;
    role: ChatRole;
}

export interface RidePayload {
    rideId?: unknown;
    text?: unknown;
}

export interface StoredMessage {
    id: string;
    rideId: string;
    senderId: string;
    text: string;
    createdAt: Date;
}
