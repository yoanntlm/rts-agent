import Layout from "./components/Layout";
import TopBar from "./components/TopBar";
import World from "./components/World";
import Inspector from "./components/Inspector";
import SetupBanner from "./components/SetupBanner";

const MAP_SIZE = { width: 28, height: 20 };

// Renders the full UI shell without Convex. Spawning is disabled; the world is empty.
// Useful for previewing the layout before `npx convex dev` has been run.
export default function DisconnectedApp() {
  return (
    <Layout
      topBar={<TopBar roomName="demo" users={[]} connectionStatus="disconnected" />}
      world={
        <World
          agents={[]}
          mapSize={MAP_SIZE}
          onSelectAgent={() => {}}
          selectedAgentId={null}
        />
      }
      inspector={<Inspector agent={null} transcript={[]} onSendMessage={() => {}} disabled />}
      banner={<SetupBanner />}
    />
  );
}
