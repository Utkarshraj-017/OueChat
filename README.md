# OueChat

OueChat is the chat microservice used by ride-based applications. The
repository keeps the backend and the future standalone frontend separate:

```text
OueChat/
├── server/    TypeScript, Express, MongoDB, and Socket.IO backend
└── client/    Frontend application (to be built)
```

## Backend documentation

Read [`server/README.md`](server/README.md) for the complete backend
documentation, including:

- Environment variables and local setup
- Ride-backend membership contract
- Chat-token requirements
- Socket.IO connection and event payloads
- Deployment and reverse-proxy requirements
- Security rules and troubleshooting

## Start the backend locally

```powershell
cd server
npm install
```

Create `server/.env` using the configuration described in
[`server/README.md`](server/README.md), then run:

```powershell
npm run dev
```

The backend exposes its health check at:

```text
GET http://localhost:4000/health
```

Never commit `server/.env` or expose its secrets to the frontend.
