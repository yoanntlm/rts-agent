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
      const r = await getOrCreateRoom({ name: ROOM_NAME });
      if (cancelled) return;
      setRoomId(r as string);
      const u = await joinRoom({ roomId: r, name: identity.name, color: identity.color });
      if (cancelled) return;
      setUserId(u as string);
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

  const [spawnCharacterId, setSpawnCharacterId] = useState<string | null>(null);
  const spawnAgent = useMutation(api.agents.spawn);
  const sendMessage = useMutation(api.transcript.userMessage);

  const handleSpawn = async (task: string, name?: string) => {
    if (!roomId || !userId || !spawnCharacterId) return;
    const character = getCharacter(spawnCharacterId);
    if (!character) return;
    await spawnAgent({
      roomId,
      ownerUserId: userId,
      characterId: character.id,
      name: name?.trim() || character.name,
      sprite: character.icon,
      color: character.color,
      // Random-ish drop point; in H6 this becomes the user's drop tile.
      position: { x: Math.floor(Math.random() * 18) + 1, y: Math.floor(Math.random() * 12) + 1 },
      task,
    });
    setSpawnCharacterId(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!selectedAgentId || !userId || !text.trim()) return;
    await sendMessage({ agentId: selectedAgentId, userId, text: text.trim() });
  };

  const selectedAgent = agents?.find((a) => a._id === selectedAgentId) ?? null;

  return (
    <>
      <Layout
        topBar={<TopBar roomName={ROOM_NAME} users={usersInRoom ?? []} selfUserId={userId} />}
        roster={
          <Roster
            characters={CHARACTERS}
            selectedCharacterId={spawnCharacterId}
            onSelect={(id) => setSpawnCharacterId(id)}
            disabled={!roomId || !userId}
          />
        }
        world={
          <World
            agents={(agents ?? []).map(toAgentView)}
            mapSize={{ width: 20, height: 14 }}
            onSelectAgent={setSelectedAgentId}
            selectedAgentId={selectedAgentId}
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
          />
        }
      />
      {spawnCharacterId && (
        <SpawnModal
          character={getCharacter(spawnCharacterId)!}
          onClose={() => setSpawnCharacterId(null)}
          onSubmit={handleSpawn}
        />
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
  };
}
