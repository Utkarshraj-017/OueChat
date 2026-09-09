import assert from "node:assert/strict";
import test from "node:test";
import type { Socket } from "socket.io";
import { enforceTokenLifetime } from "../src/sockets/chat.socket.js";

class ExpiringSocket {
    disconnected = false;
    readonly emitted: Array<{ event: string; payload: unknown }> = [];
    private disconnectHandler: (() => void) | undefined;

    emit(event: string, payload?: unknown): boolean {
        this.emitted.push({ event, payload });
        return true;
    }

    disconnect(): void {
        this.disconnected = true;
        this.disconnectHandler?.();
    }

    once(event: string, handler: () => void): this {
        if (event === "disconnect") {
            this.disconnectHandler = handler;
        }

        return this;
    }

    use(): this {
        return this;
    }
}

test("disconnects a socket when its token expires", async () => {
    const socket = new ExpiringSocket();

    enforceTokenLifetime(
        socket as unknown as Socket,
        Date.now() + 20
    );

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(socket.disconnected, true);
    assert.deepEqual(socket.emitted, [
        { event: "chat_error", payload: { message: "Chat token expired" } }
    ]);
});
