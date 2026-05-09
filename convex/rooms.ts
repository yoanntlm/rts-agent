import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_MAP = { width: 20, height: 14 };

export const getOrCreate = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("rooms", { name, map: DEFAULT_MAP });
  },
});

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => ctx.db.get(roomId),
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) =>
    ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique(),
});
