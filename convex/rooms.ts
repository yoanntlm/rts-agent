import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_MAP = { width: 48, height: 32 };

export const getOrCreate = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (existing) {
      // Auto-align every room with the current default grid so all users see
      // the same world (matches the bundled /assets/tilemap-48x32.json).
      if (
        existing.map.width !== DEFAULT_MAP.width ||
        existing.map.height !== DEFAULT_MAP.height
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
    previewUrls: v.optional(
      v.array(v.object({ port: v.number(), url: v.string() })),
    ),
  },
  handler: async (ctx, { roomId, sandboxId, previewUrl, previewUrls }) => {
    await ctx.db.patch(roomId, { sandboxId, previewUrl, previewUrls });
  },
});
