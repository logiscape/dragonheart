import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Checkbox, Dialog, Input, Select } from "@ui/ds";
import { useAppState, useStore } from "@state/store";

/** Create a gathering, or rearrange who's present in an existing one. */
export interface RoomSetupProps {
  open: boolean;
  onClose: () => void;
  /** editing an existing room when set; creating otherwise */
  roomId?: string | null;
}

const IDLE_CHOICES = [
  { value: "60", label: "stirs often (a minute)" },
  { value: "120", label: "stirs sometimes (two minutes)" },
  { value: "300", label: "stirs rarely (five minutes)" },
  { value: "0", label: "waits for you" },
];

export function RoomSetup({ open, onClose, roomId = null }: RoomSetupProps) {
  const store = useStore();
  const s = useAppState();
  const editing = !!roomId;
  const room = editing ? s.rooms.find((r) => r.id === roomId) ?? null : null;

  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [idle, setIdle] = useState(String(s.settings.roomIdleSeconds));
  const [busy, setBusy] = useState(false);

  const presentIds = useMemo(
    () =>
      editing && roomId === s.currentRoomId
        ? s.roomParticipants.map((p) => p.character.id)
        : [],
    [editing, roomId, s.currentRoomId, s.roomParticipants],
  );

  useEffect(() => {
    if (!open) return;
    setName(room?.title ?? "");
    setChosen(new Set(presentIds));
    setIdle(String(s.settings.roomIdleSeconds));
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canConfirm = chosen.size >= 2 && (editing || name.trim().length > 0) && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const idleSeconds = Number(idle);
      if (idleSeconds !== s.settings.roomIdleSeconds) {
        await store.updateSettings({ roomIdleSeconds: idleSeconds });
      }
      if (editing && roomId) {
        if (name.trim() && name.trim() !== room?.title) await store.renameRoom(roomId, name);
        await store.updateRoomParticipants(roomId, [...chosen]);
      } else {
        await store.createRoom(name, [...chosen]);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "The gathering" : "Call a gathering"}
      description={
        editing
          ? "Rearrange who shares the fire."
          : "Choose at least two of your circle to share one fire."
      }
      footer={
        <React.Fragment>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button variant="primary" disabled={!canConfirm} onClick={() => void confirm()}>
            {editing ? "Keep" : "Gather"}
          </Button>
        </React.Fragment>
      }
    >
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <Input
          label="Name this gathering"
          placeholder="The Hearth"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-2) var(--space-4)",
            maxHeight: "16rem",
            overflowY: "auto",
          }}
        >
          {s.characters.map((c) => (
            <Checkbox
              key={c.id}
              checked={chosen.has(c.id)}
              onChange={() => toggle(c.id)}
              label={
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <Avatar src={c.avatarPath} name={c.name} size="xs" mood={c.mood} />
                  <span>
                    {c.name}
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "var(--text-sm)" }}>
                      {c.epithet}
                    </span>
                  </span>
                </span>
              }
            />
          ))}
        </div>

        <Select
          label="When you're quiet, the room…"
          options={IDLE_CHOICES}
          value={idle}
          onChange={(e) => setIdle(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
