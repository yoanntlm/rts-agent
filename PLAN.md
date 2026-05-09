# Hackathon plan — 1 day

Goal by end of day: 2+ developers in the same room, each spawning agents that visibly work on coding tasks (in real Daytona sandboxes), with the ability to inspect transcripts and send guidance when an agent is stuck.

## Demo script (target)

1. Two devs join `room/demo`.
2. Dev A spawns "build a Fibonacci function in Python and run pytest on it" → character walks to workshop tile, progress ring fills.
3. Agent posts intermediate output (file written, tests running) → preview floats above sprite.
4. Dev B spawns "refactor the README in this repo" → second character.
5. Agent gets stuck → `?` bubble appears. Dev A clicks it, types a hint, agent resumes.
6. Both agents finish → flags planted, transcripts viewable, sandboxes cleaned up.

## Workstreams (parallelizable across teammates)

| Stream | Owner | Deliverable | Files |
|---|---|---|---|
| **A. Game view** | Person 1 (Frontend) | Tilemap renders, sprite walks, status overlays | `/client/**` |
| **B. Convex schema + mutations** | Person 2 (Convex/data) | Schema, all queries & mutations, indexes | `/convex/**` |
| **C. Agent runner** | Person 3 (Integrations) | Node process: subscribes to unclaimed agents, runs pi, sandboxes, writes back | `/agent-runner/**` |
| **D. Asset gen** | Person 3 (background) | One-shot script producing tiles + chars | `/assets-gen/**` |
| **E. UX glue** | Person 1 (after A) | Spawn dialog, inspector panel, chat input | `/client/**` |

Critical path: **A + B**. C unblocks the demo (real agents instead of fake data). D runs in background.

**Cross-cutting deliverable in H0:** the Convex schema. It's the contract between all three streams — Person 1 binds React components to its types, Person 3 reads/writes its tables. Lock it together first.

## Hour-by-hour (≈10h day)

**H0 — Kickoff (45m, all together)**
- Walk through `ARCHITECTURE.md`. Lock the **Convex schema** (`convex/schema.ts`) — this is the contract.
- Lock the **pi event → AgentStatus mapping table** (placeholder, refine after spike).
- Decide on Daytona integration shape: where in pi do we plug it as the executor? (Person 3 will spike this.)
- Spin up a shared Convex deployment via `npx convex dev`. Drop `VITE_CONVEX_URL` in a shared note.
- Person 3 starts the **pi + Daytona spike** in a scratch file: spawn one pi agent that runs `echo hello` inside a Daytona sandbox. Validates the two riskiest unknowns at once. **Don't move past H1 until this works or we've decided to mock pi as a CLI subprocess.**

**H1 — Scaffolding (1h)**
- Monorepo: `pnpm` workspaces for `/client`, `/agent-runner`, `/assets-gen`. `/convex` lives at root (Convex convention).
- Person 2: `convex/schema.ts` deployed; one trivial `agents.list` query and `agents.spawn` mutation written.
- Person 1: Vite + React boots; Convex client wired (`ConvexProvider`); `useQuery(api.agents.list, { roomId })` returns an empty array.
- **Smoke test:** Person 1 inserts an `agents` row via the Convex dashboard → Person 1's UI renders it in two open tabs. Loop is alive end-to-end without any of our code.

