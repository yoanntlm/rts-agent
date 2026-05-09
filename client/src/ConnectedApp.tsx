import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import Layout from "./components/Layout";
import TopBar from "./components/TopBar";
import Roster from "./components/Roster";
import World from "./components/World";
import Inspector from "./components/Inspector";
import SpawnModal from "./components/SpawnModal";
import CreateAvatarModal from "./components/CreateAvatarModal";
import { CHARACTERS, getCharacter } from "./lib/characters";
import { loadCustomCharacters, saveCustomCharacters } from "./lib/customCharacters";
import { getOrCreateIdentity } from "./lib/identity";
import type { AgentView } from "./lib/types";
import type { Character } from "./lib/characters";

const ROOM_NAME = "demo";
const MAP_SIZE = { width: 28, height: 20 };

export default function ConnectedApp() {
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
        const r = await getOrCreateRoom({ name: ROOM_NAME });
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

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [spawnCharacterId, setSpawnCharacterId] = useState<string | null>(null);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [spawnPosition, setSpawnPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragCharacterId, setDragCharacterId] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [isSpawning, setIsSpawning] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const spawnAgent = useMutation(api.agents.spawn);
  const sendMessage = useMutation(api.transcript.userMessage);

  const handleSpawn = async (task: string, name?: string) => {
    if (!roomId || !userId || !spawnCharacterId) return;
    const character = characters.find((c) => c.id === spawnCharacterId) ?? getCharacter(spawnCharacterId);
    if (!character) return;
    setIsSpawning(true);
    setAppError(null);
    try {
      const occupied = new Set((agents ?? []).map((a) => `${a.position.x},${a.position.y}`));
      const agentId = (await spawnAgent({
        roomId,
        ownerUserId: userId,
        characterId: character.id,
        name: name?.trim() || character.name,
        sprite: character.icon,
        color: character.color,
        position: spawnPosition ?? pickSpawnPosition(occupied, mapSize),
        task,
      })) as Id<"agents">;
      setSelectedAgentId(agentId);
      setSelectedCharacterId(null);
      setSpawnCharacterId(null);
      setSpawnPosition(null);
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Failed to spawn agent.");
    } finally {
      setIsSpawning(false);
    }
  };

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

  const selectedAgent = agents?.find((a) => a._id === selectedAgentId) ?? null;
  const dragCharacter = dragCharacterId ? characters.find((c) => c.id === dragCharacterId) : null;

  const addCustomCharacter = (character: Character) => {
    setCustomCharacters((current) => {
      const next = [...current, character];
      saveCustomCharacters(next);
      return next;
    });
    setSelectedCharacterId(character.id);
    setShowAvatarCreator(false);
  };

  useEffect(() => {
    if (!dragCharacterId) return;

    const onPointerMove = (event: PointerEvent) => {
      setDragPoint({ x: event.clientX, y: event.clientY });
    };
    const onPointerUp = () => {
      setDragCharacterId(null);
      setDragPoint(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDragCharacterId(null);
        setDragPoint(null);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dragCharacterId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !spawnCharacterId) {
        setSelectedAgentId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spawnCharacterId]);

  return (
    <>
      <Layout
        topBar={
          <TopBar
            roomName={ROOM_NAME}
            users={usersInRoom ?? []}
            selfUserId={userId}
            connectionStatus={roomId ? "connected" : "reconnecting"}
            runnerBanner={runnerBanner}
          />
        }
        roster={
          <Roster
            characters={characters}
            selectedCharacterId={selectedCharacterId}
            onSelect={setSelectedCharacterId}
            onDescribeTask={() => {
              if (selectedCharacterId) {
                setSpawnPosition(null);
                setSpawnCharacterId(selectedCharacterId);
              }
            }}
            onBeginDrag={(id) => {
              setSelectedCharacterId(id);
              setDragCharacterId(id);
            }}
            onCreateAvatar={() => setShowAvatarCreator(true)}
            disabled={!roomId || !userId}
            runnerBanner={runnerBanner}
          />
        }
        world={
          <World
            agents={(agents ?? []).map(toAgentView)}
            mapSize={mapSize}
            onSelectAgent={(id) => setSelectedAgentId(id as Id<"agents"> | null)}
            selectedAgentId={selectedAgentId}
            placementColor={dragCharacter?.color ?? null}
            onPlaceAgent={(position) => {
              if (!dragCharacterId) return;
              setSpawnPosition(position);
              setSpawnCharacterId(dragCharacterId);
              setDragCharacterId(null);
              setDragPoint(null);
            }}
          />
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
      {spawnCharacterId && (
        <SpawnModal
          character={characters.find((c) => c.id === spawnCharacterId)!}
          onClose={() => {
            setSpawnCharacterId(null);
            setSpawnPosition(null);
          }}
          onSubmit={handleSpawn}
          isSubmitting={isSpawning}
        />
      )}
      {showAvatarCreator && (
        <CreateAvatarModal
          onClose={() => setShowAvatarCreator(false)}
          onCreate={addCustomCharacter}
        />
      )}
      {dragCharacter && dragPoint && (
        <div
          className="pointer-events-none fixed z-50 flex h-12 w-12 items-center justify-center rounded-lg text-sm font-black text-stone-950 opacity-80 shadow-2xl"
          style={{
            left: dragPoint.x + 14,
            top: dragPoint.y + 14,
            background: `linear-gradient(180deg, ${dragCharacter.color}, color-mix(in srgb, ${dragCharacter.color} 60%, #0c0a09))`,
            boxShadow: `0 0 24px ${dragCharacter.color}55`,
          }}
        >
          {dragCharacter.name.slice(0, 2).toUpperCase()}
        </div>
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
  color: string;
  position: { x: number; y: number };
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
    color: a.color,
    position: a.position,
    status: a.status,
    task: a.task,
    progress: a.progress,
    lastMessage: a.lastMessage,
    runnerSpawnedAt: a.runnerSpawnedAt,
    lastActivityAt: a.lastActivityAt,
  };
}

function pickSpawnPosition(
  occupied: Set<string>,
  map: { width: number; height: number },
): { x: number; y: number } {
  const opts: { x: number; y: number }[] = [];
  for (let x = 1; x < map.width - 1; x++) {
    for (let y = 1; y < map.height - 1; y++) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) opts.push({ x, y });
    }
  }
  if (opts.length === 0) return { x: 1, y: 1 };
  return opts[Math.floor(Math.random() * opts.length)]!;
}
