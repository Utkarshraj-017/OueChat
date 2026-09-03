# ouechat

Minimal TypeScript chatroom microservice for VITravels.

## Setup

```bash
npm install
Copy-Item .env.example .env
```

Set the values in `.env`, especially:

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
CHAT_MONGODB_URI=<chat-service-mongodb-uri>
RIDE_BACKEND_URL=http://localhost:5000
CHAT_TOKEN_SECRET=<same-value-as-ride-backend>
CHAT_SERVICE_SECRET=<same-value-as-ride-backend>
```

Run in development:

```bash
npm run dev
```

Build and run:

```bash
npm run build
npm start
```

Health check:

```text
GET http://localhost:4000/health
```

## Socket.IO events

Connect with the short-lived token returned by the ride backend:

```js
io("http://localhost:4000", {
    auth: { chatToken }
});
```

Join a ride:

```js
socket.emit("join_ride", { rideId });
```

Load recent messages:

```js
socket.emit("get_messages", { rideId });
```

Send a message:

```js
socket.emit("send_message", { rideId, text });
```

Listen for messages:

```js
socket.on("new_message", (message) => {
    console.log(message);
});
```

The service checks membership with the ride backend before joining and before
sending messages. It never accesses the ride backend MongoDB directly.
