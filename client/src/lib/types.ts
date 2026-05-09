// UI-side types. Convex returns its own types via the generated API; these are for
// components that don't need to depend on Convex (e.g. SetupBanner, World in mock mode).

export type AgentStatus = "idle" | "working" | "stuck" | "done" | "error";

export type AgentView = {
  id: string;
  name: string;
  characterId: string;
  color: string;
  position: { x: number; y: number };
  status: AgentStatus;
  task: string;
  progress?: number;
  lastMessage?: string;
};

export type RoomMap = { width: number; height: number };
