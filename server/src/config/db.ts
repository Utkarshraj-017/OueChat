import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
    const mongoUri = process.env.CHAT_MONGODB_URI;

    if (!mongoUri) {
        throw new Error("CHAT_MONGODB_URI is required");
    }

    await mongoose.connect(mongoUri);
    console.log("ouechat MongoDB connected");
}
