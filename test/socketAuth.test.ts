import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { readChatIdentity } from "../src/middleware/socketAuth.js";

const secret = "socket-auth-test-secret";

function socketWithToken(token: string): Socket {
    return {
        handshake: {
            auth: { chatToken: token }
        }
    } as unknown as Socket;
}

function createToken(overrides: Record<string, unknown> = {}): string {
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
        {
            sub: "user-1",
            aud: "ouechat",
            scope: "chat",
            iat: now,
            exp: now + 60,
            ...overrides
        },
        secret
    );
}

test("accepts a valid user-scoped chat token", () => {
    const identity = readChatIdentity(socketWithToken(createToken()));

    assert.equal(identity.userId, "user-1");
    assert.ok(identity.expiresAt > Date.now());
});

test("rejects a missing or invalid JWT", () => {
    assert.throws(
        () => readChatIdentity(socketWithToken("not-a-jwt")),
        /jwt malformed/
    );
});

test("rejects an expired JWT", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
        {
            sub: "user-1",
            aud: "ouechat",
            scope: "chat",
            iat: now - 120,
            exp: now - 60
        },
        secret
    );

    assert.throws(
        () => readChatIdentity(socketWithToken(token)),
        /jwt expired/
    );
});

test("rejects a token without the chat scope", () => {
    assert.throws(
        () => readChatIdentity(socketWithToken(createToken({ scope: "other" }))),
        /Invalid chat token/
    );
});
