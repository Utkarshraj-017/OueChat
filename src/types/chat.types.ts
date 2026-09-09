export interface ChatIdentity {
    userId: string;
    /** JWT exp converted from epoch seconds to epoch milliseconds. */
    expiresAt: number;
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
