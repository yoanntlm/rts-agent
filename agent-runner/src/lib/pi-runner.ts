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
  name: string;
  task: string;
  characterId: string;
  roomId: Id<"rooms">;
  position: { x: number; y: number };
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
  console.log("[runner] Daytona enabled — bash will execute in per-agent sandboxes");
} else {
  console.log("[runner] DAYTONA_API_KEY not set — bash will execute on host tempdir");
}

// ---- Public entry point

export async function runAgent(client: ConvexClient, agent: AgentDoc): Promise<void> {
  let walkTimer: ReturnType<typeof setInterval> | null = null;
  const character = getCharacter(agent.characterId);
  if (!character) {
    await failAgent(client, agent._id, `Unknown character: ${agent.characterId}`);
    return;
  }

  const cwd = mkdtempSync(join(tmpdir(), `pi-agent-${agent._id}-`));
  let sandbox: Sandbox | null = null;
  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (sandbox) {
      try {
        await (sandbox as unknown as { delete: () => Promise<void> }).delete();
        console.log(`[runner] ${agent.name}: deleted sandbox`);
      } catch (err) {
        console.error("[runner] sandbox cleanup error:", err);
      }
    }
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

    // 2. Spin up Daytona sandbox if available
    if (daytonaClient) {
      try {
        sandbox = await daytonaClient.create({ language: "python" });
        const sandboxId = (sandbox as unknown as { id?: string }).id;
        console.log(`[runner] ${agent.name}: created Daytona sandbox ${sandboxId ?? "(no id)"}`);
        if (sandboxId) {
          await safeMutation(() =>
            client.mutation(api.agents.update, {
              agentId: agent._id,
              sandboxId,
            }),
          );
        }
      } catch (err) {
        console.error("[runner] Daytona sandbox creation failed, falling back to local:", err);
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
      const anchors = workshopAnchors(map);
      let walkPos = {
        x: Math.round(agent.position.x),
        y: Math.round(agent.position.y),
      };
      const walkTarget = nearestAnchor(walkPos, anchors);
      walkTargetLabel = `(${walkTarget.x}, ${walkTarget.y})`;
      walkTimer = setInterval(() => {
        void (async () => {
          if (walkPos.x === walkTarget.x && walkPos.y === walkTarget.y) return;
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
          safeMutation(() =>
            client.mutation(api.agents.update, {
              agentId: agent._id,
              progress: Math.min(toolCount / PROGRESS_TARGET_TOOL_CALLS, 0.95),
              lastMessage: `🔧 ${toolName}`,
            }),
          );
          safeMutation(() =>
            client.mutation(api.transcript.append, {
              agentId: agent._id,
              role: "system",
              text: `🔧 ${toolName}`,
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
      ? `## Tools available to you

You have these tools — use them confidently, they all exist:

- **bash** — runs shell commands in an isolated cloud sandbox (Daytona). The sandbox starts empty and has python3, node, npm, git, curl, and standard Linux utilities. Use this whenever you need to execute code or install packages.
- **write**, **read**, **edit**, **ls**, **find**, **grep** — operate on a local workspace at \`${cwd}\` that is SEPARATE from the bash sandbox.

**Important:** because the local workspace and the bash sandbox have separate filesystems, writing a file with \`write\` does NOT make it visible to bash. To execute a script, create it INSIDE the bash sandbox using a heredoc in the same call:

\`\`\`bash
cat <<'EOF' > script.py
print('hi')
EOF
python3 script.py
\`\`\`

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
