import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Layout from "./components/Layout";
import TopBar from "./components/TopBar";
import Roster from "./components/Roster";
import World from "./components/World";
import Inspector from "./components/Inspector";
import SpawnModal from "./components/SpawnModal";
import { CHARACTERS, getCharacter } from "./lib/characters";
import { getOrCreateIdentity } from "./lib/identity";
import type { AgentView } from "./lib/types";

const ROOM_NAME = "demo";

export default function ConnectedApp() {
  const identity = useMemo(() => getOrCreateIdentity(), []);

  const getOrCreateRoom = useMutation(api.rooms.getOrCreate);
  const joinRoom = useMutation(api.users.join);
  const heartbeat = useMutation(api.users.heartbeat);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Bootstrap: room + user. Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getOrCreateRoom({ name: ROOM_NAME });
        if (cancelled) return;
        setRoomId(r as string);
        const u = await joinRoom({ roomId: r, name: identity.name, color: identity.color });
        if (cancelled) return;
        setUserId(u as string);
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

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const transcript = useQuery(
    api.transcript.byAgent,
    selectedAgentId ? { agentId: selectedAgentId } : "skip",
  ) as TranscriptRow[] | undefined;

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [spawnCharacterId, setSpawnCharacterId] = useState<string | null>(null);
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
    const character = getCharacter(spawnCharacterId);
    if (!character) return;
    setIsSpawning(true);
    setAppError(null);
    try {
      const agentId = (await spawnAgent({
        roomId,
        ownerUserId: userId,
        characterId: character.id,
        name: name?.trim() || character.name,
        sprite: character.icon,
        color: character.color,
        position: spawnPosition ?? {
          x: Math.floor(Math.random() * (20 - 2)) + 1,
          y: Math.floor(Math.random() * (14 - 2)) + 1,
        },
        task,
      })) as string;
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
  const dragCharacter = dragCharacterId ? getCharacter(dragCharacterId) : null;

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
          />
        }
        roster={
          <Roster
            characters={CHARACTERS}
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
            disabled={!roomId || !userId}
          />
        }
        world={
          <World
            agents={(agents ?? []).map(toAgentView)}
            mapSize={{ width: 20, height: 14 }}
            onSelectAgent={setSelectedAgentId}
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
          character={getCharacter(spawnCharacterId)!}
          onClose={() => {
            setSpawnCharacterId(null);
            setSpawnPosition(null);
          }}
          onSubmit={handleSpawn}
          isSubmitting={isSpawning}
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
  _id: string;
  name: string;
  characterId: string;
  color: string;
  position: { x: number; y: number };
  status: "idle" | "working" | "stuck" | "done" | "error";
  task: string;
  progress?: number;
  lastMessage?: string;
  runnerSpawnedAt?: number;
};

type TranscriptRow = {
  _id: string;
  role: "agent" | "user" | "system";
  text: string;
  userId?: string;
};

type UserRow = {
  _id: string;
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
  };
}
