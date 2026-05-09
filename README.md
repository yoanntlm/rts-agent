# rts-agent

Multiplayer agent orchestration with an RTS-style top-down view. Spawn coding agents as in-world characters, watch their progress, intervene when they get stuck — collaboratively, with other developers in the same room.

Built for a 1-day hackathon.

## Stack

- **Client** — React + Vite + Three.js (top-down tilemap, sprites for agents)
- **Backend / DB / realtime** — [Convex](https://www.convex.dev/) — reactive DB with built-in client subscriptions; replaces a custom WebSocket server
- **Agent runner** — separate Node process that hosts `pi` agents in-memory and writes updates to Convex via mutations
- **Agent harness** — [`pi`](https://pi.dev) (open-source package, runs in-process on the agent runner — no hosted service / API key). Agents powered by GPT-5.5
- **Sandbox** — [Daytona](https://www.daytona.io/) — one isolated cloud sandbox per agent, used as `pi`'s execution backend for shell/file tool calls (~90ms spin-up, $200 free credit)
- **Assets** — generated via GPT-image-2 (tilesets, character sprites, items)

> Hackathon note: Three.js works for 2D top-down but is heavy for tilemaps. If timeline slips, swap to **Phaser 3** or **PixiJS** — purpose-built for tile-based games and will reclaim several hours. See `ARCHITECTURE.md`.

## Repo layout (planned)

```
/client          React + Vite app, game view + HUD/inspector
/convex          Schema + queries + mutations (Convex convention)
/agent-runner    Node process: pi instances + Daytona sandboxes; writes to Convex
/assets-gen      One-shot script for GPT-image-2 generation
ARCHITECTURE.md
PLAN.md
```

## Quick start

```bash
# install
pnpm install

# Convex (interactive once, creates dev deployment)
npx convex dev          # in /convex — leaves a CONVEX_URL in client/.env.local

# dev
pnpm --filter client dev          # Vite dev server
pnpm --filter agent-runner dev    # Node watcher
```

Env vars:

```
# client/.env.local                (written by `npx convex dev`)
VITE_CONVEX_URL=https://...

# agent-runner/.env
CONVEX_URL=https://...
CONVEX_DEPLOY_KEY=...   # for the Node SDK to write
OPENAI_API_KEY=...      # GPT-5.5 (agents)
DAYTONA_API_KEY=...

# assets-gen/.env
OPENAI_API_KEY=...      # GPT-image-2
```

> `pi` is an in-process package on the agent runner — no separate API key. Convex schema-generated TS types are auto-shared between `client` and `agent-runner`, so there's no `/shared` folder.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — components, data flow, Convex schema
- [PLAN.md](./PLAN.md) — hackathon hour-by-hour plan
