import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const join = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, { roomId, name, color }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .filter((q) => q.eq(q.field("name"), name))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now, color });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      roomId,
      name,
      color,
      lastSeenAt: now,
    });
  },
});

export const heartbeat = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { lastSeenAt: Date.now() });
  },
});

export const listInRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const cutoff = Date.now() - 60_000;
    const all = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return all.filter((u) => u.lastSeenAt > cutoff);
  },
});
