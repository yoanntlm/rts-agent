// Runs a pi coding agent against a single Convex `agents` row.
//
// - Translates pi events → Convex mutations (status, progress, transcript)
// - Forwards user-turn transcript entries from Convex → live pi session
// - Optional Daytona sandboxing for bash execution (when DAYTONA_API_KEY is set)
//
// Sandboxing model (current): bash → Daytona; read/write/edit/etc. → local tempdir.
// Limitation: files written via the local read/write tools don't appear in the
// sandbox, so the agent must use bash (heredocs, cat) when files need to be
// executed. That's fine for the foundation; full per-tool sandboxing is a
// follow-up — see `createReadTool`/`createWriteTool`/etc. operations options.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConvexClient } from "convex/browser";
import {
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  createAgentSession,
  createBashTool,
  getAgentDir,
  type BashOperations,
} from "@earendil-works/pi-coding-agent";
import { Daytona, type Sandbox } from "@daytonaio/sdk";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";
import { getCharacter } from "./characters.js";
import { nearestAnchor, stepToward, workshopAnchors } from "./workshopAnchors.js";

type AgentId = Id<"agents">;

type AgentDoc = {
  _id: AgentId;
  roomId: Id<"rooms">;
  name: string;
  task: string;
  characterId: string;
  systemPrompt?: string;
  position: { x: number; y: number };
  destination?: { x: number; y: number };
};

const PROGRESS_TARGET_TOOL_CALLS = 8;

// Try newest first, fall back through generations.
const MODEL_PREFERENCE: ReadonlyArray<[string, string]> = [
  ["openai", "gpt-5.5"],
  ["openai", "gpt-5.5-pro"],
  ["openai", "gpt-5.4"],
  ["openai", "gpt-5.3-codex"],
  ["openai", "gpt-5.1-codex-max"],
  ["openai", "gpt-5"],
  ["openai", "gpt-4o"],
  ["anthropic", "claude-opus-4-5"],
  ["anthropic", "claude-sonnet-4-5"],
];

// ---- Daytona client (module-level, instantiated once if key is present)

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
const daytonaClient = DAYTONA_API_KEY ? new Daytona({ apiKey: DAYTONA_API_KEY }) : null;

if (daytonaClient) {
  console.log(
    "[runner] Daytona enabled — bash will execute in per-room sandboxes (shared across agents in the same room)",
  );
} else {
  console.log("[runner] DAYTONA_API_KEY not set — bash will execute on host tempdir");
}

// Module-level cache: roomId → resolved Sandbox instance. Avoids re-fetching
// from Daytona's API on every agent in the same room.
const roomSandboxCache = new Map<string, Sandbox>();

// ---- Public entry point

