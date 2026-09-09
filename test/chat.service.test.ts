import assert from "node:assert/strict";
import test from "node:test";
import Message from "../src/models/message.model.js";
import { getRecentMessages } from "../src/services/chat.service.js";

test("getRecentMessages queries the latest 100 and returns display order", async () => {
    const newestFirst = Array.from({ length: 100 }, (_, index) => {
        const messageNumber = 119 - index;

        return {
            _id: { toString: () => `message-${messageNumber}` },
            rideId: "ride1",
            senderId: "user-1",
            text: `message ${messageNumber}`,
            createdAt: new Date(2026, 0, 1, 0, 0, messageNumber)
        };
    });
    let sortValue: unknown;
    let limitValue: unknown;
    const originalFind = Message.find;

    Object.defineProperty(Message, "find", {
        configurable: true,
        value: () => ({
            sort(value: unknown) {
                sortValue = value;
                return this;
            },
            limit(value: unknown) {
                limitValue = value;
                return this;
            },
            lean: async () => newestFirst
        })
    });

    try {
        const messages = await getRecentMessages("ride1");

        assert.deepEqual(sortValue, { createdAt: -1 });
        assert.equal(limitValue, 100);
        assert.equal(messages.length, 100);
        assert.equal(messages[0]?.id, "message-20");
        assert.equal(messages.at(-1)?.id, "message-119");
        assert.equal(messages[0]?.rideId, "ride1");
    } finally {
        Object.defineProperty(Message, "find", {
            configurable: true,
            value: originalFind
        });
    }
});
