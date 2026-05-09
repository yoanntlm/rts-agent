// Agent runner — H3 stub.
//
// Subscribes to unclaimed agents in Convex, claims them, and simulates progress
// so the end-to-end loop is alive before pi/Daytona are wired in (H4).
//
// Replace `simulate` with a real pi instance + Daytona sandbox in H4.

import "dotenv/config";
import { ConvexClient } from "convex/browser";
import { api } from "@convex/_generated/api.js";

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
    simulate(agent).catch((err) => {
      console.error(`[runner] error simulating ${agent._id}:`, err);
      claimed.delete(agent._id);
    });
  }
});

// Fake progress loop. Replace with: spawn Daytona sandbox + run pi agent against task.
async function simulate(agent: { _id: string; name: string; task: string }) {
  await client.mutation(api.transcript.append, {
    agentId: agent._id,
    role: "system",
    text: `Spawned. Task: ${agent.task}`,
  });

  await client.mutation(api.agents.update, {
    agentId: agent._id,
    status: "working",
    progress: 0,
  });

  const STEPS = 8;
  for (let i = 1; i <= STEPS; i++) {
    await sleep(1500 + Math.random() * 1000);
    const progress = i / STEPS;
    await client.mutation(api.agents.update, {
      agentId: agent._id,
      progress,
      lastMessage: `step ${i}/${STEPS}`,
    });
    await client.mutation(api.transcript.append, {
      agentId: agent._id,
      role: "agent",
      text: `(simulated) made progress on step ${i}/${STEPS}`,
    });

    // Pretend to get stuck around step 5.
    if (i === 5) {
      await client.mutation(api.agents.update, {
        agentId: agent._id,
        status: "stuck",
      });
      await client.mutation(api.transcript.append, {
        agentId: agent._id,
        role: "agent",
        text: "I'm not sure how to proceed — could you give me a hint?",
      });
      await waitForUserMessage(agent._id);
      await client.mutation(api.agents.update, {
        agentId: agent._id,
        status: "working",
      });
      await client.mutation(api.transcript.append, {
        agentId: agent._id,
        role: "agent",
        text: "Thanks! Continuing.",
      });
    }
  }

  await client.mutation(api.agents.update, {
    agentId: agent._id,
    status: "done",
    progress: 1,
    lastMessage: "Done!",
  });
  await client.mutation(api.transcript.append, {
    agentId: agent._id,
    role: "system",
    text: "Task complete (simulated).",
  });
}

// Polls undelivered user turns and resolves when at least one arrives.
async function waitForUserMessage(agentId: string): Promise<void> {
  while (true) {
    await sleep(1000);
    const pending = await client.query(api.transcript.undeliveredUserTurns, { agentId });
    if (pending && pending.length > 0) {
      for (const entry of pending) {
        await client.mutation(api.transcript.markDelivered, { entryId: entry._id });
      }
      return;
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

process.on("SIGINT", () => {
  console.log("\n[runner] shutting down");
  process.exit(0);
});
