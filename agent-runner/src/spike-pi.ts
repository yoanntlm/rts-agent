// pi spike — discover the event surface in our actual environment.
// Standalone — does NOT touch Convex. Just spawns a pi agent against a temp dir.
//
// Run:
//   pnpm --filter ./agent-runner exec tsx src/spike-pi.ts
//
// Requires: OPENAI_API_KEY or ANTHROPIC_API_KEY in agent-runner/.env

import "dotenv/config";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  createAgentSession,
} from "@earendil-works/pi-coding-agent";

async function main() {
  const cwd = mkdtempSync(join(tmpdir(), "pi-spike-"));
  console.log(`[spike] cwd: ${cwd}`);

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const available = await modelRegistry.getAvailable();
  console.log(
    `[spike] available models: ${available.map((m: any) => `${m.provider}/${m.id}`).join(", ") || "(none)"}`,
  );
  if (available.length === 0) {
    console.error(
      "[spike] no models with API keys. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to agent-runner/.env",
    );
    process.exit(1);
  }
  const model = available[0]!;
  console.log(`[spike] using ${model.provider}/${model.id}`);

  const { session } = await createAgentSession({
    cwd,
    model,
    thinkingLevel: "off",
    sessionManager: SessionManager.inMemory(cwd),
    tools: ["read", "bash", "edit", "write"],
    authStorage,
    modelRegistry,
  });

  const counts: Record<string, number> = {};
  session.subscribe((event: any) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    const summary = summarize(event);
    console.log(`[event] ${event.type}${summary ? " · " + summary : ""}`);
  });

  console.log("[spike] starting prompt");
  await session.prompt(
    "Create a file hello.py that prints 'hi from pi', then run it with python3 and tell me what it printed.",
  );

  console.log("[spike] done");
  console.log("[spike] event counts:", counts);
  console.log(
    "[spike] message count:",
    (session.state as any)?.messages?.length ?? "(unknown)",
  );

  await session.dispose();
  try {
    rmSync(cwd, { recursive: true, force: true });
  } catch {}
}

function summarize(event: any): string {
  switch (event.type) {
    case "message_update": {
      const sub = event.assistantMessageEvent;
      if (sub?.type === "text_delta") return `+${sub.delta?.length ?? 0}c`;
      return sub?.type ?? "";
    }
    case "tool_execution_start":
      return `tool=${event.toolName ?? "?"}`;
    case "tool_execution_end":
      return `tool=${event.toolName ?? "?"} ok=${!event.isError}`;
    case "turn_end":
      return `tools=${event.toolResults?.length ?? 0}`;
    case "agent_end":
      return `messages+=${event.messages?.length ?? 0}`;
    default:
      return "";
  }
}

main().catch((err) => {
  console.error("[spike] fatal:", err);
  process.exit(1);
});
