import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import Layout from "./components/Layout";
import TopBar from "./components/TopBar";
import World from "./components/World";
import Inspector from "./components/Inspector";
import SpawnButton from "./components/SpawnButton";
import SpawnDialog from "./components/SpawnDialog";
import CreateAvatarModal from "./components/CreateAvatarModal";
import CodePanel from "./components/CodePanel";
import { CHARACTERS, getCharacter } from "./lib/characters";
import { loadCustomCharacters, saveCustomCharacters } from "./lib/customCharacters";
import { getOrCreateIdentity } from "./lib/identity";
import type { AgentView } from "./lib/types";
import type { Character } from "./lib/characters";
import { workshopAnchors, nearestAnchor, stepToward } from "./lib/workshopAnchors";
import { pickMonument } from "./lib/monuments";

const MAP_SIZE = { width: 48, height: 32 };

type Props = { roomName: string };

export default function ConnectedApp({ roomName }: Props) {
  const identity = useMemo(() => getOrCreateIdentity(), []);
  const [customCharacters, setCustomCharacters] = useState<Character[]>(() => loadCustomCharacters());
  const characters = useMemo(() => [...CHARACTERS, ...customCharacters], [customCharacters]);

  const getOrCreateRoom = useMutation(api.rooms.getOrCreate);
  const joinRoom = useMutation(api.users.join);
  const heartbeat = useMutation(api.users.heartbeat);

  const [roomId, setRoomId] = useState<Id<"rooms"> | null>(null);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  // Bootstrap: room + user. Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getOrCreateRoom({ name: roomName });
        if (cancelled) return;
        setRoomId(r as Id<"rooms">);
        const u = await joinRoom({ roomId: r, name: identity.name, color: identity.color });
        if (cancelled) return;
        setUserId(u as Id<"users">);
      } catch (err) {
        if (cancelled) return;
        setAppError(err instanceof Error ? err.message : "Failed to connect to Convex.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getOrCreateRoom, joinRoom, identity.name, identity.color]);

  // Heartbeat to keep the user marked online.
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      heartbeat({ userId }).catch(() => {});
    }, 20_000);
    return () => clearInterval(interval);
  }, [userId, heartbeat]);

  const agents = useQuery(api.agents.listInRoom, roomId ? { roomId } : "skip") as
    | AgentRow[]
    | undefined;
  const usersInRoom = useQuery(api.users.listInRoom, roomId ? { roomId } : "skip") as
    | UserRow[]
    | undefined;
  const roomDoc = useQuery(api.rooms.get, roomId ? { roomId } : "skip");
  const mapSize = roomDoc?.map ?? MAP_SIZE;

  const runnerBanner = useMemo(() => {
    if (!agents?.length) return null;
    const staleMs = 18_000;
    const now = Date.now();
    const queued = agents.filter((a) => a.status === "idle" && a.runnerSpawnedAt === undefined);
    const staleQueued = queued.filter((a) => now - a.lastActivityAt > staleMs);
    if (staleQueued.length > 0) {
      return `Runner may be offline — ${staleQueued.length} agent(s) queued ${Math.round(staleMs / 1000)}s+`;
    }
    if (queued.length > 0) {
      return `${queued.length} agent(s) queued for runner`;
    }
    const starting = agents.filter((a) => a.status === "idle" && a.runnerSpawnedAt !== undefined);
    if (starting.length > 0) {
      return `${starting.length} agent(s) connecting…`;
    }
    return null;
  }, [agents]);

  const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | null>(null);
  const transcript = useQuery(
    api.transcript.byAgent,
    selectedAgentId ? { agentId: selectedAgentId } : "skip",
  ) as TranscriptRow[] | undefined;

  const [spawnOpen, setSpawnOpen] = useState(false);
  // When the user creates a fresh avatar mid-flow, we pass its id back into the
  // spawn dialog so it auto-advances to the task step with that avatar picked.
  const [pendingPickId, setPendingPickId] = useState<string | null>(null);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const spawnAgent = useMutation(api.agents.spawn);
  const sendMessage = useMutation(api.transcript.userMessage);
  const finishTask = useMutation(api.agents.finishTask);
  const updateAgent = useMutation(api.agents.update);

  // Destinations this client has just submitted but may not yet appear in the
  // `agents` query snapshot. Without this, back-to-back spawns race the
  // Convex subscription and pick the same workshop slot.
  const inFlightDestinationsRef = useRef<Set<string>>(new Set());
  // Same idea for finishTask: how many monuments this client has just
  // submitted but Convex may not yet show. Bumps the index so back-to-back
  // finishes don't both grab the same hardcoded slot (e.g. two MBS1s).
  const inFlightFinishesRef = useRef(0);

  const handleSpawn = async (characterId: string, task: string, name?: string) => {
    if (!roomId || !userId) return;
    const character = characters.find((c) => c.id === characterId) ?? getCharacter(characterId);
    if (!character) return;
    setIsSpawning(true);
    setAppError(null);
    try {
      const occupiedDestinations = new Set<string>();
      for (const a of agents ?? []) {
        if (a.destination) occupiedDestinations.add(`${a.destination.x},${a.destination.y}`);
      }
      for (const k of inFlightDestinationsRef.current) occupiedDestinations.add(k);

      const entry = pickEntryTile(mapSize);
      const destination = pickDestination(entry, mapSize, occupiedDestinations);
      // The 3×3 construction site / future monument lives 2 tiles north of
      // the standing tile. Persisted on the doc so it stays put even after
      // finishTask swaps `destination` for the home tile.
      const workshopTile = { x: destination.x, y: destination.y + 2 };
      const destKey = `${destination.x},${destination.y}`;
      inFlightDestinationsRef.current.add(destKey);
      const agentId = (await spawnAgent({
        roomId,
        ownerUserId: userId,
        characterId: character.id,
        name: name?.trim() || character.name,
        sprite: character.icon,
        color: character.color,
        systemPrompt: character.systemPrompt,
        position: entry,
        destination,
        workshopTile,
        task,
      })) as Id<"agents">;
      setSelectedAgentId(agentId);
      setSpawnOpen(false);
      setPendingPickId(null);
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Failed to spawn agent.");
    } finally {
      setIsSpawning(false);
    }
  };

  const handleFinishTask = async () => {
    if (!selectedAgentId) return;
    const agent = agents?.find((a) => a._id === selectedAgentId);
    if (!agent) return;
    // Send the agent home — one row off the south edge of the map so the
    // camera clamp keeps them out of view once they arrive. Walk x is held
    // at the workshop x to give a clean straight retreat.
    const homeX = agent.workshopTile?.x ?? agent.position.x;
    const homeTile = { x: homeX, y: -1 };
    // Curated 1st..5th, random after. Visible-finished count + in-flight
    // pending finishes gives a stable index across rapid clicks.
    const completedCount =
      (agents ?? []).filter((a) => a.monumentImage).length +
      inFlightFinishesRef.current;
    const monumentImage = pickMonument(completedCount);
    inFlightFinishesRef.current += 1;
    try {
      await finishTask({
        agentId: agent._id,
        monumentImage,
        homeTile,
      });
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Failed to finish task.");
    } finally {
      inFlightFinishesRef.current = Math.max(0, inFlightFinishesRef.current - 1);
    }
  };

  // Walk finished agents home, one tile per tick. Uses the same stepToward
  // approach the agent-runner uses during the spawn-arrival walk; here it
  // runs on the client because the runner's walker has long since cleared.
  useEffect(() => {
    if (!agents || agents.length === 0) return;
    const handle = window.setInterval(() => {
      for (const a of agents) {
        if (!a.monumentImage || !a.destination) continue;
        if (a.position.x === a.destination.x && a.position.y === a.destination.y) continue;
        const next = stepToward(
          { x: Math.round(a.position.x), y: Math.round(a.position.y) },
          { x: a.destination.x, y: a.destination.y },
        );
        updateAgent({ agentId: a._id, position: next }).catch(() => {});
      }
    }, 400);
    return () => window.clearInterval(handle);
  }, [agents, updateAgent]);

  const handleSendMessage = async (text: string) => {
    if (!selectedAgentId || !userId || !text.trim()) return;
    setSendPending(true);
    setAppError(null);
    try {
      await sendMessage({ agentId: selectedAgentId, userId, text: text.trim() });
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSendPending(false);
    }
  };

  // Once Convex's reactive query catches up and an agent's destination is
  // visible in `agents`, drop the matching in-flight key so it's no longer
  // double-counted as occupied.
  useEffect(() => {
    if (!agents) return;
    const visible = new Set<string>();
    for (const a of agents) {
      if (a.destination) visible.add(`${a.destination.x},${a.destination.y}`);
    }
    for (const k of inFlightDestinationsRef.current) {
      if (visible.has(k)) inFlightDestinationsRef.current.delete(k);
    }
  }, [agents]);

  const selectedAgent = agents?.find((a) => a._id === selectedAgentId) ?? null;

  const addCustomCharacter = (character: Character) => {
    setCustomCharacters((current) => {
      const next = [...current, character];
      saveCustomCharacters(next);
      return next;
    });
    setShowAvatarCreator(false);
    // Re-open the spawn dialog with the new avatar pre-selected.
    setPendingPickId(character.id);
    setSpawnOpen(true);
  };

  // Esc clears the selected agent (only when no spawn dialog is open — that
  // dialog handles its own Escape).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !spawnOpen && !showAvatarCreator) {
        setSelectedAgentId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spawnOpen, showAvatarCreator]);

  const ready = Boolean(roomId && userId);

  return (
    <>
      <Layout
        topBar={
          <TopBar
            roomName={roomName}
            users={usersInRoom ?? []}
            selfUserId={userId}
            connectionStatus={roomId ? "connected" : "reconnecting"}
            runnerBanner={runnerBanner}
            previewUrls={roomDoc?.previewUrls}
          />
        }
        world={
          <>
            <World
              agents={(agents ?? []).map(toAgentView)}
              mapSize={mapSize}
              onSelectAgent={(id) => setSelectedAgentId(id as Id<"agents"> | null)}
              selectedAgentId={selectedAgentId}
            />
            <SpawnButton onClick={() => setSpawnOpen(true)} disabled={!ready} />
          </>
        }
        inspector={
          <Inspector
            agent={selectedAgent ? toAgentView(selectedAgent) : null}
            transcript={(transcript ?? []).map((t) => ({
              id: t._id,
              role: t.role,
              text: t.text,
              userId: t.userId ?? null,
            }))}
            onSendMessage={handleSendMessage}
            onFinishTask={handleFinishTask}
            sendPending={sendPending}
          />
        }
        banner={
          appError ? (
            <div className="max-w-md rounded-lg border border-red-700/50 bg-red-950/80 p-3 text-xs text-red-100 backdrop-blur">
              <div className="font-semibold text-red-200">Frontend action failed</div>
              <p className="mt-1 leading-relaxed text-red-100/80">{appError}</p>
            </div>
          ) : undefined
        }
      />
      {spawnOpen && (
        <SpawnDialog
          characters={characters}
          onClose={() => {
            setSpawnOpen(false);
            setPendingPickId(null);
          }}
          onSubmit={handleSpawn}
          onCreateAvatar={() => {
            setSpawnOpen(false);
            setShowAvatarCreator(true);
          }}
          isSubmitting={isSpawning}
          initialCharacterId={pendingPickId}
        />
      )}
      {showAvatarCreator && (
        <CreateAvatarModal
          onClose={() => {
            setShowAvatarCreator(false);
            // If the user opened the avatar creator from inside the spawn flow,
            // restore the spawn dialog so they don't lose context.
            if (!pendingPickId) setSpawnOpen(true);
          }}
          onCreate={addCustomCharacter}
        />
      )}
      {/* Floating "View Project" trigger — opens a read-only sandbox file viewer.
          Lives outside Layout to avoid touching teammate-owned components. */}
      {roomId && (
        <button
          type="button"
          onClick={() => setShowCodePanel(true)}
          title="Browse the project files in the sandbox"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-line-strong bg-cream/95 px-4 py-2 text-xs font-semibold text-ink shadow-lg backdrop-blur transition hover:bg-paper-hover"
        >
          📁 View Project
        </button>
      )}
      {showCodePanel && roomId && (
        <CodePanel roomId={roomId} onClose={() => setShowCodePanel(false)} />
      )}
    </>
  );
}

