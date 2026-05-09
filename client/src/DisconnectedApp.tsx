import { useState } from "react";
import Layout from "./components/Layout";
import TopBar from "./components/TopBar";
import Roster from "./components/Roster";
import World from "./components/World";
import Inspector from "./components/Inspector";
import SetupBanner from "./components/SetupBanner";
import CreateAvatarModal from "./components/CreateAvatarModal";
import { CHARACTERS } from "./lib/characters";
import {
  loadCustomCharacters,
  saveCustomCharacters,
} from "./lib/customCharacters";
import type { Character } from "./lib/characters";

// Renders the full UI shell without Convex. Spawning is disabled; the world is empty.
// Useful for previewing the layout before `npx convex dev` has been run.
export default function DisconnectedApp() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [customCharacters, setCustomCharacters] = useState<Character[]>(() => loadCustomCharacters());
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const characters = [...CHARACTERS, ...customCharacters];

  const addCustomCharacter = (character: Character) => {
    setCustomCharacters((current) => {
      const next = [...current, character];
      saveCustomCharacters(next);
      return next;
    });
    setSelectedCharacterId(character.id);
    setShowAvatarCreator(false);
  };

  return (
    <>
      <Layout
        topBar={<TopBar roomName="demo" users={[]} connectionStatus="disconnected" />}
        roster={
          <Roster
            characters={characters}
            onSelect={setSelectedCharacterId}
            selectedCharacterId={selectedCharacterId}
            onCreateAvatar={() => setShowAvatarCreator(true)}
            disabled
          />
        }
        world={<World agents={[]} mapSize={{ width: 20, height: 14 }} onSelectAgent={() => {}} selectedAgentId={null} />}
        inspector={<Inspector agent={null} transcript={[]} onSendMessage={() => {}} disabled />}
        banner={<SetupBanner />}
      />
      {showAvatarCreator && (
        <CreateAvatarModal
          onClose={() => setShowAvatarCreator(false)}
          onCreate={addCustomCharacter}
        />
      )}
    </>
  );
}