**H2 — Game view skeleton (1h, Person 1)**
- R3F orthographic scene. Render a hardcoded 20×20 tile grid (colored squares OK).
- Render a sprite per agent at `agent.position`, driven by `useQuery`.
- **Hard timer:** if no sprite-on-tiles by H2 + 45min, swap to Phaser 3. Person 3 helps cut over (they'll be waiting on pi anyway).

**H2 (parallel) — Agent runner skeleton (1h, Person 3, after spike)**
- `/agent-runner/index.ts`: connect via `ConvexClient` (Node SDK), subscribe to the `unclaimed` index. Log each new agent.
- Claim flow: on new unclaimed agent, mutation `agents.claim(agentId)` sets `runnerSpawnedAt`.
- Person 2: writes `agents.claim` + a fake `agents.tickStatus` that the runner can call to demo updates.

**H3 — Fake-agent end-to-end (1h)**
- Runner doesn't yet call pi. Instead: on claim, simulate progress by mutating status `idle → working → stuck → done` over 10s, with progress ticks. Append fake transcript lines.
- Client renders the status changes as visual states (icon overlays, color shift).
- **Real end-to-end loop alive.** This is the most important milestone of the day. If H3 doesn't land, descope features but keep this loop.

**H4 — Real pi + Daytona (2h, Person 3)**
- Replace the fake simulator with: `pi` instance + Daytona sandbox per claimed agent.
- Hook pi's events/callbacks (or stdout) → translate to Convex mutations (`agents.update`, `transcript.append`).
- Sandbox lifecycle: `daytona.create()` on claim, `daytona.delete()` on done/error/cancel.
- Person 2: writes the mutations the runner needs (`agents.update`, `transcript.append`, `agents.markDone`).
- Person 1: inspector panel — click sprite → side panel queries `transcript.byAgent(agentId)` → live-updating list. `transcript.userMessage` mutation on submit.

**H5 — Stuck detection + chat-back (1h)**
- Define "stuck": pi waiting on input, OR `lastActivityAt` > 30s while `status === "working"`. Convex scheduled function (every 5s) handles the timer-based half.
- Runner subscribes to undelivered user-turn entries (`undelivered_user_turns` index) and forwards them to the live pi conversation; marks `deliveredToPiAt`.
- Visual: bubble over sprite, color shift.

**H6 — Asset swap-in + start deploy (1h)**
- Person 3: replace colored tiles with generated PNGs from `/client/public/assets/`.
- **Deploy in parallel, don't wait for H8:**
  - Convex: already deployed.
  - Client: `pnpm --filter client build` → Vercel/Netlify, set `VITE_CONVEX_URL`.
  - Agent runner: Railway or Fly. Set `CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `OPENAI_API_KEY`, `DAYTONA_API_KEY`.
- Verify a spawn-from-prod-UI lights up the deployed runner.

**H7 — Multi-user polish (1h)**
- Test 2+ tabs / 2+ devs in the same room. User color avatars. Agent ownership badge.
- Coalesce noisy mutations from the runner (e.g., debounce `lastMessage` to 1 update / 250ms).
- Add an "agent died" recovery (runner restart should requeue claimed-but-incomplete agents — bump `runnerSpawnedAt: undefined` if `lastActivityAt` > 2 min).

**H8 — Demo prep (1.5h)**
- Pre-bake one impressive task that succeeds 3 runs in a row. Document the exact prompt.
- Record a fallback screen recording **early in this slot**, not last.
- Stop coding 30 min before demo. Last-minute changes break things.

## De-risk list (in priority order)

1. **pi event surface unknown.** First thing Person 3 does in H0: install pi, spawn one agent with a trivial prompt, log every event/callback. Build the status mapping from observed events — don't guess. Fallback: spawn Claude/Gemini CLI as a subprocess, parse stdout.
2. **Daytona integration shape into pi.** Same H0 spike: confirm pi exposes a hook for a custom executor (env, exec callback, etc.). If not, adapt by running pi *inside* the sandbox via subprocess. Decide before H4.
3. **Three.js + tiles eats time.** Phaser 3 fallback at H2 + 45 min. Don't sink another hour into R3F.
4. **gpt-image-2 latency / quota.** Run asset gen in a separate terminal early; ship colored squares if it stalls.
5. **Convex schema rework mid-day.** Lock it in H0 with all three people present. Schema migrations during a hackathon hurt — adding fields is cheap, restructuring is expensive.
6. **Daytona sandbox quota / API auth.** Smoke test the API key in H0 spike. $200 credit is plenty for the day.
7. **OpenAI rate limits.** With 5+ concurrent agents calling GPT-5.5, you may hit RPM limits. Add a small per-agent token budget cap and a backoff.

## Stretch (only if everything above lands)

- Pathfinding (A* on tile grid) instead of straight-line tween
- Agent-to-agent collaboration (one spawns another)
- Persistent rooms with shareable codes
- Sound effects on status changes
- Multi-runner pool (schema already supports unclaimed-index multiple consumers)
