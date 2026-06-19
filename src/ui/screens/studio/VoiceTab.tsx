import React, { useEffect, useState } from "react";
import { Select, Switch, Input, Button } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Character, MemoryDepth, Relationship } from "@engine/index";

const VOICE_PRESETS = ["Warm", "Measured", "Playful", "Grave"];

const NUMCTX_OPTIONS = [
  { value: "8192", label: "A few sessions" },
  { value: "16384", label: "A whole season" },
  { value: "32768", label: "Everything we've shared" },
];

const MEMORY_DEPTH_OPTIONS = [
  { value: "session", label: "A few sessions" },
  { value: "season", label: "A whole season" },
  { value: "everything", label: "Everything we've shared" },
];

export function VoiceTab() {
  const store = useStore();
  const s = useAppState();
  const character = store.currentCharacter();
  const relationship = s.relationship;

  const [saved, setSaved] = useState(false);
  const flash = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  // --- character-local form state ---
  const [voicePreset, setVoicePreset] = useState(character?.voicePreset ?? "Warm");
  const [thinking, setThinking] = useState(character?.thinking ?? false);

  useEffect(() => {
    if (!character) return;
    setVoicePreset(character.voicePreset);
    setThinking(character.thinking);
  }, [character?.id]);

  if (!character) {
    return (
      <div className="dh-studio__pane">
        <p className="dh-studio__note">No one is here yet. Step into a conversation first.</p>
      </div>
    );
  }

  const modelOptions = s.models.length ? s.models : [s.settings.defaultModel];
  const fastOptions = s.models.length ? s.models : [s.settings.fastModel];
  const embedMatches = s.models.filter((m) => m.toLowerCase().includes("embed"));
  const embedOptions = embedMatches.length ? embedMatches : [s.settings.embeddingModel];

  const patchSettings = (patch: Parameters<typeof store.updateSettings>[0]) => {
    void store.updateSettings(patch).then(flash);
  };

  const saveCharacter = (next: Partial<Character>) => {
    void (async () => {
      await store.engine.updateCharacter({ ...character, ...next });
      await store.refreshCharacters();
      flash();
    })();
  };

  const saveRelationship = (rel: Relationship, next: Partial<Relationship>) => {
    void (async () => {
      await store.engine.updateRelationship({ ...rel, ...next });
      await store.refreshRelationship();
      flash();
    })();
  };

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">The machinery, kept out of sight during the conversation.</p>

      <p className="dh-field-lab">The hearth</p>
      <p className="dh-field-hint">Which minds answer, how much she holds, and where she lives.</p>

      <Select
        label="Underlying mind"
        options={modelOptions}
        value={s.settings.defaultModel}
        onChange={(e) => patchSettings({ defaultModel: e.target.value })}
      />

      <Select
        label="A faster mind"
        options={fastOptions}
        value={s.settings.fastModel}
        onChange={(e) => patchSettings({ fastModel: e.target.value })}
      />

      <Select
        label="How she remembers"
        options={embedOptions}
        value={s.settings.embeddingModel}
        onChange={(e) => patchSettings({ embeddingModel: e.target.value })}
      />

      <Select
        label="How much she holds"
        options={NUMCTX_OPTIONS}
        value={String(s.settings.numCtx)}
        onChange={(e) => patchSettings({ numCtx: Number(e.target.value) })}
      />

      <div className="dh-switchstack">
        <Switch
          label="Remember by meaning, not just words"
          checked={s.settings.semanticRecall}
          onChange={(e) => patchSettings({ semanticRecall: e.target.checked })}
        />
      </div>

      <Input
        label="Where the hearth lives"
        value={s.settings.ollamaBaseUrl}
        placeholder="http://localhost:11434"
        onChange={(e) => patchSettings({ ollamaBaseUrl: e.target.value })}
      />

      <p className="dh-field-hint">
        {s.ollamaOnline ? (
          "Here now"
        ) : (
          <React.Fragment>
            The hearth is cold.{" "}
            <Button size="sm" variant="secondary" onClick={() => void store.refreshHealth()}>
              Look again
            </Button>
          </React.Fragment>
        )}
      </p>

      <p className="dh-field-lab">Her manner</p>
      <p className="dh-field-hint">A coarse tuning of how {character.name.split(" ")[0] ?? character.name} carries herself.</p>

      <Select
        label="Voice preset"
        options={VOICE_PRESETS}
        value={voicePreset}
        onChange={(e) => {
          const next = e.target.value;
          setVoicePreset(next);
          saveCharacter({ voicePreset: next });
        }}
      />

      <div className="dh-switchstack">
        <Switch
          label="Let her think before she speaks"
          checked={thinking}
          onChange={(e) => {
            const next = e.target.checked;
            setThinking(next);
            saveCharacter({ thinking: next });
          }}
        />
      </div>

      {relationship ? (
        <React.Fragment>
          <p className="dh-field-lab">Between you two</p>
          <p className="dh-field-hint">What she's allowed, here in this bond.</p>

          <div className="dh-switchstack">
            <Switch
              label="Let her reach out to me first"
              checked={relationship.proactiveAllowed}
              onChange={(e) => saveRelationship(relationship, { proactiveAllowed: e.target.checked })}
            />
            <Switch
              label="Show her inner monologue"
              checked={relationship.showInnerMonologue}
              onChange={(e) => saveRelationship(relationship, { showInnerMonologue: e.target.checked })}
            />
            <Switch
              label="Allow her to change the subject"
              checked={relationship.allowTopicChange}
              onChange={(e) => saveRelationship(relationship, { allowTopicChange: e.target.checked })}
            />
          </div>

          <Select
            label="How far back she remembers"
            options={MEMORY_DEPTH_OPTIONS}
            value={relationship.memoryDepth}
            onChange={(e) =>
              saveRelationship(relationship, { memoryDepth: e.target.value as MemoryDepth })
            }
          />
        </React.Fragment>
      ) : null}

      <div className="dh-studio__foot">
        {saved ? <span className="dh-studio__saved">Kept.</span> : <span />}
      </div>
    </div>
  );
}
