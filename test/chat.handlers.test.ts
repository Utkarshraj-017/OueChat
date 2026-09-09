import assert from "node:assert/strict";
import test from "node:test";
import type { Server, Socket } from "socket.io";
import { registerChatHandlers } from "../src/sockets/chat.handlers.js";
import type { ChatIdentity, StoredMessage } from "../src/types/chat.types.js";

type EventHandler = (...args: any[]) => unknown;

class FakeSocket {
    readonly rooms = new Set<string>();
    readonly emitted: Array<{ event: string; payload: unknown }> = [];
    readonly handlers = new Map<string, EventHandler>();
    disconnected = false;

    on(event: string, handler: EventHandler): this {
        this.handlers.set(event, handler);
        return this;
    }

    emit(event: string, payload?: unknown): boolean {
        this.emitted.push({ event, payload });
        return true;
    }

    async join(room: string): Promise<void> {
        this.rooms.add(room);
    }

    async leave(room: string): Promise<void> {
        this.rooms.delete(room);
    }

    async trigger(event: string, payload?: unknown): Promise<void> {
        await this.handlers.get(event)?.(payload);
    }

    messages(event: string): unknown[] {
        return this.emitted
            .filter((entry) => entry.event === event)
            .map((entry) => entry.payload);
    }
}

class FakeIo {
    readonly sockets: FakeSocket[] = [];

    to(room: string): { emit: (event: string, payload: unknown) => void } {
        return {
            emit: (event, payload) => {
                for (const socket of this.sockets) {
                    if (socket.rooms.has(room)) {
                        socket.emit(event, payload);
                    }
                }
            }
        };
    }
}

function identity(): ChatIdentity {
    return {
        userId: "user-1",
        expiresAt: Date.now() + 60_000
    };
}

function message(rideId: string, text = "hello"): StoredMessage {
    return {
        id: `${rideId}-message`,
        rideId,
        senderId: "user-1",
        text,
        createdAt: new Date()
    };
}

function dependencies(allowedRides: Set<string>) {
    const accessChecks: Array<{ rideId: string; userId: string }> = [];

    return {
        accessChecks,
        hasChatAccess: async (rideId: string, userId: string) => {
            accessChecks.push({ rideId, userId });
            return allowedRides.has(rideId);
        },
        getRecentMessages: async (rideId: string) => [message(rideId)],
        createMessage: async (
            rideId: string,
            userId: string,
            text: unknown
        ) => ({
            ...message(rideId, String(text)),
            senderId: userId
        })
    };
}

test("one socket can join multiple authorized rides", async () => {
    const socket = new FakeSocket();
    const io = new FakeIo();
    const deps = dependencies(new Set(["ride1", "ride2"]));
    io.sockets.push(socket);

    registerChatHandlers(
        io as unknown as Server,
        socket as unknown as Socket,
        identity(),
        deps
    );

    await socket.trigger("join_ride", { rideId: "ride1" });
    await socket.trigger("join_ride", { rideId: "ride2" });

    assert.deepEqual([...socket.rooms].sort(), ["ride:ride1", "ride:ride2"]);
    assert.deepEqual(socket.messages("joined_ride"), [
        { rideId: "ride1", roomId: "ride:ride1" },
        { rideId: "ride2", roomId: "ride:ride2" }
    ]);
    assert.deepEqual(deps.accessChecks, [
        { rideId: "ride1", userId: "user-1" },
        { rideId: "ride2", userId: "user-1" }
    ]);

    await socket.trigger("disconnect");
});