export async function runAgent(client: ConvexClient, agent: AgentDoc): Promise<void> {
  let walkTimer: ReturnType<typeof setInterval> | null = null;
  const character =
    getCharacter(agent.characterId) ??
    ({
      id: agent.characterId,
      name: agent.name,
      systemPrompt:
        agent.systemPrompt ??
        `You are ${agent.name}, a custom software teammate. Read the existing project context first, work in focused changes, and explain important tradeoffs clearly.`,
    } satisfies { id: string; name: string; systemPrompt: string });

  const cwd = mkdtempSync(join(tmpdir(), `pi-agent-${agent._id}-`));
  let sandbox: Sandbox | null = null;
  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // NOTE: we DON'T delete the sandbox — it's shared across all agents in
    // the room and persists for the lifetime of the room. Only clean tempdir.
    try {
      rmSync(cwd, { recursive: true, force: true });
    } catch {}
  };

  try {
    // 1. Pick a model
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const model = await pickModel(modelRegistry);
    if (!model) {
      await failAgent(
        client,
        agent._id,
        "No supported model with a configured API key. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in agent-runner/.env.",
      );
      return;
    }
    console.log(`[runner] ${agent.name}: using ${model.provider}/${model.id} in ${cwd}`);

    // 2. Resolve the room's persistent sandbox (create on first agent, reuse after).
    if (daytonaClient) {
      try {
        sandbox = await getOrCreateRoomSandbox(client, agent.roomId, agent.name);
      } catch (err) {
        console.error("[runner] Daytona sandbox resolve/create failed:", err);
        sandbox = null;
      }
    }

    // 3. Configure tools. Always include "bash" in built-ins so it's registered
    //    with full name/description/snippet — then OVERRIDE its execute() via an
    //    extension to route to Daytona. This is the pattern used by pi's own
    //    ssh.ts example (delegate without changing identity).
    const tools = ["read", "bash", "edit", "write", "find", "grep", "ls"];

    const useSandbox = !!sandbox;
    const resourceLoader = useSandbox
      ? new DefaultResourceLoader({
          cwd,
          agentDir: getAgentDir(),
          extensionFactories: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (pi: any) => {
              const localBash = createBashTool(cwd);
              const daytonaOps = makeDaytonaBashOps(sandbox!, agent.name);
              pi.registerTool({
                ...localBash,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async execute(id: string, params: any, signal: AbortSignal | undefined, onUpdate: any) {
                  const sandboxed = createBashTool(cwd, { operations: daytonaOps });
                  return sandboxed.execute(id, params, signal, onUpdate);
                },
              });
            },
          ],
        })
      : undefined;

    if (resourceLoader) await resourceLoader.reload();

    // 4. Create the agent session
    const { session } = await createAgentSession({
      cwd,
      model,
      // "low" is accepted by every model. gpt-5.5 rejects pi's "off"→"minimal"
      // mapping (it requires "none"), so we use "low" for portability.
      thinkingLevel: "low",
      sessionManager: SessionManager.inMemory(cwd),
      tools,
      ...(resourceLoader ? { resourceLoader } : {}),
      authStorage,
      modelRegistry,
    });

    // Wire extension-registered tools (our Daytona bash) into the LLM's tool
    // registry. Without this, registerTool() updates pi's runtime registry but
    // the LLM API call never sees the tool — model says "I don't have bash".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (session as any).bindExtensions({});

    await safeMutation(() =>
      client.mutation(api.agents.update, {
        agentId: agent._id,
        status: "working",
        progress: 0,
      }),
    );

    let walkTargetLabel = "";
    try {
      const roomDoc = (await client.query(api.rooms.get, {
        roomId: agent.roomId,
      })) as { map: { width: number; height: number } } | null;
      const map = roomDoc?.map ?? { width: 28, height: 20 };
      let walkPos = {
        x: Math.round(agent.position.x),
        y: Math.round(agent.position.y),
      };
      // Prefer the destination written at spawn (the standing tile in front
      // of the construction site). Fall back to the nearest workshop anchor
      // for any legacy agent rows that pre-date the destination field.
      const walkTarget = agent.destination
        ? {
            x: Math.round(agent.destination.x),
            y: Math.round(agent.destination.y),
          }
        : nearestAnchor(walkPos, workshopAnchors(map));
      walkTargetLabel = `(${walkTarget.x}, ${walkTarget.y})`;
      walkTimer = setInterval(() => {
        void (async () => {
          if (walkPos.x === walkTarget.x && walkPos.y === walkTarget.y) {
            if (walkTimer) {
              clearInterval(walkTimer);
              walkTimer = null;
            }
            return;
          }
          walkPos = stepToward(walkPos, walkTarget);
          await safeMutation(() =>
            client.mutation(api.agents.update, {
              agentId: agent._id,
              position: { ...walkPos },
            }),
          );
        })();
      }, 400);
    } catch {
      // Stay at spawn if room lookup fails
    }

    await safeMutation(() =>
      client.mutation(api.transcript.append, {
        agentId: agent._id,
        role: "system",
        text: `Spawned as ${character.name}. ${useSandbox ? "Bash → Daytona sandbox." : "Bash → host tempdir."}${
          walkTargetLabel ? ` Walking to workshop tile ${walkTargetLabel}.` : ""
        }`,
      }),
    );

    // 5. Wire pi events → Convex mutations
    let textBuffer = "";
    let textFlushTimer: NodeJS.Timeout | null = null;
    const flushText = async () => {
      const t = textBuffer;
      textBuffer = "";
      textFlushTimer = null;
      if (!t) return;
      await safeMutation(() =>
        client.mutation(api.agents.update, {
          agentId: agent._id,
          lastMessage: t.slice(-200),
        }),
      );
    };

    let toolCount = 0;
    const eventCounts: Record<string, number> = {};

    session.subscribe((event: unknown) => {
      const e = event as { type: string; [k: string]: unknown };
      eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1;
      // Diagnostic: log every event type so we can see what pi is doing
      const sub = e.assistantMessageEvent as { type?: string } | undefined;
      const summary =
        e.type === "message_update"
          ? `(${sub?.type ?? "?"})`
          : e.type === "tool_execution_start"
            ? `(${e.toolName ?? "?"})`
            : e.type === "tool_execution_end"
              ? `(${e.toolName ?? "?"} ok=${!e.isError})`
              : "";
      console.log(`[runner] ${agent.name} pi: ${e.type}${summary}`);
      switch (e.type) {
        case "message_update": {
          const sub = e.assistantMessageEvent as
            | { type: string; delta?: string }
            | undefined;
          if (sub?.type === "text_delta" && typeof sub.delta === "string") {
            textBuffer += sub.delta;
            if (!textFlushTimer) {
              textFlushTimer = setTimeout(() => flushText().catch(() => {}), 250);
            }
          }
          break;
        }
        case "tool_execution_start": {
          toolCount++;
          const toolName = (e.toolName as string | undefined) ?? "tool";
          // pi exposes the tool's input under one of these keys depending on
          // version; grab whichever exists.
          const input =
            (e.toolInput as Record<string, unknown> | undefined) ??
            (e.params as Record<string, unknown> | undefined) ??
            (e.args as Record<string, unknown> | undefined) ??
            (e.toolArgs as Record<string, unknown> | undefined) ??
            {};
          const detail = formatToolDetail(toolName, input);
          const text = detail ? `🔧 ${toolName} · ${detail}` : `🔧 ${toolName}`;
          safeMutation(() =>
            client.mutation(api.agents.update, {
              agentId: agent._id,
              progress: Math.min(toolCount / PROGRESS_TARGET_TOOL_CALLS, 0.95),
              lastMessage: text.slice(0, 200),
            }),
          );
          safeMutation(() =>
            client.mutation(api.transcript.append, {
              agentId: agent._id,
              role: "system",
              text,
            }),
          );
          break;
        }
        case "turn_end": {
          const message = e.message as
            | {
                content?: unknown;
                stopReason?: string;
                errorMessage?: string;
              }
            | undefined;
          // Surface API errors (e.g. invalid thinkingLevel) so the UI sees them
          if (message?.stopReason === "error" && message.errorMessage) {
            safeMutation(() =>
              client.mutation(api.transcript.append, {
                agentId: agent._id,
                role: "system",
                text: `❌ ${message.errorMessage}`,
              }),
            );
          }
          const text = extractTurnText(message);
          if (text) {
            safeMutation(() =>
              client.mutation(api.transcript.append, {
                agentId: agent._id,
                role: "agent",
                text,
              }),
            );
          }
          break;
        }
        case "agent_end":
          safeMutation(async () => {
            await flushText();
            await client.mutation(api.agents.update, {
              agentId: agent._id,
              status: "done",
              progress: 1,
            });
          });
          break;
      }
    });

    // 6. Convex user-turn entries → pi (poll every 1s while agent runs)
    const userTurnPoll = setInterval(async () => {
      try {
        const pending = (await client.query(api.transcript.undeliveredUserTurns, {
          agentId: agent._id,
        })) as Array<{ _id: string; text: string }> | undefined;
        if (!pending) return;
        for (const entry of pending) {
          try {
            await session.steer(entry.text);
          } catch {
            try {
              await session.followUp(entry.text);
            } catch {}
          }
          await safeMutation(() =>
            client.mutation(api.transcript.markDelivered, {
              entryId: entry._id as Id<"transcript">,
            }),
          );
        }
      } catch {
        // transient errors are fine; retry next tick
      }
    }, 1000);

    // 7. Run
    //
    // Note: pi's system prompt only advertises built-in tools listed in the
    // `tools` array. Our `bash` tool is registered via extension and does NOT
    // appear in the model's "Available tools" section, so we have to tell the
    // model about it explicitly in the prompt — otherwise it refuses to try.
    const toolsBlurb = useSandbox
      ? `## Your environment

You and other agents share a SINGLE persistent cloud sandbox (Daytona) — a Linux box where you all build the project together. Files you write persist for other agents to read and extend later.

## Available tools

- **bash** — runs shell commands in the shared sandbox. Use this for everything: install packages (\`npm\`, \`pip\`), write files (heredoc), run servers, etc.
- **write**, **read**, **edit**, **ls**, **find**, **grep** — these tools operate on a SEPARATE local workspace and are NOT visible to bash. **Avoid them.** Do all file work via \`bash\` so it persists in the shared sandbox.

## Project conventions

The shared project lives at \`/home/daytona/project/\` (cd there first; create it if missing). The stack is **Express + static frontend** unless the task says otherwise:

- \`server.js\` — Express server, listens on **port 3000** (this is the publicly-previewed port)
- \`public/index.html\`, \`public/style.css\`, \`public/app.js\` — frontend, served as static files by Express
- \`package.json\` — Node deps (express, etc.)
- \`tests/\` — test files

## How to run code

Always create files via bash heredoc and execute in the same call. Example:

\`\`\`bash
mkdir -p /home/daytona/project && cd /home/daytona/project
cat <<'EOF' > server.js
const express = require('express');
const app = express();
app.use(express.static('public'));
app.listen(3000, () => console.log('listening on 3000'));
EOF
\`\`\`

To start the server in the background so other agents (and the preview URL) can hit it:

\`\`\`bash
cd /home/daytona/project && (pkill -f "node server.js" 2>/dev/null; nohup node server.js > /tmp/server.log 2>&1 &)
sleep 1 && curl -s http://localhost:3000 | head -c 200
\`\`\`

Always restart the server after code changes so the preview URL reflects them.

`
      : `## Tools available to you

You have **bash, write, read, edit, ls, find, grep** — all running on a local workspace at \`${cwd}\`. Use them.

`;

    const fullPrompt = `${character.systemPrompt}\n\n${toolsBlurb}## Your Task\n${agent.task}`;
    console.log(`[runner] ${agent.name}: calling session.prompt() (${fullPrompt.length} chars)`);
    try {
      await session.prompt(fullPrompt);
      console.log(
        `[runner] ${agent.name}: session.prompt() returned. event counts:`,
        JSON.stringify(eventCounts),
      );
    } catch (err) {
      console.error(`[runner] ${agent.name}: session.prompt() threw:`, err);
      throw err;
    } finally {
      clearInterval(userTurnPoll);
      if (walkTimer) clearInterval(walkTimer);
      await flushText();

      // Capture this agent's diff and post it to the transcript so the user
      // can see exactly what changed. Done before dispose so the sandbox is
      // still attached.
      if (sandbox) {
        try {
          const diff = await captureAgentDiff(sandbox, agent.name);
          if (diff) {
            await safeMutation(() =>
              client.mutation(api.transcript.append, {
                agentId: agent._id,
                role: "system",
                text: `📁 Changes by ${agent.name}\n\n\`\`\`diff\n${diff}\n\`\`\``,
              }),
            );
          }
        } catch (err) {
          console.error(`[runner] ${agent.name}: diff capture failed:`, err);
        }
      }

      // Stay alive to handle follow-up messages from the inspector. Without
      // this, any message the user sends after the first prompt() resolves
      // sits forever in undeliveredUserTurns. We poll for new user turns and
      // re-prompt the same pi session so the conversation continues with full
      // context, until 5 min of idle or the agent row is cancelled.
      try {
        await waitForFollowUps(client, agent._id, agent.name, session, sandbox);
      } catch (err) {
        console.error(`[runner] ${agent.name}: follow-up loop error:`, err);
      }

      try {
        await session.dispose();
      } catch {}
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] ${agent._id} fatal:`, err);
    await failAgent(client, agent._id, message);
  } finally {
    if (walkTimer) clearInterval(walkTimer);
    await cleanup();
  }
}

// ---- helpers

// Resolves the room's persistent sandbox. On first call for a room: creates
// the sandbox via Daytona, fetches a preview URL for port 3000, and persists
// both to the `rooms` row so the client can render a "View running app" link.
// Subsequent calls: reuses the cached/resolved sandbox.
async function getOrCreateRoomSandbox(
  client: ConvexClient,
  roomId: Id<"rooms">,
  agentName: string,
): Promise<Sandbox> {
  if (!daytonaClient) throw new Error("Daytona not configured");
  const cached = roomSandboxCache.get(roomId);
  if (cached) {
    console.log(`[runner] ${agentName}: reusing cached sandbox for room ${roomId}`);
    return cached;
  }

  const room = (await client.query(api.rooms.get, { roomId })) as
    | { sandboxId?: string }
    | null;

  if (room?.sandboxId) {
    console.log(`[runner] ${agentName}: re-attaching to room sandbox ${room.sandboxId}`);
    const sandbox = await daytonaClient.get(room.sandboxId);
    // Sandbox may be archived/stopped from a previous session — start it.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (daytonaClient as any).start(sandbox, 60);
    } catch {
      // Already running, or start not needed — that's fine.
    }
    roomSandboxCache.set(roomId, sandbox);
    return sandbox;
  }

  console.log(`[runner] ${agentName}: creating new sandbox for room ${roomId}`);
  const sandbox = await daytonaClient.create({ language: "python" });
  const sandboxId = (sandbox as unknown as { id?: string }).id;

  // Initialize a git repo at the project root so we can show per-agent diffs.
  // Failure here is non-fatal — diffs become a no-op if git isn't available.
  try {
    const proc = (sandbox as unknown as {
      process: { executeCommand: (cmd: string) => Promise<unknown> };
    }).process;
    await proc.executeCommand(
      `mkdir -p /home/daytona/project && cd /home/daytona/project && \
       (git init -q 2>/dev/null || true) && \
       git config user.email "agent@rts-agent.local" && \
       git config user.name "agent" && \
       printf '%s\\n' 'node_modules/' '*.log' '.cache/' 'dist/' 'build/' '.env' '.env.*' > .gitignore && \
       (git add -A 2>/dev/null || true) && \
       (git commit -q -m "init" --allow-empty 2>/dev/null || true)`,
    );
    console.log(`[runner] ${agentName}: git initialized in /home/daytona/project`);
  } catch (err) {
    console.error("[runner] git init failed (non-fatal):", err);
  }

  // Pre-create preview URLs for the common dev-server ports so the UI can
  // surface the right link no matter which framework the agents pick.
  // Express:3000 · Vite:5173 · http.server/Django/Flask:8000 · Webpack/CRA:8080
  const PREVIEW_PORTS = [3000, 5173, 8000, 8080];
  const previewUrls: { port: number; url: string }[] = [];
  await Promise.all(
    PREVIEW_PORTS.map(async (port) => {
      try {
        const link = await sandbox.getPreviewLink(port);
        previewUrls.push({ port, url: link.url });
      } catch (err) {
        console.error(`[runner] getPreviewLink(${port}) failed:`, err);
      }
    }),
  );
  previewUrls.sort((a, b) => a.port - b.port);
  const previewUrl = previewUrls.find((p) => p.port === 3000)?.url;
  console.log(
    `[runner] ${agentName}: preview URLs ready: ${previewUrls.map((p) => `${p.port}=${p.url}`).join(", ")}`,
  );

  if (sandboxId) {
    await safeMutation(() =>
      client.mutation(api.rooms.setSandbox, {
        roomId,
        sandboxId,
        previewUrl,
        previewUrls,
      }),
    );
  }
  roomSandboxCache.set(roomId, sandbox);
  return sandbox;
}

async function pickModel(modelRegistry: ModelRegistry) {
  const available = await modelRegistry.getAvailable();
  for (const [provider, id] of MODEL_PREFERENCE) {
    const found = available.find((m) => m.provider === provider && m.id === id);
    if (found) return found;
  }
  return available[0] ?? null;
}

function makeDaytonaBashOps(sandbox: Sandbox, agentName: string): BashOperations {
  return {
    exec: async (command, _localCwd, options) => {
      // Don't forward the local tempdir as cwd — it doesn't exist in the
      // sandbox. Let Daytona use its default workspace dir.
      const startedAt = Date.now();
      console.log(
        `[runner] ${agentName} daytona exec: ${command.slice(0, 120)}${command.length > 120 ? "…" : ""}`,
      );
      try {
        const timeoutSec = options.timeout
          ? Math.max(1, Math.ceil(options.timeout / 1000))
          : undefined;
        const proc = (sandbox as unknown as {
          process: {
            executeCommand: (
              cmd: string,
              cwd?: string,
              env?: Record<string, string>,
              timeout?: number,
            ) => Promise<{
              exitCode?: number;
              result?: string;
              artifacts?: { stdout?: string; stderr?: string };
            }>;
          };
        }).process;
        const res = await proc.executeCommand(command, undefined, undefined, timeoutSec);
        const stdout = res.artifacts?.stdout ?? res.result ?? "";
        const stderr = res.artifacts?.stderr ?? "";
        const exitCode = res.exitCode ?? 0;
        console.log(
          `[runner] ${agentName} daytona done in ${Date.now() - startedAt}ms exitCode=${exitCode} stdout=${stdout.length}c stderr=${stderr.length}c`,
        );
        if (stdout) options.onData(Buffer.from(stdout, "utf-8"));
        if (stderr) options.onData(Buffer.from(stderr, "utf-8"));
        return { exitCode };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[runner] ${agentName} daytona ERROR after ${Date.now() - startedAt}ms:`, msg);
        options.onData(Buffer.from(`error: ${msg}\n`, "utf-8"));
        return { exitCode: 1 };
      }
    },
  };
}

