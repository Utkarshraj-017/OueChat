import "dotenv/config";

function readPositiveInteger(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] || String(fallback), 10);

    return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const env = {
    port: readPositiveInteger("PORT", 4000),
    frontendOrigin: process.env.FRONTEND_URL || "http://localhost:5173",
    chatMongoUri: process.env.CHAT_MONGODB_URI || "",
    rideBackendUrl: (process.env.RIDE_BACKEND_URL || "http://localhost:5000")
        .replace(/\/$/, ""),
    chatTokenSecret: process.env.CHAT_TOKEN_SECRET || "",
    chatServiceSecret: process.env.CHAT_SERVICE_SECRET || "",
    membershipRecheckIntervalMs: readPositiveInteger(
        "CHAT_MEMBERSHIP_RECHECK_INTERVAL_MS",
        15000
    )
};

export function validateEnvironment(): void {
    const required: Array<[string, string]> = [
        ["CHAT_MONGODB_URI", env.chatMongoUri],
        ["CHAT_TOKEN_SECRET", env.chatTokenSecret],
        ["CHAT_SERVICE_SECRET", env.chatServiceSecret],
        ["RIDE_BACKEND_URL", env.rideBackendUrl]
    ];

    const missing = required
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }
}
