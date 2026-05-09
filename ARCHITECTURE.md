# Architecture

## High-level

```
 ┌──────────────────────┐       WebSocket       ┌──────────────────────┐
 │  Client (React+R3F)  │ ◄───────────────────► │   Realtime Server    │
 │  - Top-down map      │   events (JSON)       │   (Express + ws)     │
 │  - Agent sprites     │                       │   - Room state       │
 │  - Chat / inspector  │                       │   - Event fan-out    │
 └──────────────────────┘                       └──────────┬───────────┘
                                                           │
                                            in-process     │
                                                           ▼
                                                ┌──────────────────────┐
                                                │  Agent Harness (pi)  │
                                                │  open-source pkg     │
                                                │     ↓                │
                                                │   GPT-5.5 (OpenAI)   │
                                                └──────────────────────┘

 ┌──────────────────────┐
 │  Assets (GPT-image-2)│  → static `/assets/` (tileset, sprites, items)
 └──────────────────────┘
```

## Components

### Client (`/client`)
- React + Vite, Three.js via `@react-three/fiber` for the world view (orthographic camera = top-down).
- HUD overlay: agent list, spawn dialog, per-agent inspector (transcript + "send message" input).
- Connects to server via a single WebSocket; receives the world snapshot on join, then incremental events.
- Renders agent state visually:
  - **idle** — sprite stands still
  - **working** — small progress ring + walk cycle toward "workshop" tile
  - **stuck** — `?` bubble above head, color-shifted sprite
  - **done** — sparkle / flag planted

### Server (`/server`)
- Node + Express; WebSocket server (`ws` or Socket.IO).
- Authoritative room state: users, agents, map. In-memory for hackathon (single process).
- Bridges agent harness ↔ clients: turns `pi` events (in-process) into game events, broadcasts to the room.
- Optional: persist room snapshots to `room.json` on shutdown so reload survives a crash.

### Agent harness (pi — open-source package)
- `pi` is imported directly into the server process (or spawned as a child process per agent if it exposes a CLI). **No API key, no hosted endpoint, no webhooks.**
- One agent = one pi instance/task, identified by an internal `agentId`. The server keeps a handle/reference (or child-process pid) per agent, not a remote task ID.
- pi emits events/output via callbacks, an event emitter, or stdout (TBD once we read its docs) → server adapter turns them into `agent.update` and `agent.transcript` events broadcast over WS. **No polling needed.**
- The agent's underlying model is GPT-5.5 — the only external dependency is `OPENAI_API_KEY`.
- Agent prompt scaffold = task description + user-supplied guidance turns. User `agent.message` events are forwarded into pi as additional user turns on the live conversation.

### Asset generation (`/assets-gen`)
- One-shot script: prompts → GPT-image-2 → PNGs → `/client/public/assets/`.
- Targets:
  - `tiles/` — grass, stone, water, workshop, road (small tile sprite sheet)
  - `chars/` — 4-direction or single top-down sprite per agent archetype
  - `items/` — flag, hammer, scroll, etc.
- Run once before dev; can be re-run to refresh theme.

## Data model

```ts
type AgentStatus = 'idle' | 'working' | 'stuck' | 'done' | 'error';

type Agent = {
  id: string;
  ownerId: string;          // user who spawned it
  name: string;
  sprite: string;           // /assets/chars/...
  position: { x: number; y: number };
  status: AgentStatus;
  task: string;             // initial prompt
  progress?: number;        // 0..1 for working
  lastMessage?: string;     // most recent agent output (preview)
  transcript: TranscriptEntry[];
  // pi handle lives server-side only (not serialized over WS) — e.g. a Map<agentId, PiInstance>
};

type TranscriptEntry =
  | { role: 'agent'; text: string; ts: number }
  | { role: 'user'; userId: string; text: string; ts: number }
  | { role: 'system'; text: string; ts: number };

type User = { id: string; name: string; color: string };

type Room = {
  id: string;
  map: { width: number; height: number; tiles: number[][] };
  users: Record<string, User>;
  agents: Record<string, Agent>;
};
```

## WebSocket protocol

All messages are `{ type, payload, ts }`.

**Client → Server**
- `join` — `{ roomId, userName }`
- `agent.spawn` — `{ task, name? }`
- `agent.message` — `{ agentId, text }` (user nudges/answers the agent)
- `agent.cancel` — `{ agentId }`

**Server → Client**
- `room.snapshot` — full room state on join
- `user.join` / `user.leave`
- `agent.created` — full Agent
- `agent.update` — partial `{ agentId, ...patch }` (status, position, progress, lastMessage)
- `agent.transcript` — `{ agentId, entry }` appended
- `error` — `{ message }`

## Concurrency model

- Server owns state; clients render from event stream. No client-side authoritative writes.
- Agent → server updates are throttled (max ~2/s per agent) before fan-out.
- Multiple users in one room see the same world; each agent is owned by whoever spawned it but anyone can send `agent.message`.

## Why these choices

- **WebSocket over HTTP polling** — visible agent activity needs sub-second updates.
- **In-memory state** — hackathon timescale. Add Redis/SQLite only if multi-process is needed.
- **Three.js (current pick)** — flexible if we want shader effects / 3D-ish polish.
  - **Alternative: Phaser 3** — recommended fallback if rendering takes >2h. Phaser ships with tilemaps, sprite animation, and tweens. Three.js makes you build all of that.
- **pi (open-source)** — gives us a tested agent loop (tool use, multi-turn, model calls) without writing our own. Runs in-process on our server, so events arrive synchronously via callbacks/emitter — no polling, no auth, no webhook URL to expose. Trade-off: agent compute lives on our server, so concurrency is bounded by our process.

## Out of scope (hackathon)

- Auth (use a name + room code)
- Persistence beyond a JSON snapshot
- Pathfinding (agents teleport or use straight-line tween)
- Mobile layout