// Local row types for the placeholder Convex API. Replaced by Doc<"..."> types once
// `npx convex dev` regenerates _generated/dataModel.d.ts.
type AgentRow = {
  _id: Id<"agents">;
  name: string;
  characterId: string;
  sprite: string;
  color: string;
  position: { x: number; y: number };
  destination?: { x: number; y: number };
  workshopTile?: { x: number; y: number };
  monumentImage?: string;
  status: "idle" | "working" | "stuck" | "done" | "error";
  task: string;
  progress?: number;
  lastMessage?: string;
  runnerSpawnedAt?: number;
  lastActivityAt: number;
};

type TranscriptRow = {
  _id: string;
  role: "agent" | "user" | "system";
  text: string;
  userId?: Id<"users">;
};

type UserRow = {
  _id: Id<"users">;
  name: string;
  color: string;
};

function toAgentView(a: AgentRow): AgentView {
  return {
    id: a._id,
    name: a.name,
    characterId: a.characterId,
    sprite: a.sprite,
    color: a.color,
    position: a.position,
    destination: a.destination,
    workshopTile: a.workshopTile,
    monumentImage: a.monumentImage,
    status: a.status,
    task: a.task,
    progress: a.progress,
    lastMessage: a.lastMessage,
    runnerSpawnedAt: a.runnerSpawnedAt,
    lastActivityAt: a.lastActivityAt,
  };
}

