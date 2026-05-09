// Agent runner.
//
// Subscribes to unclaimed agents in Convex, claims them, and runs each one
// through pi (see lib/pi-runner.ts). Translates pi events → Convex mutations
// so the client UI sees status, progress, and transcript updates in real time.
//
// H4: replace pi's local bash with a Daytona-backed bash tool (see pi-runner.ts).

import "dotenv/config";
import { ConvexClient } from "convex/browser";
import { api } from "@convex/_generated/api.js";
import { runAgent } from "./lib/pi-runner.js";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("[runner] CONVEX_URL not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const client = new ConvexClient(CONVEX_URL);
const claimed = new Set<string>();

console.log("[runner] connecting to", CONVEX_URL);

client.onUpdate(api.agents.listUnclaimed, {}, async (agents: any[]) => {
  for (const agent of agents) {
    if (claimed.has(agent._id)) continue;
    claimed.add(agent._id);
    const ok = await client.mutation(api.agents.claim, { agentId: agent._id });
    if (!ok) {
      claimed.delete(agent._id);
      continue;
    }
    console.log(`[runner] claimed ${agent.name} (${agent._id}) — task: ${agent.task}`);
    runAgent(client, agent)
      .catch((err) => {
        console.error(`[runner] error running ${agent._id}:`, err);
      })
      .finally(() => {
        claimed.delete(agent._id);
        console.log(`[runner] released ${agent.name} (${agent._id})`);
      });
  }
});

process.on("SIGINT", () => {
  console.log("\n[runner] shutting down");
  process.exit(0);
});
