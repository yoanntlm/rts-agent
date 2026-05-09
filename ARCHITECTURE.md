# Architecture

## High-level

```
 ┌──────────────────────┐                                   ┌──────────────────────┐
 │  Client (React+R3F)  │                                   │   Agent Runner       │
 │  - Top-down map      │                                   │   (Node process)     │
 │  - Agent sprites     │                                   │   - Hosts pi agents  │
 │  - HUD / inspector   │                                   │   - Owns sandboxes   │
 └──────────┬───────────┘                                   └──────────┬───────────┘
            │                                                          │
   useQuery │ (reactive subs)                          mutations + subs│
            ▼                                                          ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                              Convex                                         │
 │   Schema · Queries · Mutations · Reactive subscriptions · Auth (none yet)   │
 └─────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ subprocess + stdio
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  pi (open-source)    │     ┌──────────────────────┐
                          │       ↓              │ ──► │  Daytona sandbox     │
                          │   GPT-5.5 (OpenAI)   │     │  (per-agent, exec)   │
                          └──────────────────────┘     └──────────────────────┘

 ┌──────────────────────┐
 │  Assets (GPT-image-2)│  → static `/client/public/assets/` (tiles, sprites, items)
 └──────────────────────┘
```

Two processes only: the React client and the agent runner. Convex is the spine — both connect to it; they don't talk to each other directly.

## Components

### Client (`/client`)
- React + Vite + Three.js (`@react-three/fiber`, orthographic camera = top-down).
- Convex client via `useQuery` / `useMutation`. **No WebSocket code.**
- HUD overlay: agent list, spawn dialog, per-agent inspector (transcript + send-message input).
- Renders agent state visually:
  - **idle** — sprite stands still
  - **working** — progress ring + walk cycle toward "workshop" tile
  - **stuck** — `?` bubble above head, color-shifted sprite
  - **done** — sparkle / flag planted

### Convex (`/convex`)
- The DB *and* the realtime layer. Schema, queries, mutations, all in TS (see "Data model" below).
- Authoritative state for: rooms, users, agents, transcript entries.
- Push semantics: when the agent runner writes a mutation, every subscribed client re-renders within ~100ms — no fan-out code on our side.
- Replaces the originally-planned Express + WebSocket server entirely.

