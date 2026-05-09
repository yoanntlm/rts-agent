#!/usr/bin/env bash
# One-time VPS setup for citybuilder.yoanntlm.com.
# Safe to re-run. Adapted to a busy VPS that already has Caddy + Node + Docker.
#
# Run as root on 5.223.45.119:
#   ssh root@5.223.45.119 'bash -s' < deploy/setup-vps.sh
set -euo pipefail

echo "=== Sanity checks ==="
node -v || { echo "Node missing — install before continuing"; exit 1; }
caddy version | head -1 || { echo "Caddy missing — install before continuing"; exit 1; }
which corepack >/dev/null || { echo "corepack missing — should ship with Node"; exit 1; }
df -h / | tail -1

echo "=== Enabling pnpm via corepack ==="
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm -v

echo "=== Creating /opt/rts-agent ==="
mkdir -p /opt/rts-agent

echo "=== Done with VPS setup ==="
echo ""
echo "NEXT, on this VPS (do these manually):"
echo ""
echo "  1. APPEND the citybuilder block to /etc/caddy/Caddyfile:"
echo "     cat /opt/rts-agent/deploy/Caddyfile.snippet >> /etc/caddy/Caddyfile"
echo "     systemctl reload caddy"
echo ""
echo "  2. Install the systemd unit:"
echo "     cp /opt/rts-agent/deploy/citybuilder-runner.service /etc/systemd/system/"
echo "     systemctl daemon-reload"
echo ""
echo "  3. Create the runner's env file (replace values):"
echo "     cat > /opt/rts-agent/agent-runner/.env <<EOF"
echo "     CONVEX_URL=https://helpful-labrador-569.convex.cloud"
echo "     OPENAI_API_KEY=sk-..."
echo "     DAYTONA_API_KEY=dtn_..."
echo "     EOF"
echo ""
echo "  4. Start the runner:"
echo "     systemctl enable --now citybuilder-runner"
echo "     journalctl -u citybuilder-runner -f"
echo ""
echo "  5. Cloudflare: A record citybuilder.yoanntlm.com -> 5.223.45.119 (gray cloud for cert issuance)"
echo ""
echo "But all of that runs AFTER your first ./deploy/deploy.sh from your laptop"
echo "(which gets the code onto /opt/rts-agent in the first place)."
