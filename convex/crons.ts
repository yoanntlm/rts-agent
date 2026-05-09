import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const STUCK_AFTER_MS = 30_000;

export const detectStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_AFTER_MS;
    const working = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("status"), "working"))
      .collect();
    for (const a of working) {
      if (a.lastActivityAt < cutoff) {
        await ctx.db.patch(a._id, { status: "stuck" });
      }
    }
  },
});

const crons = cronJobs();
crons.interval("detect stuck agents", { seconds: 5 }, internal.crons.detectStuck);
export default crons;
