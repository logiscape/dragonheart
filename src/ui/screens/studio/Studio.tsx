import React, { useState } from "react";
import { Tabs, IconButton, Avatar, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import { SoulTab } from "./SoulTab";
import { VoiceTab } from "./VoiceTab";
import { MemoryTab } from "./MemoryTab";
import { LorebookTab } from "./LorebookTab";
import { BondTab } from "./BondTab";
import { PersonaTab } from "./PersonaTab";
import { ProbeTab } from "./ProbeTab";

const STUDIO_TABS = [
  { id: "soul", label: "Soul" },
  { id: "voice", label: "Voice" },
  { id: "memory", label: "Memory" },
  { id: "lore", label: "Lore" },
  { id: "bond", label: "Bond" },
  { id: "persona", label: "You" },
  { id: "probe", label: "Probe" },
];

export function Studio() {
  const store = useStore();
  useAppState(); // subscribe so edits to the current character re-render the studio
  const character = store.currentCharacter();
  const [tab, setTab] = useState("soul");

  if (!character) return null;

  return (
    <div className="dh-studio">
      <header className="dh-studio__head">
        <div className="dh-studio__title">
          <Avatar name={character.name} size="sm" mood={character.mood} />
          <div>
            <p className="dh-eyebrow" style={{ margin: 0 }}>
              Soul Document
            </p>
            <h2 className="dh-studio__name">{character.name}</h2>
          </div>
        </div>
        <IconButton label="Close the studio" variant="ghost" onClick={() => store.setStudioOpen(false)}>
          <Icons.Close />
        </IconButton>
      </header>

      <div className="dh-studio__tabs">
        <Tabs tabs={STUDIO_TABS} value={tab} onChange={setTab} />
      </div>

      <div className="dh-studio__body">
        {tab === "soul" ? (
          <SoulTab />
        ) : tab === "voice" ? (
          <VoiceTab />
        ) : tab === "memory" ? (
          <MemoryTab />
        ) : tab === "lore" ? (
          <LorebookTab />
        ) : tab === "bond" ? (
          <BondTab />
        ) : tab === "persona" ? (
          <PersonaTab />
        ) : (
          <ProbeTab />
        )}
      </div>
    </div>
  );
}
