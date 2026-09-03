import mongoose, { Document, Model } from "mongoose";

export interface MessageDocument extends Document {
    rideId: string;
    senderId: string;
    text: string;
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new mongoose.Schema<MessageDocument>(
    {
        rideId: {
            type: String,
            required: true,
            index: true
        },
        senderId: {
            type: String,
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        }
    },
    {
        timestamps: true
    }
);

const Message: Model<MessageDocument> = mongoose.model<MessageDocument>(
    "Message",
    messageSchema
);

export default Message;
