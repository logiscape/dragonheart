import React, { useState, useEffect } from "react";
import { Ornament, Tag, Switch, Input, Textarea, Select, Button, IconButton, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { LoreEntry, LoreScope } from "@engine/index";

function splitKeys(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

interface LoreRowProps {
  entry: LoreEntry;
  reEmbed: boolean;
  onChanged: () => void | Promise<void>;
}

function LoreRow({ entry, reEmbed, onChanged }: LoreRowProps) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const [addingKey, setAddingKey] = useState(false);
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    setEditing(false);
    setDraft(entry.content);
    setAddingKey(false);
    setNewKey("");
  }, [entry.id]);

  async function keepContent() {
    const next = draft.trim();
    setEditing(false);
    if (next === entry.content) return;
    await store.engine.updateLore({ ...entry, content: next }, reEmbed);
    await onChanged();
  }

  async function removeKey(key: string) {
    const keys = entry.keys.filter((k) => k !== key);
    await store.engine.updateLore({ ...entry, keys }, false);
    await onChanged();
  }

  async function addKey() {
    const k = newKey.trim();
    setAddingKey(false);
    setNewKey("");
    if (!k || entry.keys.includes(k)) return;
    await store.engine.updateLore({ ...entry, keys: [...entry.keys, k] }, false);
    await onChanged();
  }

  async function toggleEnabled(enabled: boolean) {
    await store.engine.updateLore({ ...entry, enabled }, false);
    await onChanged();
  }

  async function forget() {
    await store.engine.deleteLore(entry.id);
    await onChanged();
  }

  return (
    <div className="dh-lore">
      <div className="dh-lore__keys">
        {entry.keys.map((k) => (
          <Tag key={k} onRemove={() => void removeKey(k)}>
            {k}
          </Tag>
        ))}
        {addingKey ? (
          <Input
            autoFocus
            value={newKey}
            placeholder="a word that summons it"
            onChange={(e) => setNewKey(e.target.value)}
            onBlur={() => void addKey()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addKey();
              } else if (e.key === "Escape") {
                setAddingKey(false);
                setNewKey("");
              }
            }}
          />
        ) : (
          <Tag interactive icon={<Icons.Plus />} onClick={() => setAddingKey(true)}>
            key
          </Tag>
        )}
      </div>

      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void keepContent()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(entry.content);
              setEditing(false);
            }
          }}
        />
      ) : (
        <p
          className="dh-lore__content"
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(true);
          }}
        >
          {entry.content || "An empty note — click to give it words."}
        </p>
      )}

      <div className="dh-memory__actions" style={{ justifyContent: "space-between" }}>
        <Switch
          label={entry.enabled ? "Alive" : "Resting"}
          checked={entry.enabled}
          onChange={(e) => void toggleEnabled(e.target.checked)}
        />
        <IconButton label="Say goodbye to this note" variant="ghost" size="sm" onClick={() => void forget()}>
          <Icons.Trash />
        </IconButton>
      </div>
    </div>
  );
}

export function LorebookTab() {
  const store = useStore();
  const s = useAppState();
  const character = store.currentCharacter();

  const [charLore, setCharLore] = useState<LoreEntry[]>([]);
  const [relLore, setRelLore] = useState<LoreEntry[]>([]);

  const [scope, setScope] = useState<LoreScope>("character");
  const [keysDraft, setKeysDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");

  const characterId = character?.id ?? null;
  const relationshipId = s.relationship?.id ?? null;
  const reEmbed = s.settings.semanticRecall;

  async function reload() {
    if (characterId) {
      setCharLore(await store.engine.listLore("character", characterId));
    } else {
      setCharLore([]);
    }
    if (relationshipId) {
      setRelLore(await store.engine.listLore("relationship", relationshipId));
    } else {
      setRelLore([]);
    }
  }

  useEffect(() => {
    void reload();
    setScope("character");
    setKeysDraft("");
    setContentDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, relationshipId]);

  if (!character) {
    return (
      <div className="dh-studio__pane">
        <p className="dh-studio__note">No one stands here yet. Choose a companion, and their lore will gather.</p>
      </div>
    );
  }

  const firstName = character.name.split(" ")[0] ?? character.name;

  async function addEntry() {
    const keys = splitKeys(keysDraft);
    const content = contentDraft.trim();
    if (!content) return;
    const ownerId = scope === "character" ? character!.id : relationshipId;
    if (!ownerId) return;
    await store.engine.createLore(scope, ownerId, keys, content);
    setKeysDraft("");
    setContentDraft("");
    await reload();
  }

  const canAdd = contentDraft.trim().length > 0 && (scope === "character" || !!relationshipId);

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">
        Details that surface only when they're spoken of — so nothing crowds the room.
      </p>

      <Ornament label={`True of ${firstName}, always`} />
      {charLore.length === 0 ? (
        <p className="dh-inline-note">Nothing set down yet. The first note begins below.</p>
      ) : (
        charLore.map((entry) => (
          <LoreRow key={entry.id} entry={entry} reEmbed={reEmbed} onChanged={reload} />
        ))
      )}

      <Ornament label="True of you two" />
      {!s.relationship ? (
        <p className="dh-inline-note">
          You haven't sat down together yet — shared lore waits for the bond to begin.
        </p>
      ) : relLore.length === 0 ? (
        <p className="dh-inline-note">Nothing held between you yet. Add what only the two of you know.</p>
      ) : (
        relLore.map((entry) => (
          <LoreRow key={entry.id} entry={entry} reEmbed={reEmbed} onChanged={reload} />
        ))
      )}

      <Ornament label="Add an entry" mark="diamond" />
      <p className="dh-field-lab">Whose truth</p>
      <Select value={scope} onChange={(e) => setScope(e.target.value as LoreScope)}>
        <option value="character">True of them always</option>
        <option value="relationship" disabled={!s.relationship}>
          True of you two
        </option>
      </Select>

      <p className="dh-field-lab">Summoning words</p>
      <p className="dh-field-hint">Comma-separated — the note surfaces when one is spoken of.</p>
      <Input
        value={keysDraft}
        placeholder="lighthouse, the storm, her sister"
        onChange={(e) => setKeysDraft(e.target.value)}
      />

      <p className="dh-field-lab">The note</p>
      <Textarea
        value={contentDraft}
        placeholder="What should be remembered, only when it matters…"
        onChange={(e) => setContentDraft(e.target.value)}
      />

      <div className="dh-studio__foot" style={{ padding: "10px 0 0", border: "none" }}>
        <span />
        <Button variant="primary" leftIcon={<Icons.Plus />} disabled={!canAdd} onClick={() => void addEntry()}>
          Add
        </Button>
      </div>
    </div>
  );
}
