import React, { useState, useEffect } from "react";
import { Button, Textarea, Select, Dialog } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Persona, Mood } from "@engine/index";

const MOOD_OPTIONS = [
  { value: "", label: "—" },
  { value: "ember", label: "warm & easy" },
  { value: "heart", label: "tender" },
  { value: "moss", label: "settled" },
  { value: "arcane", label: "searching" },
];

export function BondTab() {
  const s = useAppState();
  const store = useStore();
  const relationship = s.relationship;
  const conversation = s.conversation;

  const [profile, setProfile] = useState("");
  const [affect, setAffect] = useState("");
  const [scene, setScene] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedScene, setSavedScene] = useState(false);
  const [farewellOpen, setFarewellOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void store.engine.listPersonas().then((ps) => {
      if (alive) setPersonas(ps);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  useEffect(() => {
    setProfile(relationship?.profile ?? "");
    setSavedProfile(false);
  }, [relationship?.id]);

  useEffect(() => {
    setAffect(relationship?.affect ?? "");
  }, [relationship?.id, relationship?.affect]);

  useEffect(() => {
    setScene(conversation?.sceneState ?? "");
    setSavedScene(false);
  }, [conversation?.id]);

  if (!relationship) {
    return (
      <div className="dh-studio__pane">
        <p className="dh-studio__note">
          There's no one across from you yet. Step into a conversation, and the shape of what's between
          you will gather here.
        </p>
      </div>
    );
  }

  async function keepProfile() {
    if (!relationship) return;
    await store.engine.updateRelationship({ ...relationship, profile });
    await store.refreshRelationship();
    setSavedProfile(true);
  }

  async function pickPersona(value: string) {
    if (!relationship) return;
    await store.engine.updateRelationship({ ...relationship, personaId: value || null });
    await store.refreshRelationship();
  }

  async function pickMood(value: string) {
    if (!relationship) return;
    const mood = (value || null) as Mood | null;
    await store.engine.updateRelationship({ ...relationship, mood });
    await store.refreshRelationship();
  }

  async function keepAffect() {
    if (!relationship) return;
    await store.engine.updateRelationship({ ...relationship, affect: affect.trim() || null });
    await store.refreshRelationship();
  }

  async function keepScene() {
    if (!conversation) return;
    const c = { ...conversation, sceneState: scene || null };
    await store.engine.updateConversation(c);
    store.setConversation(c);
    setSavedScene(true);
  }

  async function sayGoodbye() {
    if (!conversation) return;
    await store.engine.deleteConversation(conversation.id);
    await store.newConversation();
    setFarewellOpen(false);
  }

  const personaOptions = [
    { value: "", label: "Your default self" },
    ...personas.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">
        The shape of what's between you — the history you share, the in-jokes, the things she knows of
        you that no one else does.
      </p>

      <Textarea
        label="What's between you"
        value={profile}
        rows={8}
        placeholder="How you met. What you've weathered together. The names and references that mean something only to the two of you."
        onChange={(e) => {
          setProfile(e.target.value);
          setSavedProfile(false);
        }}
      />
      <div className="dh-studio__foot" style={{ padding: 0, border: "none" }}>
        {savedProfile ? <span className="dh-studio__saved">Kept.</span> : <span />}
        <Button variant="primary" size="sm" onClick={() => void keepProfile()}>
          Keep
        </Button>
      </div>

      <Select
        label="Who you are with her"
        options={personaOptions}
        value={relationship.personaId ?? ""}
        onChange={(e) => void pickPersona(e.target.value)}
      />
      <p className="dh-field-hint">The persona you bring into this bond — or your default self.</p>

      <Textarea
        label="What she's carrying from last time"
        value={affect}
        rows={2}
        placeholder="She writes this herself after each exchange — how it left her feeling. You can soften it, sharpen it, or clear it."
        onChange={(e) => setAffect(e.target.value)}
      />
      <div className="dh-studio__foot" style={{ padding: 0, border: "none" }}>
        <span />
        <Button variant="primary" size="sm" onClick={() => void keepAffect()}>
          Keep
        </Button>
      </div>

      <Select
        label="The weather between you"
        options={MOOD_OPTIONS}
        value={relationship.mood ?? ""}
        onChange={(e) => void pickMood(e.target.value)}
      />
      <p className="dh-field-hint">A lightweight emotional tint the bond carries forward.</p>

      {conversation ? (
        <>
          <Textarea
            label="The scene right now (optional)"
            value={scene}
            rows={4}
            placeholder="Where you are, what's happening around you — the frame this particular evening sits inside."
            onChange={(e) => {
              setScene(e.target.value);
              setSavedScene(false);
            }}
          />
          <div className="dh-studio__foot" style={{ padding: 0, border: "none" }}>
            {savedScene ? <span className="dh-studio__saved">Kept.</span> : <span />}
            <Button variant="primary" size="sm" onClick={() => void keepScene()}>
              Keep
            </Button>
          </div>
        </>
      ) : null}

      <div className="dh-field-lab">This evening</div>
      <div className="dh-tagrow">
        <Button variant="secondary" size="sm" onClick={() => void store.newConversation()}>
          Begin a new evening
        </Button>
        {conversation ? (
          <Button variant="ghost" size="sm" onClick={() => setFarewellOpen(true)}>
            Say goodbye to this evening
          </Button>
        ) : null}
      </div>

      <Dialog
        open={farewellOpen}
        title="Say goodbye to this evening?"
        description="This conversation and everything said in it will be let go. The bond and the memories it gathered remain — only tonight's thread fades."
        onClose={() => setFarewellOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setFarewellOpen(false)}>
              Stay a while
            </Button>
            <Button variant="heart" size="sm" onClick={() => void sayGoodbye()}>
              Say goodbye
            </Button>
          </>
        }
      />
    </div>
  );
}
