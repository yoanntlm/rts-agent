# LeagueCode

> **Live demo:** https://leaguecode.yoanntlm.com

Collaborative coding agents presented as an RTS-style control room. A user opens a room, spawns specialist agents onto a shared world map, watches them work in realtime, steers them through chat, and previews the software they build inside a shared cloud sandbox.

Built for the AI Engineer Hackathon Singapore, 9 May 2026.

## Try It Now

**👉 https://leaguecode.yoanntlm.com**

Open the link, hit **Spawn agent**, give it a software task, and watch it build. Share the URL bar with a teammate to land in the same room and collaborate live.

## What Judges Should See

1. Open a room URL and share it with teammates. Everyone sees the same map, users, agents, transcript, and project preview.
2. Click **Spawn agent**, pick or create a specialist, and describe a software task.
3. The agent appears on the map, walks to a construction site, and starts working.
4. The runner claims the agent from Convex, starts a `pi` coding-agent session, and uses GPT-5.5 for the reasoning/model loop.
5. All shell work runs in the room's shared Daytona sandbox, so agents collaborate on the same files.
6. The UI shows live status, tool activity, transcript updates, preview URLs, and a read-only project file browser.
7. When work is accepted, the construction site can turn into a Singapore landmark on the shared world.

## Hackathon Track Fit

- **OpenAI / Codex: GPT-5.5** - the agent runner uses the `pi` coding-agent harness with GPT-5.5 as the first-choice model for spawned software agents.
- **OpenAI / Codex: GPT-image-2** - GPT-image-2 generated the map tiles, character sprites, construction-site art, animation frames, and playground/avatar assets used by the site.
- **Convex** - Convex is the main database and realtime layer: rooms, users, agents, transcripts, shared maps, sandbox ids, and preview URLs are all stored there.
- **Daytona** - one persistent Daytona sandbox is created per room and reused by every agent in that room as the shared execution workspace.

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Three.js, `@react-three/fiber`
- **Realtime backend:** Convex queries, mutations, schema, and generated client types
- **Agent runner:** Node.js, TypeScript, `tsx`, Convex Node/browser client
- **Agent harness:** `@earendil-works/pi-coding-agent`, model preference starting with OpenAI GPT-5.5
- **Sandbox:** Daytona SDK, shared Linux workspace per room, public preview links for common dev-server ports
- **Image generation:** OpenAI GPT-image-2 through `/assets-gen` scripts and the dev image playground
- **Deployment:** live at https://leaguecode.yoanntlm.com — static Vite build served by Caddy on a VPS, runner running under systemd alongside

## Architecture

```
Browser UI (React + Three.js)
  - room map, agents, inspector, worldbuilder, file viewer
  - Convex subscriptions keep every user in sync
        |
        v
Convex
  - rooms, users, agents, transcripts, room maps
  - sandbox id + live preview URLs per room
        ^
        |
Agent Runner (Node)
  - watches unclaimed agents
  - starts pi coding-agent sessions
  - streams status/tool/transcript updates back to Convex
        |
        v
pi + GPT-5.5  --->  Daytona room sandbox
                    - /home/daytona/project
                    - shared by all agents in the room
                    - previewed on ports 3000, 5173, 8000, 8080
```

Convex is the source of truth. The browser and runner do not talk directly; they coordinate through reactive Convex state.

## Repo Layout

```
/client          React/Vite app: world, HUD, inspector, playground, editor
/convex          Convex schema, queries, mutations, generated API stubs
/agent-runner    Node runner: pi sessions, Daytona sandbox bridge, file API
/assets-gen      GPT-image-2 asset scripts for tiles, avatars, buildings
/characters      Preset agent character prompts
/deploy          Caddy and VPS deployment helpers
ARCHITECTURE.md  More detailed runtime/data-flow notes
PLAN.md          Hackathon implementation plan
UI.md            Product/UI notes
```

## Quick Start

```bash
pnpm install

# Terminal 1: Convex
npx convex dev

# Terminal 2: client
cp client/.env.local.example client/.env.local
# set VITE_CONVEX_URL from Convex output
pnpm dev:client

# Terminal 3: agent runner
cp agent-runner/.env.example agent-runner/.env
# set CONVEX_URL, OPENAI_API_KEY, and optionally DAYTONA_API_KEY
pnpm dev:runner
```

The client can render without Convex configured, but spawning real agents requires Convex plus the runner.

## Environment

```bash
client/.env.local
VITE_CONVEX_URL=https://...

agent-runner/.env
CONVEX_URL=https://...
OPENAI_API_KEY=...      # GPT-5.5 through pi
DAYTONA_API_KEY=...     # shared room sandbox; without it bash falls back to host tempdir

assets-gen/.env
OPENAI_API_KEY=...      # GPT-image-2 asset generation
```

`pi` is an in-process package used by the runner. It does not need its own hosted service key.

## Shared Assets And Rooms

- Room state is shared through Convex. `/r/<room>` joins the same world; `/r/<room>/editor` edits that room's map.
- **Apply to room** writes worldbuilder changes to Convex so every connected user sees the same map.
- Promoted terrain tiles in `client/public/assets/generated/` are committed app assets.
- Saved playground images in `client/public/assets/playground/` are also shared through git when committed with their `.prompt.txt` and `.params.json` sidecars.
- Building animation assets live in `client/public/assets/buildings/animations/`.

## Useful Commands

```bash
pnpm build
pnpm --filter ./client typecheck
pnpm --filter ./agent-runner typecheck
pnpm --filter ./assets-gen typecheck
pnpm assets:buildings
pnpm assets:animate-building -- --only=construction-zone-3x3 --force
```

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) - runtime architecture and data flow
- [PLAN.md](./PLAN.md) - hackathon build plan
- [UI.md](./UI.md) - interface and interaction notes
