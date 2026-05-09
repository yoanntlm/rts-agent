#!/usr/bin/env bash
# Build client locally + rsync everything to the VPS + restart the runner.
# Run from the repo root: ./deploy/deploy.sh
set -euo pipefail

HOST=${HOST:-root@5.223.45.119}
REMOTE=${REMOTE:-/opt/rts-agent}

echo "=== Building client ==="
pnpm --filter @rts-agent/client build

echo "=== Rsync to $HOST:$REMOTE ==="
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.local.example' \
  --exclude 'agent-runner/.env' \
  --exclude 'client/dist' \
  --exclude 'client/.vite' \
  --exclude '*.log' \
  ./ "$HOST:$REMOTE/"

echo "=== Sync built client (with --delete to clear stale assets) ==="
rsync -avz --delete client/dist/ "$HOST:$REMOTE/client/dist/"

echo "=== Install deps + restart runner on remote ==="
ssh "$HOST" "set -euo pipefail; \
  cd $REMOTE && \
  pnpm install --frozen-lockfile=false && \
  systemctl restart citybuilder-runner && \
  systemctl status citybuilder-runner --no-pager | head -15"

echo ""
echo "✓ Deployed. Tail logs with:"
echo "  ssh $HOST 'journalctl -u citybuilder-runner -f'"
