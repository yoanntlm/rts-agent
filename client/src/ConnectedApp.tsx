import { useEffect, useMemo, useState } from "react";
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
import { CHARACTERS, getCharacter } from "./lib/characters";
import { loadCustomCharacters, saveCustomCharacters } from "./lib/customCharacters";
import { getOrCreateIdentity } from "./lib/identity";
import type { AgentView } from "./lib/types";
import type { Character } from "./lib/characters";

const MAP_SIZE = { width: 28, height: 20 };

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
  const [isSpawning, setIsSpawning] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const spawnAgent = useMutation(api.agents.spawn);
  const sendMessage = useMutation(api.transcript.userMessage);

  const handleSpawn = async (characterId: string, task: string, name?: string) => {
    if (!roomId || !userId) return;
    const character = characters.find((c) => c.id === characterId) ?? getCharacter(characterId);
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
        systemPrompt: character.systemPrompt,
        position: pickSpawnPosition(occupied, mapSize),
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
