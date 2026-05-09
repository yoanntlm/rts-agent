# Hackathon plan — 1 day

Goal by end of day: 2+ developers in the same room, each spawning agents that visibly work on coding tasks, with the ability to inspect transcripts and send guidance when an agent is stuck.

## Demo script (target)

1. Two devs join `room/demo`.
2. Dev A spawns "build a Fibonacci function in Python" → character walks to workshop tile, progress ring fills.
3. Agent posts intermediate output → preview floats above sprite.
4. Dev B spawns "refactor this README" with a stub repo → second character.
5. Agent gets stuck → `?` bubble appears. Dev A clicks it, sends a hint, agent resumes.
6. Both agents finish → flags planted, transcripts viewable.

## Workstreams (parallelizable across teammates)

| Stream | Owner | Deliverable |
|---|---|---|
| **A. Game view** | Frontend | Tilemap renders, sprite walks, status overlays |
| **B. Realtime spine** | Backend | WS server, room state, event protocol |
| **C. Agent harness** | Backend | `pi` package integration, status normalization |
| **D. Asset gen** | Anyone | One-shot script producing tiles + chars |
| **E. UX glue** | Frontend | Spawn dialog, inspector panel, chat input |

Streams A+B are the critical path. C unblocks the demo. D can run in background. E lands last.

## Hour-by-hour (≈10h day)

**H0 — Kickoff (30m)**
- Agree on event names (this doc), claim streams, set up repo branches.

**H1 — Scaffolding (1h)**
- `pnpm` workspace: `/client`, `/server`, `/shared`.
- Vite + React boots; Express boots; WebSocket echo round-trips a `ping`.
- Shared TS types for events.

**H2 — Game view skeleton (1h, Stream A)**
- R3F orthographic scene. Render a hardcoded 20×20 tile grid (colored squares OK).
- One placeholder sprite at `(5,5)`.

**H3 — Realtime spine (1h, Stream B, parallel with H2)**
- Room object in memory. `join` → snapshot. Broadcast on any state change.
- Hardcode a fake agent that emits `agent.update` every second (status transitions).
- Client subscribes, sprite moves accordingly. **End-to-end loop alive.**

**H4 — Agent spawn UX + real pi agent (2h, Streams C+E)**
- Spawn dialog → `agent.spawn` over WS → server instantiates a `pi` agent in-process with `task` as prompt.
- Hook into pi's events/callbacks (or stdout if subprocess) → translate to `agent.update` + `agent.transcript`. No polling.
- Status mapping table: pi event → AgentStatus.
- Client inspector: click sprite → side panel shows transcript + input.

**H5 — Stuck detection + chat-back (1h)**
- Define "stuck" heuristic: pi waiting on input, or no output for 30s while running.
- `agent.message` → forward as a user turn into the live pi agent conversation.
- Visual: bubble over sprite, color shift.

**H6 — Asset pass (1h, Stream D, can have run earlier)**
- Generate 8–12 tiles + 3 character sprites + 2 items via gpt-image-2.
- Drop into `/client/public/assets/`, swap colored squares for tiles.

**H7 — Multi-user polish (1h)**
- Test 2+ tabs in the same room. Show user cursors or avatars.
- Throttle update fan-out, fix any race conditions.

**H8 — Demo prep (1.5h)**
- Pre-bake one impressive task that works reliably.
- Deploy: client to Vercel/Netlify, server to Railway/Fly.
- Record a fallback screen recording in case live demo flakes.

## De-risk list

- **pi event/callback surface unknown until we read its docs.** First spike (Person 3 in H0): install pi, spawn one agent with a trivial prompt, capture every event/callback it emits, write down the names + payloads. Build the status mapping from that observed surface — don't guess. If pi turns out to be a poor fit, fall back to spawning Claude/Gemini CLI as a subprocess and parsing stdout.
- **Three.js + tiles eats time.** If H2 isn't done by end of H2 budget, cut to Phaser 3. Don't sink another hour into R3F.
- **gpt-image-2 latency / quota.** Run asset gen in a separate terminal early; ship colored squares if it stalls.
- **WS state divergence with multiple users.** Server-authoritative + full snapshot on reconnect. Don't try to be clever with deltas.

## Stretch (only if everything above lands)

- Pathfinding (A* on tile grid) instead of straight-line tween
- Agent-to-agent collaboration (one spawns another)
- Persistent rooms with shareable codes
- Sound effects on status changes
