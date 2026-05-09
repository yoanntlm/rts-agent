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
/characters      Preset character definitions (.md, frontmatter + system prompt body)
ARCHITECTURE.md
PLAN.md
UI.md
```

## Quick start

```bash
# 1. Install (one time)
pnpm install

# 2. Provision Convex (one time — interactive, creates a dev deployment under your account)
cd convex && npx convex dev
# Follow the prompts. When it says "deployment ready", note the URL it prints.
# It also writes a CONVEX_URL line — copy that into client/.env.local and agent-runner/.env.
# Leave `npx convex dev` running in this terminal — it watches the schema/functions.

# 3. In a second terminal: client
cp client/.env.local.example client/.env.local   # then paste VITE_CONVEX_URL=<from step 2>
pnpm dev:client                                   # opens http://localhost:5173

# 4. In a third terminal: agent runner (fake-progress simulator until H4)
cp agent-runner/.env.example agent-runner/.env    # paste CONVEX_URL=<from step 2>
pnpm dev:runner
```

You can run the client BEFORE step 2 — it renders the layout in preview mode with a setup banner. Spawning an agent requires steps 2–4.

### Env vars (cheat sheet)

```
client/.env.local
  VITE_CONVEX_URL=https://...

agent-runner/.env
  CONVEX_URL=https://...
  # H4: OPENAI_API_KEY, DAYTONA_API_KEY

assets-gen/.env
  OPENAI_API_KEY=...      # GPT-image-2
```

> `pi` is an in-process package on the agent runner — no separate API key.
> Convex auto-generates TS types in `convex/_generated/`; both `client` and `agent-runner` import them via the `@convex/*` path alias. The committed files in `_generated/` are placeholders that work for builds before `npx convex dev` runs — Convex overwrites them on first run.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — components, data flow, Convex schema
- [PLAN.md](./PLAN.md) — hackathon hour-by-hour plan
- [UI.md](./UI.md) — UI layout, character roster, drag-to-spawn workflow, visual states
