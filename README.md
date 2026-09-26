# Astro Race

A real-time astronomy quiz race for 2–4 players. One Node server serves the browser client and synchronizes game rooms over Socket.IO.

## Run locally

Requires Node.js 20 or later.

```sh
npm install
npm start
```

Open `http://localhost:3000`. For a second device on the same Wi-Fi, open the host computer's local network address on port 3000. Public play uses the deployed URL.

## Deploy publicly

Create a Render **Web Service** from this folder. Use `npm install` as the build command and `npm start` as the start command. Set Node 20 or newer and use one instance. Share the resulting HTTPS URL; WebSockets are upgraded automatically. The room code lets friends join the same server.

## Multiplayer and room model

The server is authoritative. It creates short room codes, validates room joins and capacity, owns turn order and the 20-second question timer, checks answers, applies movement/penalties, limits power-up inventory to two each, and broadcasts the current room snapshot to all connected room members. The client sends only player choices and renders server snapshots.

Each in-memory room contains a code, status, players (`id`, name, ship, progress, power-up inventory, connection state), turn index, question and deadline, last event, winner, and final rankings. Questions are selected and graded on the server. `/health` reports service status. Wrong answers leave progress unchanged and shorten the player's next question timer by five seconds; a Shield blocks that penalty.

## Current deployment boundary

Room state is in memory, so a server restart clears rooms; run one server instance. This is suitable for a lightweight first public release. Durable rooms or multiple instances need shared storage (for example Redis/Postgres) plus a Socket.IO adapter and reconnect identity tokens.

