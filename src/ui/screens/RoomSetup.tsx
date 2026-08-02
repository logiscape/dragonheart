import React, { useEffect, useState } from "react";
import { Button, Dialog } from "@ui/ds";
import { useStore } from "@state/store";
import { RoomFields } from "./RoomFields";

/** Call a new gathering into being. Tending an existing one happens in the
 *  RoomStudio side pane, opened from inside the room. */
export interface RoomSetupProps {
  open: boolean;
  onClose: () => void;
}

export function RoomSetup({ open, onClose }: RoomSetupProps) {
  const store = useStore();

  const [name, setName] = useState("");
  const [scene, setScene] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [talk, setTalk] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setScene("");
    setChosen(new Set());
    setTalk({});
    setBusy(false);
  }, [open]);

  const toggle = (id: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canConfirm = chosen.size >= 2 && name.trim().length > 0 && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await store.createRoom(name, [...chosen], {
        scene: scene.trim() || null,
        talkativeness: talk,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Call a gathering"
      description="Choose at least two of your circle to share one fire."
      footer={
        <React.Fragment>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button variant="primary" disabled={!canConfirm} onClick={() => void confirm()}>
            Gather
          </Button>
        </React.Fragment>
      }
    >
      <RoomFields
        name={name}
        setName={setName}
        scene={scene}
        setScene={setScene}
        chosen={chosen}
        toggle={toggle}
        talk={talk}
        setTalk={setTalk}
        rosterMaxHeight="16rem"
      />
    </Dialog>
  );
}
