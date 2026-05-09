# Architecture

`rts-agent` is a multiplayer control room for coding agents. The game-like UI is only the interface; the core system is a realtime agent orchestration loop backed by Convex, GPT-5.5, `pi`, and Daytona.

## System Diagram

```
+-------------------------------------------------------------------+
| Browser: React + Vite + Three.js                                  |
| - RTS world map, agent sprites, construction/monument sprites      |
| - Spawn dialog, live inspector, transcript, preview links          |
| - Worldbuilder and GPT-image playground                           |
+---------------------------+---------------------------------------+
                            | Convex queries + mutations
                            v
+-------------------------------------------------------------------+
| Convex                                                            |
| - Database and realtime subscriptions                             |
| - rooms, users, agents, transcript                                |
| - shared room maps, Daytona sandbox id, live preview URLs          |
+---------------------------+---------------------------------------+
                            | runner watches unclaimed agents
                            v
+-------------------------------------------------------------------+
| Agent Runner: Node + TypeScript                                   |
| - Claims agent rows from Convex                                   |
| - Starts one pi coding-agent session per spawned agent             |
| - Streams status, progress, tool calls, and final diffs to Convex  |
| - Runs a small read-only file API for the sandbox project browser  |
+---------------------------+---------------------------------------+
                            | model/tool loop
                            v
+-------------------------+       +---------------------------------+
| pi coding-agent harness |       | Daytona room sandbox            |
| - OpenAI GPT-5.5 first  | bash  | - /home/daytona/project         |
| - fallback models exist +------>| - one sandbox per Convex room   |
| - user follow-ups       |       | - shared by all room agents     |
+-------------------------+       | - preview ports 3000/5173/8000/8080
                                  +---------------------------------+

+-------------------------------------------------------------------+
| Asset pipeline                                                    |
| GPT-image-2 -> /client/public/assets/ tiles, avatars, buildings    |
+-------------------------------------------------------------------+
```

Convex is the source of truth. The browser never calls the runner directly for agent state, and the runner never pushes directly into browser sessions. Both sides coordinate through Convex.

## Runtime Flow

1. **Room join:** the browser routes `/r/<slug>` to a Convex room. Users join with a local identity and heartbeat into `users`.
2. **Spawn:** the client inserts an `agents` row with `runnerSpawnedAt: undefined`, a character prompt, sprite, task, position, destination, and workshop tile.
3. **Claim:** the runner subscribes to `agents.listUnclaimed`, claims the row, and starts a `pi` session for that agent.
4. **Model loop:** `pi` selects the first available model from the preference list, with OpenAI GPT-5.5 first. The agent gets its character system prompt plus the user's task.
5. **Sandbox execution:** the runner overrides `pi`'s bash tool so shell commands execute in the room's Daytona sandbox. All agents in the room share `/home/daytona/project`.
6. **Realtime updates:** model text, tool calls, progress, status, and transcript entries are written to Convex. Every connected browser updates through subscriptions.
7. **Preview:** the runner asks Daytona for preview links, probes common dev-server ports, and stores only live URLs on the room document.
8. **Inspect:** the runner exposes a local read-only file API. Caddy proxies `/api/code/*` so the browser can show the current sandbox project tree.
9. **Follow-up:** user messages in the inspector are inserted into `transcript`; the runner polls undelivered user turns and sends them back into the live `pi` session.

## Main Components

### Client (`/client`)

- React 18 + Vite + TypeScript.
- Three.js via `@react-three/fiber` for the top-down map, animated buildings, monuments, and agent sprites.
- Convex React hooks for realtime room, user, agent, and transcript state.
- Routes:
  - `/r/<room>`: main collaborative room.
  - `/r/<room>/editor`: shared worldbuilder for that room.
  - `/playground`: GPT-image asset playground in dev.
  - `/preview`: animation preview/debug page.
- UI surfaces:
  - spawn dialog and custom avatar flow,
  - live transcript/inspector,
  - preview URL dropdown,
  - read-only project file browser,
  - shared room map editor.

### Convex (`/convex`)

Convex provides both storage and realtime delivery.

Key tables:

