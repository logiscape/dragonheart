import React from "react";
import { Select, Switch, Input, Button } from "@ui/ds";
import { useAppState, useStore } from "@state/store";

const NUMCTX_OPTIONS = [
  { value: "8192", label: "A few sessions" },
  { value: "16384", label: "A whole season" },
  { value: "32768", label: "Everything we've shared" },
];

/** The global hearth — models, context, where Ollama lives. Shared between the
 *  per-character Voice tab and the Hall's global studio panel; every field
 *  writes the same app-wide settings. */
export function HearthSettings({ onSaved }: { onSaved: () => void }) {
  const store = useStore();
  const s = useAppState();

  const modelOptions = s.models.length ? s.models : [s.settings.defaultModel];
  const fastOptions = s.models.length ? s.models : [s.settings.fastModel];
  const embedMatches = s.models.filter((m) => m.toLowerCase().includes("embed"));
  const embedOptions = embedMatches.length ? embedMatches : [s.settings.embeddingModel];

  const patchSettings = (patch: Parameters<typeof store.updateSettings>[0]) => {
    void store.updateSettings(patch).then(onSaved);
  };

  return (
    <React.Fragment>
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
        label="How they remember"
        options={embedOptions}
        value={s.settings.embeddingModel}
        onChange={(e) => patchSettings({ embeddingModel: e.target.value })}
      />

      <Select
        label="How much they hold"
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
    </React.Fragment>
  );
}
