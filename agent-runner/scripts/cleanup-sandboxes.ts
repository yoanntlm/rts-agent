// One-off: list (and optionally delete) every Daytona sandbox under this API key.
// Usage:
//   pnpm --filter @rts-agent/agent-runner exec tsx scripts/cleanup-sandboxes.ts        # list only
//   pnpm --filter @rts-agent/agent-runner exec tsx scripts/cleanup-sandboxes.ts --yes  # delete all
import "dotenv/config";
import { Daytona } from "@daytonaio/sdk";

const apiKey = process.env.DAYTONA_API_KEY;
if (!apiKey) {
  console.error("DAYTONA_API_KEY missing");
  process.exit(1);
}
const doDelete = process.argv.includes("--yes");
const daytona = new Daytona({ apiKey });

async function main() {
  let page = 1;
  const all: { id: string; state?: string }[] = [];
  // The SDK paginates — walk until we get an empty page.
  for (;;) {
    const res = await daytona.list(undefined, page, 100);
    const items = (res as unknown as { items: { id: string; state?: string }[] }).items ?? [];
    all.push(...items);
    if (items.length < 100) break;
    page += 1;
  }
  console.log(`Found ${all.length} sandbox(es):`);
  for (const s of all) console.log(`  ${s.id}  state=${s.state ?? "?"}`);

  if (!doDelete) {
    console.log("\nDry-run. Re-run with --yes to delete them all.");
    return;
  }

  console.log(`\nDeleting ${all.length} sandbox(es)…`);
  let ok = 0,
    fail = 0;
  for (const s of all) {
    try {
      const sb = await daytona.get(s.id);
      await daytona.delete(sb, 30);
      console.log(`  ✓ deleted ${s.id}`);
      ok += 1;
    } catch (err) {
      console.error(`  ✗ ${s.id}: ${(err as Error).message}`);
      fail += 1;
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
