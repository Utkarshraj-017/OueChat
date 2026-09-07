import { env } from "../config/env.js";

interface MembershipResponse {
    allowed: boolean;
}

export async function validateMembership(
    rideId: string,
    userId: string
): Promise<boolean> {
    const backendUrl = env.rideBackendUrl;
    const serviceSecret = env.chatServiceSecret;

    if (!serviceSecret) {
        throw new Error("CHAT_SERVICE_SECRET is required");
    }

    const response = await fetch(
        `${backendUrl}/api/chat/membership/validate`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-chat-service-secret": serviceSecret
            },
            body: JSON.stringify({ rideId, userId })
        }
    );

    if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
            return false;
        }

        throw new Error(`Ride backend returned ${response.status}`);
    }

    const result = await response.json() as MembershipResponse;
    return result.allowed === true;
}
