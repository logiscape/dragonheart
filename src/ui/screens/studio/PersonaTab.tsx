import React, { useState, useEffect } from "react";
import { Button, IconButton, Badge, Input, Textarea, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Persona } from "@engine/index";

export function PersonaTab() {
  const store = useStore();
  const s = useAppState();

  const [name, setName] = useState(s.user.displayName);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; profile: string }>>({});
  const [newName, setNewName] = useState("");
  const [newProfile, setNewProfile] = useState("");

  async function reload(): Promise<void> {
    const list = await store.engine.listPersonas();
    setPersonas(list);
    const next: Record<string, { name: string; profile: string }> = {};
    for (const p of list) next[p.id] = { name: p.name, profile: p.profile };
    setDrafts(next);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setName(s.user.displayName);
  }, [s.user.displayName]);

  async function keepName(): Promise<void> {
    await store.setUserName(name.trim() || "traveller");
  }

  async function makeDefault(p: Persona): Promise<void> {
    await store.engine.setDefaultPersona(p.id);
    await reload();
  }

  async function keepPersona(p: Persona): Promise<void> {
    const draft = drafts[p.id] ?? { name: p.name, profile: p.profile };
    await store.engine.updatePersona({ ...p, name: draft.name, profile: draft.profile });
    await reload();
  }

  async function sayGoodbye(p: Persona): Promise<void> {
    await store.engine.deletePersona(p.id);
    await reload();
  }

  async function addPersona(): Promise<void> {
    const n = newName.trim();
    if (!n) return;
    await store.engine.createPersona(n, newProfile.trim());
    setNewName("");
    setNewProfile("");
    await reload();
  }

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">
        How you show up — you can be different people to different souls. These are the faces you wear at the
        fire, and what each one lets a character know about you.
      </p>

      <p className="dh-field-lab">Your name</p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What should they call you?"
      />
      <div className="dh-tagrow">
        <Button variant="secondary" size="sm" leftIcon={<Icons.Check />} onClick={() => void keepName()}>
          Keep
        </Button>
      </div>

      {personas.map((p) => {
        const draft = drafts[p.id] ?? { name: p.name, profile: p.profile };
        return (
          <div key={p.id} className="dh-memory">
            <div className="dh-memory__main">
              <div className="dh-tagrow" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <p className="dh-field-lab" style={{ marginTop: 0 }}>
                  Persona
                </p>
                {p.isDefault ? <Badge tone="ember">default</Badge> : null}
              </div>
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [p.id]: { ...draft, name: e.target.value } }))
                }
                placeholder="How you present under this persona"
              />
              <Textarea
                label="Profile"
                value={draft.profile}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [p.id]: { ...draft, profile: e.target.value } }))
                }
                placeholder="What every character should know about you under this persona."
              />
            </div>
            <div className="dh-memory__actions">
              {p.isDefault ? null : (
                <Button variant="ghost" size="sm" onClick={() => void makeDefault(p)}>
                  Make default
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Icons.Check />}
                onClick={() => void keepPersona(p)}
              >
                Keep
              </Button>
              {p.isDefault ? null : (
                <IconButton label="Say goodbye to this persona" size="sm" onClick={() => void sayGoodbye(p)}>
                  <Icons.Trash />
                </IconButton>
              )}
            </div>
          </div>
        );
      })}

      <p className="dh-field-lab">Add a persona</p>
      <p className="dh-field-hint">Another face for another bond.</p>
      <Input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="A name for this persona"
      />
      <Textarea
        value={newProfile}
        onChange={(e) => setNewProfile(e.target.value)}
        placeholder="What this persona lets a character know about you."
      />
      <div className="dh-tagrow">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icons.Plus />}
          disabled={!newName.trim()}
          onClick={() => void addPersona()}
        >
          Add a persona
        </Button>
      </div>
    </div>
  );
}