async function failAgent(client: ConvexClient, agentId: AgentId, message: string) {
  await safeMutation(() =>
    client.mutation(api.agents.update, { agentId, status: "error" }),
  );
  await safeMutation(() =>
    client.mutation(api.transcript.append, {
      agentId,
      role: "system",
      text: `❌ ${message}`,
    }),
  );
}

async function safeMutation(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[runner] mutation error:", err);
  }
}

// Keep the agent's pi session alive after the first prompt finishes so the
// user can send follow-up messages from the inspector (e.g. "how do I preview
// the frontend?" or "now add a delete endpoint"). Disposes when either:
//   - FOLLOWUP_WINDOW_MS passes without any new user message, OR
//   - the agent row disappears from Convex (cancel)
const FOLLOWUP_WINDOW_MS = 5 * 60 * 1000;
const FOLLOWUP_POLL_MS = 1500;

async function waitForFollowUps(
  client: ConvexClient,
  agentId: AgentId,
  agentName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  sandbox: Sandbox | null,
): Promise<void> {
  let lastActivityAt = Date.now();

  while (Date.now() - lastActivityAt < FOLLOWUP_WINDOW_MS) {
    await new Promise((r) => setTimeout(r, FOLLOWUP_POLL_MS));

    // Cancel? agent row deleted by agents.cancel mutation → bail.
    const agentDoc = (await client.query(api.agents.get, { agentId })) as
      | unknown
      | null;
    if (!agentDoc) {
      console.log(`[runner] ${agentName}: agent row gone, ending follow-up loop`);
      return;
    }

    const pending = (await client.query(api.transcript.undeliveredUserTurns, {
      agentId,
    })) as Array<{ _id: string; text: string }> | undefined;
    if (!pending || pending.length === 0) continue;

    const followUpText = pending.map((p) => p.text).join("\n\n");
    console.log(
      `[runner] ${agentName}: follow-up (${pending.length} message${pending.length === 1 ? "" : "s"}, ${followUpText.length}c)`,
    );
    for (const p of pending) {
      await safeMutation(() =>
        client.mutation(api.transcript.markDelivered, {
          entryId: p._id as Id<"transcript">,
        }),
      );
    }

    await safeMutation(() =>
      client.mutation(api.agents.update, { agentId, status: "working" }),
    );

    try {
      await session.prompt(followUpText);
    } catch (err) {
      console.error(`[runner] ${agentName}: follow-up prompt threw:`, err);
      return;
    }

    await safeMutation(() =>
      client.mutation(api.agents.update, { agentId, status: "done", progress: 1 }),
    );

    if (sandbox) {
      try {
        const diff = await captureAgentDiff(sandbox, agentName);
        if (diff) {
          await safeMutation(() =>
            client.mutation(api.transcript.append, {
              agentId,
              role: "system",
              text: `📁 Changes by ${agentName}\n\n\`\`\`diff\n${diff}\n\`\`\``,
            }),
          );
        }
      } catch {}
    }

    lastActivityAt = Date.now();
  }
  console.log(
    `[runner] ${agentName}: follow-up window expired, disposing session`,
  );
}

