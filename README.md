# rts-agent

Multiplayer agent orchestration with an RTS-style top-down view. Spawn coding agents as in-world characters, watch their progress, intervene when they get stuck — collaboratively, with other developers in the same room.

Built for a 1-day hackathon.

## Stack

- **Client** — React + Vite + Three.js (top-down tilemap, sprites for agents)
- **Backend / DB / realtime** — [Convex](https://www.convex.dev/) — reactive DB with built-in client subscriptions; replaces a custom WebSocket server
- **Agent runner** — separate Node process that hosts `pi` agents in-memory and writes updates to Convex via mutations
- **Agent harness** — [`pi`](https://pi.dev) (open-source package, runs in-process on the agent runner — no hosted service / API key). Agents powered by GPT-5.5
- **Sandbox** — [Daytona](https://www.daytona.io/) — one shared cloud sandbox per room, used as `pi`'s bash execution backend so agents can collaborate on the same files and running app
- **Assets** — generated via GPT-image-2 (tilesets, character sprites, items)

> Hackathon note: Three.js works for 2D top-down but is heavy for tilemaps. If timeline slips, swap to **Phaser 3** or **PixiJS** — purpose-built for tile-based games and will reclaim several hours. See `ARCHITECTURE.md`.

## Repo layout (planned)

```
/client          React + Vite app, game view + HUD/inspector
/convex          Schema + queries + mutations (Convex convention)
/agent-runner    Node process: pi instances + shared Daytona room sandboxes; writes to Convex
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
#    Run from the REPO ROOT, not from /convex. Convex looks for convex/ as a subdir.
npx convex dev
# Follow the prompts. When it says "deployment ready", note the URL it prints.
# It also writes a CONVEX_URL line — copy that into client/.env.local and agent-runner/.env.
# Leave `npx convex dev` running in this terminal — it watches the schema/functions.

# 3. In a second terminal: client
cp client/.env.local.example client/.env.local   # then paste VITE_CONVEX_URL=<from step 2>
pnpm dev:client                                   # opens http://localhost:5173

# 4. In a third terminal: agent runner
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
  OPENAI_API_KEY=...      # or ANTHROPIC_API_KEY
  DAYTONA_API_KEY=...     # optional; without it bash runs in a host tempdir

assets-gen/.env
  OPENAI_API_KEY=...      # GPT-image-2
```

> `pi` is an in-process package on the agent runner — no separate API key.
> Convex auto-generates TS types in `convex/_generated/`; both `client` and `agent-runner` import them via the `@convex/*` path alias. The committed files in `_generated/` are placeholders that work for builds before `npx convex dev` runs — Convex overwrites them on first run.

## Shared sandbox model

The runner creates or reuses **one Daytona sandbox per Convex room**, not one sandbox per agent.
The sandbox id and port-3000 preview URL are stored on the `rooms` row, so later agents in the same room reattach to the same Linux workspace.

Agents still have separate `pi` sessions and separate prompts, but their `bash` tool points at the same persistent sandbox. This lets a Backend agent create `server.js`, a Frontend agent edit `public/app.js`, a Tester agent add `tests/*.test.js`, and a DevOps agent update `package.json` without losing state between runs.

Current limitation: only `bash` is routed into Daytona. The built-in `read`, `write`, `edit`, `ls`, `find`, and `grep` tools still operate on a local tempdir, so the runner prompt tells agents to do persistent file work through `bash` heredocs and shell commands.

## Assets

Promoted terrain tiles in `client/public/assets/generated/` are app assets and should be committed so every collaborator and deployment sees the same map art. The image playground output in `client/public/assets/playground/` stays ignored because it is per-developer iteration scratch.

If you generate new candidate art in `/playground`, use the promote action to copy the selected PNG into `client/public/assets/generated/`, then commit that promoted tile. Do not commit the playground library unless there is a specific reason to preserve an experiment.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — components, data flow, Convex schema
- [PLAN.md](./PLAN.md) — hackathon hour-by-hour plan
- [UI.md](./UI.md) — UI layout, character roster, drag-to-spawn workflow, visual states
