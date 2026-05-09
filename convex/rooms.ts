import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_MAP = { width: 28, height: 20 };

export const getOrCreate = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (existing) {
      // Keep the shared hackathon demo room aligned with the client grid size.
      if (
        name === "demo" &&
        (existing.map.width !== DEFAULT_MAP.width || existing.map.height !== DEFAULT_MAP.height)
      ) {
        await ctx.db.patch(existing._id, { map: DEFAULT_MAP });
      }
      return existing._id;
    }
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

// Called by the agent-runner once it provisions the room's persistent sandbox.
export const setSandbox = mutation({
  args: {
    roomId: v.id("rooms"),
    sandboxId: v.string(),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, sandboxId, previewUrl }) => {
    await ctx.db.patch(roomId, { sandboxId, previewUrl });
  },
});