test("a non-member cannot join and each operation checks the requested ride", async () => {
    const socket = new FakeSocket();
    const io = new FakeIo();
    const deps = dependencies(new Set(["ride1"]));
    io.sockets.push(socket);

    registerChatHandlers(
        io as unknown as Server,
        socket as unknown as Socket,
        identity(),
        deps
    );

    await socket.trigger("join_ride", { rideId: "ride1" });
    await socket.trigger("get_messages", { rideId: "ride1" });
    await socket.trigger("send_message", { rideId: "ride1", text: "hello" });
    await socket.trigger("join_ride", { rideId: "ride2" });

    assert.deepEqual(socket.messages("messages"), [
        { rideId: "ride1", messages: [message("ride1")] }
    ]);
    assert.deepEqual(socket.messages("chat_access_revoked"), [
        { rideId: "ride2", message: "You are not a member of this ride" }
    ]);
    assert.deepEqual(deps.accessChecks, [
        { rideId: "ride1", userId: "user-1" },
        { rideId: "ride1", userId: "user-1" },
        { rideId: "ride1", userId: "user-1" },
        { rideId: "ride2", userId: "user-1" }
    ]);

    await socket.trigger("disconnect");
});

test("leave_ride removes only that room and prevents future sends there", async () => {
    const socket = new FakeSocket();
    const io = new FakeIo();
    const deps = dependencies(new Set(["ride1", "ride2"]));
    io.sockets.push(socket);

    registerChatHandlers(
        io as unknown as Server,
        socket as unknown as Socket,
        identity(),
        deps
    );

    await socket.trigger("join_ride", { rideId: "ride1" });
    await socket.trigger("join_ride", { rideId: "ride2" });
    await socket.trigger("leave_ride", { rideId: "ride1" });
    await socket.trigger("send_message", { rideId: "ride1", text: "blocked" });

    assert.equal(socket.rooms.has("ride:ride1"), false);
    assert.equal(socket.rooms.has("ride:ride2"), true);
    assert.deepEqual(socket.messages("left_ride"), [{ rideId: "ride1" }]);
    assert.deepEqual(socket.messages("chat_error").at(-1), {
        message: "Join the ride room first"
    });

    await socket.trigger("disconnect");
});

test("a user cannot send before joining the requested room", async () => {
    const socket = new FakeSocket();
    const io = new FakeIo();
    const deps = dependencies(new Set(["ride1"]));
    io.sockets.push(socket);

    registerChatHandlers(
        io as unknown as Server,
        socket as unknown as Socket,
        identity(),
        deps
    );

    await socket.trigger("send_message", { rideId: "ride1", text: "blocked" });

    assert.deepEqual(socket.messages("chat_error"), [
        { message: "Join the ride room first" }
    ]);
    assert.equal(socket.messages("new_message").length, 0);
    await socket.trigger("disconnect");
});

test("all sockets in a ride room receive that ride's messages", async () => {
    const io = new FakeIo();
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const otherRideSocket = new FakeSocket();
    const firstDeps = dependencies(new Set(["ride1"]));
    const secondDeps = dependencies(new Set(["ride1"]));
    const otherRideDeps = dependencies(new Set(["ride2"]));
    io.sockets.push(firstSocket, secondSocket, otherRideSocket);

    registerChatHandlers(
        io as unknown as Server,
        firstSocket as unknown as Socket,
        identity(),
        firstDeps
    );
    registerChatHandlers(
        io as unknown as Server,
        secondSocket as unknown as Socket,
        identity(),
        secondDeps
    );
    registerChatHandlers(
        io as unknown as Server,
        otherRideSocket as unknown as Socket,
        identity(),
        otherRideDeps
    );

    await firstSocket.trigger("join_ride", { rideId: "ride1" });
    await secondSocket.trigger("join_ride", { rideId: "ride1" });
    await otherRideSocket.trigger("join_ride", { rideId: "ride2" });
    await firstSocket.trigger("send_message", { rideId: "ride1", text: "hello" });

    assert.equal(firstSocket.messages("new_message").length, 1);
    assert.equal(secondSocket.messages("new_message").length, 1);
    assert.equal(otherRideSocket.messages("new_message").length, 0);
    assert.deepEqual(firstSocket.messages("new_message"), secondSocket.messages("new_message"));

    await firstSocket.trigger("disconnect");
    await secondSocket.trigger("disconnect");
    await otherRideSocket.trigger("disconnect");
});
