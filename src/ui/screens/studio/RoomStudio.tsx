import React, { useState } from "react";
import { Button, Dialog, IconButton, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import { RoomFields } from "../RoomFields";

/** The gathering's own studio — a side pane like a character's Studio, for
 *  the room the user is currently in. Fields are local state; "Keep" applies
 *  everything in one batch (which restarts the session and closes the pane). */
export function RoomStudio() {
  const store = useStore();
  const s = useAppState();
  const room = s.rooms.find((r) => r.id === s.currentRoomId) ?? null;

  const [name, setName] = useState(room?.title ?? "");
  const [scene, setScene] = useState(room?.sceneState ?? "");
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(s.roomParticipants.map((p) => p.character.id)),
  );
  // raw stored values, so an untouched temperament round-trips unchanged
  const [talk, setTalk] = useState<Record<string, number>>(() =>
    Object.fromEntries(s.roomParticipants.map((p) => [p.character.id, p.talkativeness])),
  );
  const [busy, setBusy] = useState(false);
  const [farewellOpen, setFarewellOpen] = useState(false);

  if (!room) return null;

  const toggle = (id: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canKeep = chosen.size >= 2 && !busy;

  const keep = async () => {
    if (!canKeep) return;
    setBusy(true);
    try {
      await store.applyRoomSetup(room.id, {
        name,
        scene: scene.trim() || null,
        characterIds: [...chosen],
        talkativeness: talk,
      });
      // applying re-enters the room, which closes this pane
    } finally {
      setBusy(false);
    }
  };

  const farewell = async () => {
    setBusy(true);
    try {
      await store.deleteRoom(room.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dh-studio">
      <header className="dh-studio__head">
        <div className="dh-studio__title">
          <div>
            <p className="dh-eyebrow" style={{ margin: 0 }}>
              The gathering
            </p>
            <h2 className="dh-studio__name">{room.title ?? "The gathering"}</h2>
          </div>
        </div>
        <IconButton label="Close the studio" variant="ghost" onClick={() => store.setStudioOpen(false)}>
          <Icons.Close />
        </IconButton>
      </header>

      <div className="dh-studio__body">
        <div className="dh-studio__pane">
          <p className="dh-studio__note">
            Tend the fire — who's here, where you are, how they carry themselves. Keep at least two
            of your circle by it.
          </p>

          <RoomFields
            name={name}
            setName={setName}
            scene={scene}
            setScene={setScene}
            chosen={chosen}
            toggle={toggle}
            talk={talk}
            setTalk={setTalk}
          />

          <div className="dh-studio__foot">
            <Button variant="ghost" size="sm" onClick={() => setFarewellOpen(true)}>
              Let it end
            </Button>
            <Button variant="primary" size="sm" disabled={!canKeep} onClick={() => void keep()}>
              Keep
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={farewellOpen}
        title="Let this gathering end?"
        description="The room and everything said in it will be let go. What each of them chose to remember stays with them."
        onClose={() => setFarewellOpen(false)}
        footer={
          <React.Fragment>
            <Button variant="ghost" size="sm" onClick={() => setFarewellOpen(false)}>
              Stay a while
            </Button>
            <Button variant="heart" size="sm" disabled={busy} onClick={() => void farewell()}>
              Let it end
            </Button>
          </React.Fragment>
        }
      />
    </div>
  );
}