- `rooms`: room name, map tiles, Daytona sandbox id, preview URLs.
- `users`: room user identity, color, last heartbeat.
- `agents`: character, task, sprite, position, status, progress, sandbox id, workshop/monument state.
- `transcript`: agent/user/system messages and delivery markers for runner follow-ups.

Important mutations/queries:

- `rooms.getOrCreate`, `rooms.applyMap`, `rooms.setSandbox`, `rooms.setPreviewUrls`
- `agents.spawn`, `agents.claim`, `agents.update`, `agents.finishTask`, `agents.listUnclaimed`
- `transcript.append`, `transcript.userMessage`, `transcript.undeliveredUserTurns`, `transcript.markDelivered`

### Agent Runner (`/agent-runner`)

The runner is a long-lived Node process because Convex functions are not meant to host stateful, multi-turn agent sessions.

Responsibilities:

- subscribe to unclaimed agents and claim them exactly once,
- create or reattach the room's Daytona sandbox,
- keep a long-lived Daytona shell session so background dev servers survive across tool calls,
- start `pi` coding-agent sessions,
- translate `pi` events into Convex updates,
- capture per-agent git diffs from `/home/daytona/project`,
- keep a follow-up window open after the first response,
- run the read-only file server on `127.0.0.1:4000`.

### Agent Harness (`pi` + GPT-5.5)

`pi` is used as the local coding-agent harness. It supplies the session loop, model registry, tool interface, and conversation state.

Model preference starts with:

1. `openai/gpt-5.5`
2. `openai/gpt-5.5-pro`
3. newer GPT/Codex fallbacks
4. Anthropic fallbacks if configured

The hackathon path is GPT-5.5 through `OPENAI_API_KEY`.

### Daytona Sandbox

The sandbox model is **one persistent sandbox per Convex room**, not one sandbox per agent.

Why this matters:

- agents collaborate on the same files,
- the project survives across multiple agent runs,
- preview URLs remain stable for the room,
- the demo can show a real app being built, edited, restarted, and inspected.

Current implementation detail: the runner routes `bash` into Daytona. Some built-in `pi` file tools still point at a local tempdir, so the agent prompt tells agents to do persistent work through `bash` and heredocs.

### GPT-image-2 Assets (`/assets-gen`)

GPT-image-2 is used to generate the visual language of the site:

- terrain tiles and Singapore-themed tile variants,
- preset character avatars,
- custom avatar prompt flow,
- construction-zone building art,
- construction animation sprite sheets,
- saved playground references and promoted app assets.

Generated app assets are committed under `client/public/assets/` so judges and teammates see the same visuals after pulling.

## Data Model Summary

```ts
rooms {
  name
  map: { width, height, tiles?, updatedAt? }
  sandboxId?
  previewUrl?
  previewUrls?: { port, url }[]
}

users {
  roomId
  name
  color
  lastSeenAt
}

agents {
  roomId
  ownerUserId
  characterId
  name
  sprite
  color
  systemPrompt?
  position
  destination?
  workshopTile?
  monumentImage?
  status: "idle" | "working" | "stuck" | "done" | "error"
  task
  progress?
  lastMessage?
  sandboxId?
  runnerSpawnedAt?
  lastActivityAt
}

transcript {
  agentId
  role: "agent" | "user" | "system"
  text
  userId?
  deliveredToPiAt?
}
```

## Deployment Shape

- Client builds to `client/dist`.
- Caddy serves the static SPA and falls back to `index.html`.
- Caddy proxies `/api/code/*` to the runner's local file API on port `4000`.
- Convex runs as the hosted realtime backend.
- The agent runner runs as a separate long-lived service with `CONVEX_URL`, `OPENAI_API_KEY`, and `DAYTONA_API_KEY`.

## Limitations

- No formal auth; room URLs act as lightweight access tokens for the hackathon.
- One runner process is enough for the demo, but it is the current claim/execution bottleneck.
- Only `bash` is fully sandbox-routed today; agents are instructed to avoid local `write/read/edit` for persistent work.
- GPT-image playground endpoints are dev-server middleware, not a production image API.