### Agent runner (`/agent-runner`)
- Standalone Node process (single instance for the hackathon). Connects to Convex via the [Convex Node SDK](https://docs.convex.dev/api/modules/node).
- **Subscribes** to a Convex query of unclaimed agents (`runnerSpawnedAt == null`). When a new agent appears, it claims the row (mutation), spins up a `pi` instance + Daytona sandbox, and starts the agent.
- **Subscribes** to a Convex query of new user-turn transcript entries per agent. When one appears, forwards it to the live `pi` conversation.
- **Writes** status updates, progress, transcript entries back to Convex via mutations.
- Holds non-serializable state in-memory: `Map<agentId, { pi, sandbox }>`.
- Why a separate process and not a Convex action: Convex actions have execution-time limits and aren't meant for long-running stateful loops. The agent runner is that loop.

### Agent harness (`pi` — open-source package)
- `pi` is imported by the agent runner. **No API key, no hosted endpoint, no webhooks.**
- One agent = one pi instance. Events from pi (model output, tool calls, completion) are translated by the runner into Convex mutations.
- pi's underlying model is GPT-5.5 — needs `OPENAI_API_KEY` on the runner.
- Agent prompt scaffold = task description + injected user-turn messages from `transcript`.
- Spike on day-one to confirm pi's exact event surface and how to plug a custom executor.

### Sandbox (Daytona)
- One Daytona sandbox per agent, created on agent spawn (`daytona.create()`, sub-90ms).
- Becomes pi's execution backend: shell tools (`sandbox.process.exec()`), file tools (sandbox FS API).
- Cleaned up on agent done/error/cancel (`sandbox.delete()`).
- Why: pi tool calls run *somewhere*. Without a sandbox, they run on the agent runner's host — risky (LLM-generated `rm -rf`), and concurrent agents collide on the filesystem. Daytona isolates each agent and lets the demo show real code execution safely.
- Free $200 compute is plenty for a hackathon (~$0.50/agent-hour at the published rates).

### Asset generation (`/assets-gen`)
- One-shot script: prompts → GPT-image-2 → PNGs → `/client/public/assets/`.
- Targets:
  - `tiles/` — grass, stone, water, workshop, road
  - `chars/` — top-down sprites per agent archetype
  - `items/` — flag, hammer, scroll
- Run early in the day; can re-run to refresh the theme. Colored squares are an acceptable fallback.

## Data model — Convex schema

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    name: v.string(),
    map: v.object({ width: v.number(), height: v.number() }),
  }),

  users: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    color: v.string(),
    lastSeenAt: v.number(),
  }).index("by_room", ["roomId"]),

  agents: defineTable({
    roomId: v.id("rooms"),
    ownerUserId: v.id("users"),
    name: v.string(),
    sprite: v.string(),                           // /assets/chars/...
    position: v.object({ x: v.number(), y: v.number() }),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("stuck"),
      v.literal("done"),
      v.literal("error"),
    ),
    task: v.string(),                             // initial prompt
    progress: v.optional(v.number()),             // 0..1
    lastMessage: v.optional(v.string()),          // preview floated above sprite
    sandboxId: v.optional(v.string()),            // Daytona handle
    runnerSpawnedAt: v.optional(v.number()),      // null = unclaimed; runner sets this on pickup
    lastActivityAt: v.number(),                   // for stuck heuristic
  })
    .index("by_room", ["roomId"])
    .index("unclaimed", ["runnerSpawnedAt"]),

  transcript: defineTable({
    agentId: v.id("agents"),
    role: v.union(v.literal("agent"), v.literal("user"), v.literal("system")),
    text: v.string(),
    userId: v.optional(v.id("users")),            // set when role === "user"
    deliveredToPiAt: v.optional(v.number()),      // runner marks user-turn entries after forwarding
  })
    .index("by_agent", ["agentId"])
    .index("undelivered_user_turns", ["agentId", "role", "deliveredToPiAt"]),
});
```

Keep `transcript` as its own table (not a field on `agents`) — Convex queries paginate well and clients only subscribe to the agent they're inspecting.

## Data flow

**Spawn an agent**
1. Client calls `mutation: spawnAgent({ roomId, task, name, sprite })`.
2. Convex inserts an `agents` row with `runnerSpawnedAt: undefined`.
3. Agent runner's subscription on the `unclaimed` index fires.
4. Runner claims the row (`patch { runnerSpawnedAt: Date.now() }`), creates a Daytona sandbox, instantiates `pi`, starts running.

**Agent makes progress**
1. `pi` emits an event (output chunk, tool call, status change).
2. Runner translates it to a Convex mutation: `patch agents.status/progress/lastMessage` and/or `insert transcript`.
3. All clients subscribed to that agent see the update within ~100ms.

**User talks back**
1. User types in inspector → client mutation: `insert transcript { role: "user", text }`.
2. Runner subscribed to undelivered user turns picks it up, forwards to live `pi` conversation as a user turn, marks `deliveredToPiAt`.

**Stuck detection**
- Convex scheduled function (every 5s) flips `status` to `"stuck"` for any agent in `"working"` whose `lastActivityAt` is older than 30s, *or* whose pi reports waiting on input. Runner can also set it directly.

## Concurrency model

- Convex is authoritative; clients are pure subscribers. No server-side fan-out code on our side.
- Agent runner → Convex writes are coalesced (e.g., one mutation per ~250ms per agent for `lastMessage` updates) so we don't blow Convex bandwidth on streaming token output.
- Multiple agents = multiple in-process pi instances + multiple Daytona sandboxes. Bounded by the runner's CPU/memory and OpenAI rate limits. For a hackathon demo, ~5 concurrent agents is fine on one Node process.
- Multi-user per room: free. Each user is just another Convex client; ownership of an agent is `ownerUserId` but anyone can append a user turn.

## Why these choices

- **Convex over custom Express+WS** — eliminates the entire WS protocol, fan-out, snapshot-on-join, and reconnect logic. ~1h of ship-it work avoided plus several common bug classes erased. Cost: locked into Convex's deployment, but for one day that's fine.
- **Separate agent runner** — Convex actions have execution caps; long-running multi-turn agents need a real Node process. Splitting it cleanly also means the runner can crash and restart without affecting the client UI (Convex still serves the existing data).
- **Daytona for sandboxing** — agents that execute code on the demo machine are a risk and a footgun (concurrent agents stomp on each other's files). Daytona's sub-90ms spawn means we don't pay a UX cost for isolation, and the $200 credit covers a hackathon trivially.
- **Three.js (current pick)** — flexible if we want shader effects / 3D-ish polish.
  - **Alternative: Phaser 3** — recommended fallback if rendering takes >2h. Phaser ships with tilemaps, sprite animation, and tweens out of the box.
- **pi (open-source)** — tested agent loop (tool use, multi-turn, model calls) we don't have to write. Runs in-process on the runner — events arrive synchronously via callbacks/emitter. Trade-off: compute lives on our process, so concurrency is bounded by it.

## Known limitations

- Single agent runner = single point of failure for new spawns (but the UI stays functional via Convex even if it dies).
- ~5 concurrent agents per runner before contention. Stretch: pool of runners claiming via the `unclaimed` index — already supports it.
- No auth (room code + name only). Anyone with the URL can join.
- No persistence beyond Convex's own (which is fine — Convex *is* the persistence).

## Out of scope (hackathon)

- Auth
- Pathfinding (agents teleport or use straight-line tween)
- Mobile layout
- Multi-runner orchestration (the schema supports it, but we won't deploy it)
