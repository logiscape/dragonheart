import React from "react";
import { Avatar, Checkbox, Input, Select, Textarea } from "@ui/ds";
import { useAppState } from "@state/store";

/* The gathering's form fields — name, scene, roster, temperaments — shared by
   the create dialog (RoomSetup) and the open room's side pane (RoomStudio).
   State lives in the caller; both apply it in one batch on confirm. */

const TEMPERAMENT_CHOICES = [
  { value: "0.2", label: "keeps to themselves" },
  { value: "0.5", label: "easy company" },
  { value: "0.8", label: "quick to jump in" },
];

/** Snap an arbitrary 0..1 talkativeness onto the three temperament bands the
 *  judge distinguishes (quiet ≤0.35, neutral, talkative ≥0.65) for display. */
function temperamentValue(t: number): string {
  if (t <= 0.35) return "0.2";
  if (t >= 0.65) return "0.8";
  return "0.5";
}

export interface RoomFieldsProps {
  name: string;
  setName: (v: string) => void;
  scene: string;
  setScene: (v: string) => void;
  chosen: Set<string>;
  toggle: (id: string) => void;
  talk: Record<string, number>;
  setTalk: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  /** cap the roster grid and scroll it internally (for the fixed-height
   *  create dialog); the studio pane scrolls as a whole instead */
  rosterMaxHeight?: string;
}

export function RoomFields({
  name,
  setName,
  scene,
  setScene,
  chosen,
  toggle,
  talk,
  setTalk,
  rosterMaxHeight,
}: RoomFieldsProps) {
  const s = useAppState();
  const chosenCharacters = s.characters.filter((c) => chosen.has(c.id));

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <Input
        label="Name this gathering"
        placeholder="The Hearth"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Textarea
        label="The scene (optional)"
        rows={2}
        placeholder="Where the gathering sits — a tavern corner, a campfire, a kitchen at midnight."
        value={scene}
        onChange={(e) => setScene(e.target.value)}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-2) var(--space-4)",
          ...(rosterMaxHeight ? { maxHeight: rosterMaxHeight, overflowY: "auto" } : {}),
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

      {chosenCharacters.length ? (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <p className="dh-field-lab" style={{ margin: 0 }}>
            In conversation, they…
          </p>
          {chosenCharacters.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                alignItems: "center",
                gap: "var(--space-4)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <Avatar src={c.avatarPath} name={c.name} size="xs" mood={c.mood} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
              </span>
              <Select
                aria-label={`How ${c.name} carries themselves`}
                options={TEMPERAMENT_CHOICES}
                value={temperamentValue(talk[c.id] ?? 0.5)}
                onChange={(e) => setTalk((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
