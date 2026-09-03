# OueChat backend

OueChat is a standalone TypeScript chatroom microservice for ride-based
applications. It owns chat messages and Socket.IO connections. It does not
own ride, booking, user, or membership data and never connects to the ride
application's MongoDB database.

The ride backend remains the source of truth for access. OueChat asks the
ride backend to validate membership before a user can join a ride room, load
messages, or send a message.

## Chat integration flow

The chat UI may be part of a consuming app's frontend, while OueChat runs as
a separate chat microservice. The integration works in this order:

```text
1. Frontend → Ride backend
   POST /api/chat/rides/:rideId/session
   Authorization: Bearer <ride-app-token>

2. Ride backend
   - Verifies the logged-in user
   - Checks the user's ride membership
   - Creates a short-lived chatToken

3. Frontend → OueChat
   - Opens a Socket.IO connection using chatToken

4. OueChat
   - Verifies the chatToken signature using CHAT_TOKEN_SECRET
   - Checks token expiry, audience, user ID, and ride ID
   - Calls the ride backend internally:
     POST /api/chat/membership/validate

5. Ride backend
   - Validates the current membership, ride status, and blacklist status
   - Returns allowed: true or allowed: false

6. OueChat
   - Allows the user to join the ride room only when allowed is true
   - Revalidates membership before loading or sending messages
```

The frontend must never call the internal membership endpoint directly. It
only requests a chat session from the ride backend and uses the returned
chatToken to connect to OueChat.

## Architecture

```text
Consuming app frontend
        |
        | 1. Request a chat session from its trusted backend
        v
Ride backend / membership authority
        |
        | 2. Return a short-lived chat token
        v
OueChat backend  <---->  OueChat MongoDB
        |
        | 3. Validate membership before chat actions
        v
Ride backend internal membership endpoint
```

The current OueChat backend is a single independently deployable service:

```text
server/
├── src/app.ts                         Express application
├── src/server.ts                      HTTP and Socket.IO startup
├── src/config/db.ts                   MongoDB connection
├── src/models/message.model.ts        Message schema
├── src/services/rideBackend.service.ts
└── src/sockets/chat.socket.ts         Socket.IO events and authorization
```

## Requirements

- Node.js `20.19.0` or newer
- npm
- MongoDB for OueChat messages
- A trusted ride backend that implements the membership contract below

The service uses Express, TypeScript, Mongoose, Socket.IO, and Node's built-in
`fetch`. It does not require Redis.

## Configuration

Create a local `.env` file from the configuration example below. Do not
commit this file because it contains secrets:

```powershell
npm install
New-Item .env -ItemType File
```

Set these values in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP and Socket.IO port. Defaults to `4000`. |
| `FRONTEND_URL` | Yes | Exact browser origin allowed to call OueChat. Example: `http://localhost:5173`. |
| `CHAT_MONGODB_URI` | Yes | MongoDB connection string for chat messages. |
| `RIDE_BACKEND_URL` | Yes | Base URL of the ride backend, without the `/api/chat` path. Example: `http://localhost:5000`. |
| `CHAT_TOKEN_SECRET` | Yes | Must match the secret used by the trusted backend to sign chat tokens. |
| `CHAT_SERVICE_SECRET` | Yes | Must match the secret accepted by the ride backend's internal membership endpoint. |

Example:

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
CHAT_MONGODB_URI=mongodb://127.0.0.1:27017/ouechat
RIDE_BACKEND_URL=http://localhost:5000
CHAT_TOKEN_SECRET=replace-with-a-long-random-secret
CHAT_SERVICE_SECRET=replace-with-a-different-long-random-secret
```

Security requirements:

- Never commit `.env` or expose either secret to a browser.
- `CHAT_TOKEN_SECRET` must be identical in OueChat and the trusted backend
  that issues chat tokens.
- `CHAT_SERVICE_SECRET` must be identical in OueChat and the ride backend.
- Keep the MongoDB instance private; only OueChat should access its chat DB.
- `FRONTEND_URL` is a CORS setting, not an authorization mechanism. Every
  chat action is authorized server-side.

## Run the service

Development mode:

```powershell
npm run dev
```

Production build and start:

```powershell
npm run build
npm start
```

Health check:

```http
GET /health
```

Example:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

Response:

```json
{
  "service": "ouechat",
  "status": "ok"
}
```

## Ride backend contract

OueChat does not authenticate users against the ride database directly. A
trusted backend must provide these two endpoints.

### 1. Create a chat session

The consuming application's authenticated frontend calls its ride backend:

```http
POST /api/chat/rides/:rideId/session
Authorization: Bearer <ride-app-access-token>
```

The ride backend must verify that the current user is an active member of the
ride. For the VITravels backend, the ride creator and users with a confirmed
booking are allowed while the ride is active, in the future, and the user is
not blacklisted.

Successful response:

```json
{
  "roomId": "ride:665abc123456789012345678",
  "rideId": "665abc123456789012345678",
  "userId": "665def123456789012345678",
  "role": "creator",
  "chatToken": "<short-lived-jwt>",
  "expiresAt": "2026-01-01T12:05:00.000Z"
}
```

The current VITravels backend issues tokens with a five-minute lifetime.
`403` means the user cannot access the chat and `404` means the ride does not
exist.

### 2. Validate membership internally

OueChat calls this endpoint before joining a room, loading messages, and
sending a message:

```http
POST /api/chat/membership/validate
Content-Type: application/json
x-chat-service-secret: <CHAT_SERVICE_SECRET>
```

Request body:

```json
{
  "rideId": "665abc123456789012345678",
  "userId": "665def123456789012345678"
}
```

Allowed response:

```json
{
  "allowed": true,
  "role": "passenger",
  "rideStatus": "active",
  "bookingStatus": "confirmed"
}
```

The response must include `allowed: true` for OueChat to continue. The
endpoint must reject incorrect or missing service credentials. OueChat treats
ride backend `403` and `404` responses as denied membership.

`RIDE_BACKEND_URL` is combined with the fixed path
`/api/chat/membership/validate`, so configure it as a base URL without a
trailing API path.

## Chat token contract

The token is sent only from a trusted backend to the browser and then to
OueChat through the Socket.IO handshake. OueChat verifies:

```json
{
  "sub": "<userId>",
  "rideId": "<rideId>",
  "role": "creator | passenger",
  "aud": "ouechat",
  "exp": "<expiry timestamp>"
}
```

The signing secret is `CHAT_TOKEN_SECRET`. The browser must not mint or edit
this token. A token is scoped to one ride; the socket rejects attempts to use
it with another ride ID.

## Socket.IO client integration

Install the matching Socket.IO client major version in the consuming
frontend:

```powershell
npm install socket.io-client
```

Connect with the session token returned by the ride backend:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  auth: {
    chatToken
  }
});
```

