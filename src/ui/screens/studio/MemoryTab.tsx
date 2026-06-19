import React, { useEffect, useState } from "react";
import { Button, IconButton, Badge, Switch, Textarea, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Memory } from "@engine/index";

export function MemoryTab() {
  const store = useStore();
  const s = useAppState();
  const relationship = s.relationship;
  const conversation = s.conversation;

  const [mems, setMems] = useState<Memory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");
  const [gathering, setGathering] = useState(false);
  const [gatherNote, setGatherNote] = useState<string | null>(null);

  const relationshipId = relationship?.id ?? null;

  useEffect(() => {
    if (!relationshipId) return;
    let alive = true;
    void store.engine.listMemories(relationshipId).then((list) => {
      if (alive) setMems(list);
    });
    return () => {
      alive = false;
    };
  }, [relationshipId, store]);

  if (!relationship) {
    return (
      <div className="dh-studio__pane">
        <p className="dh-studio__note">
          No bond is open yet. Sit with someone, and what you share will gather here.
        </p>
      </div>
    );
  }

  async function reload() {
    setMems(await store.engine.listMemories(relationship!.id));
  }

  function beginEdit(m: Memory) {
    setEditingId(m.id);
    setDraft(m.content);
  }

  async function keepEdit(m: Memory) {
    const content = draft.trim();
    if (content && content !== m.content) {
      await store.engine.updateMemory({ ...m, content }, true);
    }
    setEditingId(null);
    setDraft("");
    await reload();
  }

  async function togglePin(m: Memory) {
    await store.engine.updateMemory({ ...m, pinned: !m.pinned });
    await reload();
  }

  async function toggleEnabled(m: Memory, enabled: boolean) {
    await store.engine.updateMemory({ ...m, enabled });
    await reload();
  }

  async function forget(m: Memory) {
    await store.engine.deleteMemory(m.id);
    if (editingId === m.id) setEditingId(null);
    await reload();
  }

  async function keepNew() {
    const content = adding.trim();
    if (!content) return;
    await store.engine.addMemory(relationship!.id, content);
    setAdding("");
    await reload();
  }

  async function gather() {
    if (!conversation || gathering) return;
    setGathering(true);
    setGatherNote(null);
    try {
      const created = await store.engine.extractMemoriesNow(conversation.id);
      await reload();
      setGatherNote(
        created.length === 0
          ? "Nothing new to keep from this evening."
          : `Kept ${created.length} new thing${created.length === 1 ? "" : "s"}.`,
      );
    } finally {
      setGathering(false);
    }
  }

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">
        What she carries between sessions. Prune freely — forgetting is a kindness too.
      </p>

      {mems.length === 0 ? (
        <p className="dh-field-hint">Nothing kept yet. The first evening will leave its traces.</p>
      ) : (
        mems.map((m) => (
          <div key={m.id} className="dh-memory">
            <div className="dh-memory__main">
              {editingId === m.id ? (
                <>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                  />
                  <Button size="sm" onClick={() => void keepEdit(m)} style={{ marginTop: 8 }}>
                    Keep
                  </Button>
                </>
              ) : (
                <>
                  <p
                    className="dh-memory__t"
                    onClick={() => beginEdit(m)}
                    style={{ cursor: "text" }}
                    title="Click to revise"
                  >
                    {m.content}
                  </p>
                  <p className="dh-memory__d">
                    <Badge tone={m.kind === "tender" ? "heart" : "moss"}>
                      {m.kind === "tender" ? "tender" : "kept"}
                    </Badge>{" "}
                    {m.kind} · salience {m.salience.toFixed(2)}
                  </p>
                </>
              )}
            </div>
            <div className="dh-memory__actions">
              <IconButton
                label={m.pinned ? "Let it drift" : "Hold this close"}
                variant={m.pinned ? "ember" : "ghost"}
                size="sm"
                onClick={() => void togglePin(m)}
              >
                <Icons.Pin />
              </IconButton>
              <Switch
                checked={m.enabled}
                onChange={(e) => void toggleEnabled(m, e.target.checked)}
              />
              <IconButton
                label="Say goodbye"
                variant="ghost"
                size="sm"
                onClick={() => void forget(m)}
              >
                <Icons.Trash />
              </IconButton>
            </div>
          </div>
        ))
      )}

      <p className="dh-field-lab">Add a memory</p>
      <Textarea
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        placeholder="Something worth carrying forward…"
      />
      <div className="dh-tagrow">
        <Button variant="secondary" size="sm" disabled={!adding.trim()} onClick={() => void keepNew()}>
          Keep this
        </Button>
        {conversation ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icons.Sparkle />}
            disabled={gathering}
            onClick={() => void gather()}
          >
            {gathering ? "Gathering…" : "Gather memories from this evening"}
          </Button>
        ) : null}
        {gatherNote ? <span className="dh-studio__saved">{gatherNote}</span> : null}
      </div>
    </div>
  );
}
