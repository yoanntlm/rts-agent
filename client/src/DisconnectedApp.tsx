import { useState } from "react";
import Layout from "./components/Layout";
import TopBar from "./components/TopBar";
import Roster from "./components/Roster";
import World from "./components/World";
import Inspector from "./components/Inspector";
import SetupBanner from "./components/SetupBanner";
import { CHARACTERS } from "./lib/characters";

// Renders the full UI shell without Convex. Spawning is disabled; the world is empty.
// Useful for previewing the layout before `npx convex dev` has been run.
export default function DisconnectedApp() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  return (
    <Layout
      topBar={<TopBar roomName="demo" users={[]} />}
      roster={
        <Roster
          characters={CHARACTERS}
          onSelect={setSelectedCharacterId}
          selectedCharacterId={selectedCharacterId}
          disabled
        />
      }
      world={<World agents={[]} mapSize={{ width: 20, height: 14 }} onSelectAgent={() => {}} selectedAgentId={null} />}
      inspector={<Inspector agent={null} transcript={[]} onSendMessage={() => {}} disabled />}
      banner={<SetupBanner />}
    />
  );
}