Join the ride room:

```ts
socket.emit("join_ride", { rideId });
socket.on("joined_ride", ({ roomId }) => {
  console.log(`Joined ${roomId}`);
});
```

Load recent messages:

```ts
socket.emit("get_messages", { rideId });
socket.on("messages", (messages) => {
  console.log(messages);
});
```

Send a message:

```ts
socket.emit("send_message", {
  rideId,
  text: "Hello"
});
```

Listen for new messages and errors:

```ts
socket.on("new_message", (message) => {
  console.log(message);
});

socket.on("chat_error", ({ message }) => {
  console.error(message);
});
```

### Events

| Direction | Event | Payload or result |
| --- | --- | --- |
| Client to server | `join_ride` | `{ rideId }` |
| Server to client | `joined_ride` | `{ roomId }` |
| Client to server | `get_messages` | `{ rideId }` |
| Server to client | `messages` | Array of stored messages |
| Client to server | `send_message` | `{ rideId, text }` |
| Server to room | `new_message` | `{ id, rideId, senderId, text, createdAt }` |
| Server to client | `chat_error` | `{ message }` |

Current limits:

- Messages are trimmed and limited to 1,000 characters.
- `get_messages` returns at most the latest 100 messages, ordered oldest to
  newest.
- A user must join the room before sending a message.
- Membership is revalidated before every join, read, and send operation.

The room name is derived by the server as `ride:<rideId>`. Clients should use
the `roomId` returned by `joined_ride` for display only and must not attempt to
choose arbitrary room names.

## Deployment

Deploy `server` as its own service with its own process, environment, and
MongoDB database:

```text
Ride backend:  https://api.example.com
OueChat:       https://chat-api.example.com
Chat frontend: https://chat.example.com
```

Production configuration should use:

```env
PORT=4000
FRONTEND_URL=https://chat.example.com
CHAT_MONGODB_URI=<private-production-chat-mongodb-uri>
RIDE_BACKEND_URL=https://api.example.com
CHAT_TOKEN_SECRET=<production-secret>
CHAT_SERVICE_SECRET=<production-service-secret>
```

The reverse proxy must forward both normal HTTP requests and WebSocket
upgrade requests to the same OueChat service. The chat frontend origin must
match `FRONTEND_URL` exactly.

The current implementation stores messages in MongoDB but keeps Socket.IO
room state in the running process. Run it as a single instance unless a future
Socket.IO adapter and a deliberate multi-instance strategy are added.

## Integration checklist

Before connecting a new application, confirm:

1. The application has a trusted backend that can verify its own user and ride
   membership.
2. That backend issues tokens containing `sub`, `rideId`, and `role`, signed
   with the OueChat `CHAT_TOKEN_SECRET` and audience `ouechat`.
3. OueChat can reach the backend's membership endpoint using
   `CHAT_SERVICE_SECRET`.
4. The chat frontend origin is configured in `FRONTEND_URL`.
5. The frontend requests a new chat session instead of placing a token in a
   URL or storing it permanently.
6. The frontend handles `chat_error`, disconnects, and token expiry.

If another application uses a different user or ride system, it must expose a
membership endpoint with the same behavior or add a trusted adapter. OueChat
must never be given direct access to that application's database.

## Troubleshooting

- Startup fails with `CHAT_MONGODB_URI is required`: add the variable to
  `.env`.
- Socket authentication fails: confirm `CHAT_TOKEN_SECRET`, token audience
  `ouechat`, token expiry, and required claims.
- Joining or sending fails with a membership error: verify
  `RIDE_BACKEND_URL`, `CHAT_SERVICE_SECRET`, the endpoint path, ride status,
  and the user's active membership.
- Browser CORS errors: set `FRONTEND_URL` to the exact scheme, host, and port
  used by the chat frontend.
- Messages do not reach clients after horizontal scaling: the current service
  is single-instance and has no cross-instance Socket.IO adapter.
