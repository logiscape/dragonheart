import React from "react";
import { useAppState } from "@state/store";
import { LoadingVeil } from "@ui/components/LoadingVeil";
import { Welcome } from "@ui/screens/Welcome";
import { Sidebar } from "@ui/screens/Sidebar";
import { Hall } from "@ui/screens/Hall";
import { Conversation } from "@ui/screens/Conversation";
import { CreateCharacter } from "@ui/screens/CreateCharacter";
import { Studio } from "@ui/screens/studio/Studio";

export function App() {
  const s = useAppState();

  if (!s.ready) return <LoadingVeil />;
  if (s.view === "welcome") return <Welcome />;

  return (
    <div className="dh-app">
      <Sidebar />
      {s.view === "hall" ? (
        <Hall />
      ) : s.view === "create" ? (
        <CreateCharacter />
      ) : (
        <React.Fragment>
          <Conversation />
          {s.studioOpen ? <Studio /> : null}
        </React.Fragment>
      )}
    </div>
  );
}
