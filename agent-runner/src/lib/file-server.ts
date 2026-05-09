// Tiny read-only HTTP server that exposes a room's sandbox project files.
//
// Endpoints (all GET, JSON or text/plain):
//   GET /api/code/files?roomId=<id>           → { files: ["server.js", "public/index.html", ...] }
//   GET /api/code/file?roomId=<id>&path=<p>   → text/plain (utf-8), 50KB cap
//
// Security:
//   - Path is validated against a strict allowlist regex (no `..`, no shell metachars)
//   - Files outside /home/daytona/project are unreachable (sandbox + path checks)
//   - Listening on 127.0.0.1 only — Caddy reverse-proxies the public surface
//   - No auth: room slugs in URLs are the access token; ungaussable in practice for a hackathon

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Daytona, Sandbox } from "@daytonaio/sdk";
import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

const PROJECT_ROOT = "/home/daytona/project";
const MAX_FILES = 200;
const MAX_FILE_BYTES = 50_000;
// Allow alphanumerics, dot, underscore, hyphen, forward slash. No `..`.
const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;

const sandboxCache = new Map<string, Sandbox>();

async function resolveSandbox(
  daytona: Daytona,
  client: ConvexClient,
  roomId: string,
): Promise<Sandbox | null> {
  const cached = sandboxCache.get(roomId);
  if (cached) return cached;
  const room = (await client.query(api.rooms.get, {
    roomId: roomId as Id<"rooms">,
  })) as { sandboxId?: string } | null;
  if (!room?.sandboxId) return null;
  const sb = await daytona.get(room.sandboxId);
  sandboxCache.set(roomId, sb);
  return sb;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(body);
}

export function startFileServer(
  daytona: Daytona | null,
  client: ConvexClient,
  port = 4000,
) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET") {
      sendText(res, 405, "method not allowed");
      return;
    }
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const roomId = url.searchParams.get("roomId");

    try {
      if (url.pathname === "/api/code/files") {
        if (!daytona) return sendJson(res, 503, { error: "daytona not configured" });
        if (!roomId) return sendJson(res, 400, { error: "roomId required" });
        const sb = await resolveSandbox(daytona, client, roomId);
        if (!sb) return sendJson(res, 404, { error: "no sandbox for room" });

        // List files, excluding noise. Stable lexicographic order so the UI is consistent.
        const cmd = `cd ${PROJECT_ROOT} 2>/dev/null && find . -type f \
          -not -path './node_modules/*' \
          -not -path './.git/*' \
          -not -path './.cache/*' \
          -not -path './dist/*' \
          -not -path './build/*' \
          -size -${MAX_FILE_BYTES}c 2>/dev/null \
          | sed 's|^\\./||' | sort | head -${MAX_FILES}`;
        const result = await (sb as unknown as {
          process: { executeCommand: (cmd: string) => Promise<{ result?: string; artifacts?: { stdout?: string } }> };
        }).process.executeCommand(cmd);
        const stdout = (result.artifacts?.stdout ?? result.result ?? "").trim();
        const files = stdout ? stdout.split("\n").filter(Boolean) : [];
        return sendJson(res, 200, { files });
      }

      if (url.pathname === "/api/code/file") {
        if (!daytona) return sendText(res, 503, "daytona not configured");
        if (!roomId) return sendText(res, 400, "roomId required");
        const path = url.searchParams.get("path") ?? "";
        if (!path || path.includes("..") || !SAFE_PATH.test(path)) {
          return sendText(res, 400, "invalid path");
        }
        const sb = await resolveSandbox(daytona, client, roomId);
        if (!sb) return sendText(res, 404, "no sandbox for room");

        // Use printf-quoted path for safety; constrain by realpath check inside the shell.
        const cmd = `cd ${PROJECT_ROOT} 2>/dev/null && \
          REAL=$(realpath -m -- ${JSON.stringify(path)} 2>/dev/null) && \
          case "$REAL" in ${PROJECT_ROOT}/*) ;; *) exit 1;; esac && \
          [ -f "$REAL" ] && head -c ${MAX_FILE_BYTES} "$REAL"`;
        const result = await (sb as unknown as {
          process: { executeCommand: (cmd: string) => Promise<{ result?: string; artifacts?: { stdout?: string }; exitCode?: number }> };
        }).process.executeCommand(cmd);
        if ((result.exitCode ?? 0) !== 0) return sendText(res, 404, "not found");
        const content = result.artifacts?.stdout ?? result.result ?? "";
        return sendText(res, 200, content);
      }

      sendText(res, 404, "not found");
    } catch (err) {
      console.error("[file-server] error:", err);
      sendText(res, 500, "internal error");
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[file-server] listening on 127.0.0.1:${port}`);
  });

  return server;
}
