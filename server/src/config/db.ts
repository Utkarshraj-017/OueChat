import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
    if (!env.chatMongoUri) {
        throw new Error("CHAT_MONGODB_URI is required");
    }

    await mongoose.connect(env.chatMongoUri);
    console.log("ouechat MongoDB connected");
}