// Stages all changes in /home/daytona/project, captures the diff against the
// previous commit, then commits the agent's work as its own commit. Result is
// posted to the transcript so the user can see exactly what changed.
async function captureAgentDiff(
  sandbox: Sandbox,
  agentName: string,
): Promise<string | null> {
  const proc = (sandbox as unknown as {
    process: {
      executeCommand: (cmd: string) => Promise<{
        result?: string;
        artifacts?: { stdout?: string };
      }>;
    };
  }).process;

  // Single shell call: stage, capture stat + diff (filtered to source files
  // and capped), then commit so the next agent starts from a clean base.
  // Pathspec is repeated for both --stat and the diff so node_modules /
  // lockfiles never leak into either.
  const safeName = agentName.replace(/[^A-Za-z0-9 ._-]/g, "");
  const PATHSPEC =
    "'*.js' '*.ts' '*.tsx' '*.jsx' '*.html' '*.css' '*.scss' '*.py' '*.md' '*.sh' '*.yml' '*.yaml' '*.toml' 'package.json' ':(exclude)package-lock.json' ':(exclude)pnpm-lock.yaml' ':(exclude)yarn.lock' ':(exclude)node_modules/**'";
  const cmd = [
    "cd /home/daytona/project 2>/dev/null || exit 0",
    "git add -A 2>/dev/null || true",
    `STAT=$(git diff --cached --stat HEAD -- ${PATHSPEC} 2>/dev/null)`,
    `DIFF=$(git diff --cached HEAD --no-color -- ${PATHSPEC} 2>/dev/null | head -c 3000)`,
    `git commit -q -m "agent: ${safeName}" 2>/dev/null || true`,
    'if [ -n "$STAT" ]; then printf "%s\\n\\n%s" "$STAT" "$DIFF"; fi',
  ].join(" && ");

  const res = await proc.executeCommand(cmd);
  const out = (res.artifacts?.stdout ?? res.result ?? "").trim();
  return out || null;
}

