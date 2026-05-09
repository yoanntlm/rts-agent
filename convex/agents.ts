import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const STATUS = v.union(
  v.literal("idle"),
  v.literal("working"),
  v.literal("stuck"),
  v.literal("done"),
  v.literal("error"),
);

export const listInRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) =>
    ctx.db
      .query("agents")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect(),
});

export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => ctx.db.get(agentId),
});

export const spawn = mutation({
  args: {
    roomId: v.id("rooms"),
    ownerUserId: v.id("users"),
    characterId: v.string(),
    name: v.string(),
    sprite: v.string(),
    color: v.string(),
    systemPrompt: v.optional(v.string()),
    position: v.object({ x: v.number(), y: v.number() }),
    destination: v.optional(v.object({ x: v.number(), y: v.number() })),
    task: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("agents", {
      ...args,
      status: "idle",
      lastActivityAt: now,
    });
  },
});

// agent-runner picks this up via the `unclaimed` index.
export const listUnclaimed = query({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("agents")
      .withIndex("unclaimed", (q) => q.eq("runnerSpawnedAt", undefined))
      .collect(),
});

// agent-runner claims a row before starting work on it.
export const claim = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("agent not found");
    if (agent.runnerSpawnedAt !== undefined) return false; // already claimed
    await ctx.db.patch(agentId, {
      runnerSpawnedAt: Date.now(),
      lastActivityAt: Date.now(),
    });
    return true;
  },
});

export const update = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.optional(STATUS),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    progress: v.optional(v.number()),
    lastMessage: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, ...patch }) => {
    const cleaned: Record<string, unknown> = { lastActivityAt: Date.now() };
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) cleaned[k] = val;
    }
    await ctx.db.patch(agentId, cleaned);
  },
});

export const cancel = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const transcripts = await ctx.db
      .query("transcript")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    for (const t of transcripts) await ctx.db.delete(t._id);
    await ctx.db.delete(agentId);
  },
});
