import React from "react";
import { useAppState } from "@state/store";
import { LoadingVeil } from "@ui/components/LoadingVeil";
import { Welcome } from "@ui/screens/Welcome";
import { Sidebar } from "@ui/screens/Sidebar";
import { Hall } from "@ui/screens/Hall";
import { Conversation } from "@ui/screens/Conversation";
import { CreateCharacter } from "@ui/screens/CreateCharacter";
import { Room } from "@ui/screens/Room";
import { Studio } from "@ui/screens/studio/Studio";
import { HallStudio } from "@ui/screens/studio/HallStudio";
import { RoomStudio } from "@ui/screens/studio/RoomStudio";

export function App() {
  const s = useAppState();

  if (!s.ready) return <LoadingVeil />;
  if (s.view === "welcome") return <Welcome />;

  return (
    <div className="dh-app">
      <Sidebar />
      {s.view === "hall" ? (
        <React.Fragment>
          <Hall />
          {s.studioOpen ? <HallStudio /> : null}
        </React.Fragment>
      ) : s.view === "create" ? (
        <React.Fragment>
          <CreateCharacter />
          {s.studioOpen ? <HallStudio /> : null}
        </React.Fragment>
      ) : s.view === "room" ? (
        <React.Fragment>
          <Room />
          {/* a participant's Studio when one was picked; the room's own otherwise */}
          {s.studioOpen ? (s.currentCharacterId ? <Studio /> : <RoomStudio />) : null}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Conversation />
          {s.studioOpen ? <Studio /> : null}
        </React.Fragment>
      )}
    </div>
  );
}
