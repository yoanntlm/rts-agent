# rts-agent

Multiplayer agent orchestration with an RTS-style top-down view. Spawn coding agents as in-world characters, watch their progress, intervene when they get stuck — collaboratively, with other developers in the same room.

Built for a 1-day hackathon.

## Stack

- **Client** — React + Vite + Three.js (top-down tilemap, sprites for agents)
- **Server** — Node + Express + WebSocket (realtime orchestration & shared state)
- **Agent harness** — `pi` (open-source package, runs locally on the server — no hosted service / API key). Agents powered by GPT-5.5.
- **Assets** — generated via GPT-image-2 (tilesets, character sprites, items)

> Hackathon note: Three.js works for 2D top-down but is heavy for tilemaps. If timeline slips, swap to **Phaser 3** or **PixiJS** — purpose-built for tile-based games and will reclaim several hours. See `ARCHITECTURE.md`.

## Repo layout (planned)

```
/client      React + Vite app, game view + chat panel
/server      Express + WS, agent orchestration
/assets-gen  Script/playground for GPT-image-2 generation
/shared      Shared types (events, agent state)
/docs        ARCHITECTURE.md, PLAN.md
```

## Quick start

```bash
# install
pnpm install

# dev (client + server)
pnpm dev
```

Env vars (`.env`):

```
OPENAI_API_KEY=...      # for GPT-5.5 (agents) and GPT-image-2 (asset gen)
PORT=3001
```

> `pi` is an in-process package on the server — no separate API key.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — components, data flow, protocol
- [PLAN.md](./PLAN.md) — hackathon hour-by-hour plan