// Entry tile: south-edge midpoint with a small horizontal jitter, so multiple
// concurrent spawns don't all overlap on the same tile.
function pickEntryTile(map: {
  width: number;
  height: number;
}): { x: number; y: number } {
  const cx = Math.floor(map.width / 2);
  const jitter = Math.floor(Math.random() * 5) - 2; // [-2..+2]
  const x = Math.max(1, Math.min(map.width - 2, cx + jitter));
  return { x, y: 1 };
}

// Pick a workshop anchor and return the tile the agent should STAND on — one
// row south of the anchor, just outside the 3×3 construction-site footprint.
// Free tiles win; if all four are taken we fall through to any tile. The
// candidate list is shuffled before nearest-selection so ties from the
// south-edge entry don't always resolve to the same SW slot.
function pickDestination(
  from: { x: number; y: number },
  map: { width: number; height: number },
  occupied: Set<string>,
): { x: number; y: number } {
  const anchors = workshopAnchors(map);
  const standTiles = anchors.map((a) => clampTile({ x: a.x, y: a.y - 2 }, map));
  const free = standTiles.filter((s) => !occupied.has(`${s.x},${s.y}`));
  const pool = free.length > 0 ? free : standTiles;
  return nearestAnchor(from, shuffle(pool));
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function clampTile(
  p: { x: number; y: number },
  map: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: Math.max(1, Math.min(map.width - 2, p.x)),
    y: Math.max(1, Math.min(map.height - 2, p.y)),
  };
}
