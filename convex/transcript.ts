import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const ROLE = v.union(
  v.literal("agent"),
  v.literal("user"),
  v.literal("system"),
);

export const byAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) =>
    ctx.db
      .query("transcript")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("asc")
      .collect(),
});

export const append = mutation({
  args: {
    agentId: v.id("agents"),
    role: ROLE,
    text: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transcript", args);
  },
});

// Convenience for the client when a user types a hint.
export const userMessage = mutation({
  args: {
    agentId: v.id("agents"),
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, { agentId, userId, text }) => {
    await ctx.db.insert("transcript", {
      agentId,
      userId,
      role: "user",
      text,
    });
    // Bump activity so the runner notices and stuck-detector resets.
    await ctx.db.patch(agentId, { lastActivityAt: Date.now() });
  },
});

// Used by the agent-runner to fetch outstanding user turns to forward to pi.
export const undeliveredUserTurns = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) =>
    ctx.db
      .query("transcript")
      .withIndex("undelivered_user_turns", (q) =>
        q.eq("agentId", agentId).eq("role", "user").eq("deliveredToPiAt", undefined),
      )
      .collect(),
});

export const markDelivered = mutation({
  args: { entryId: v.id("transcript") },
  handler: async (ctx, { entryId }) => {
    await ctx.db.patch(entryId, { deliveredToPiAt: Date.now() });
  },
});
