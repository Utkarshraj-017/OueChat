# OueChat

OueChat is the chat microservice used by ride-based applications. The
repository contains the independently deployable backend service:

```text
OueChat/
├── src/       TypeScript, Express, MongoDB, and Socket.IO backend
├── package.json
└── BACKEND.md Detailed backend integration and operations documentation
```

## Backend documentation

Read [`BACKEND.md`](BACKEND.md) for the complete backend
documentation, including:

- Environment variables and local setup
- Ride-backend membership contract
- Chat-token requirements
- Socket.IO connection and event payloads
- Deployment and reverse-proxy requirements
- Security rules and troubleshooting

## Start the backend locally

```powershell
npm install
```

Create `.env` using the configuration described in
[`BACKEND.md`](BACKEND.md), then run:

```powershell
npm run dev
```

The backend exposes its health check at:

```text
GET http://localhost:4000/health
```

Never commit `.env` or expose its secrets to a consuming frontend.
