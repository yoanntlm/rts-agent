import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    name: v.string(),
    map: v.object({ width: v.number(), height: v.number() }),
  }).index("by_name", ["name"]),

  users: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    color: v.string(),
    lastSeenAt: v.number(),
  }).index("by_room", ["roomId"]),

  agents: defineTable({
    roomId: v.id("rooms"),
    ownerUserId: v.id("users"),
    characterId: v.string(),
    name: v.string(),
    sprite: v.string(),
    color: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("stuck"),
      v.literal("done"),
      v.literal("error"),
    ),
    task: v.string(),
    progress: v.optional(v.number()),
    lastMessage: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    runnerSpawnedAt: v.optional(v.number()),
    lastActivityAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("unclaimed", ["runnerSpawnedAt"]),

  transcript: defineTable({
    agentId: v.id("agents"),
    role: v.union(
      v.literal("agent"),
      v.literal("user"),
      v.literal("system"),
    ),
    text: v.string(),
    userId: v.optional(v.id("users")),
    deliveredToPiAt: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("undelivered_user_turns", ["agentId", "role", "deliveredToPiAt"]),
});