// Renders a tool's input as a short, human-readable string for the transcript.
// Goal: a glance tells you "the agent ran `node server.js`" or "wrote app.py".
function formatToolDetail(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const oneLine = (s: unknown, max: number) =>
    typeof s === "string"
      ? s.replace(/\s+/g, " ").trim().slice(0, max) +
        (typeof s === "string" && s.length > max ? "…" : "")
      : "";
  switch (toolName) {
    case "bash": {
      const cmd = oneLine(input.command, 200);
      return cmd ? `\`${cmd}\`` : "";
    }
    case "write": {
      const path = oneLine(input.filePath ?? input.path, 80);
      const bytes =
        typeof input.content === "string" ? `${input.content.length}c` : "";
      return path ? `📝 ${path}${bytes ? ` (${bytes})` : ""}` : "";
    }
    case "edit": {
      const path = oneLine(input.filePath ?? input.path, 80);
      return path ? `✏️ ${path}` : "";
    }
    case "read": {
      const path = oneLine(input.filePath ?? input.path, 80);
      return path ? `📖 ${path}` : "";
    }
    case "ls": {
      const path = oneLine(input.path, 80);
      return path ? `📂 ${path}` : "";
    }
    case "grep": {
      const pattern = oneLine(input.pattern, 80);
      const where = oneLine(input.path, 40);
      return pattern ? `🔎 /${pattern}/${where ? ` in ${where}` : ""}` : "";
    }
    case "find": {
      const pattern = oneLine(input.pattern ?? input.glob, 80);
      const where = oneLine(input.path, 40);
      return pattern ? `🔎 ${pattern}${where ? ` in ${where}` : ""}` : "";
    }
    default:
      return "";
  }
}

function extractTurnText(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const m = message as { content?: unknown };
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    const text = m.content
      .filter(
        (c): c is { type: string; text?: string } =>
          !!c && typeof c === "object" && (c as { type?: string }).type === "text",
      )
      .map((c) => c.text ?? "")
      .join("");
    return text || null;
  }
  return null;
}
