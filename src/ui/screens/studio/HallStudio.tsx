import React, { useState } from "react";
import { IconButton, Icons, Select } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import { HearthSettings } from "./HearthSettings";

const IDLE_CHOICES = [
  { value: "60", label: "stirs often (a minute)" },
  { value: "120", label: "stirs sometimes (two minutes)" },
  { value: "300", label: "stirs rarely (five minutes)" },
  { value: "0", label: "waits for you" },
];

const CHATTER_CHOICES = [
  { value: "0.3", label: "a word or two" },
  { value: "0.6", label: "an easy back-and-forth" },
  { value: "0.9", label: "a lively tangle" },
];

const SETTLE_CHOICES = [
  { value: "2", label: "after a couple of replies" },
  { value: "4", label: "after a few exchanges" },
  { value: "8", label: "after a long ramble" },
];

/** Snap a stored setting onto the nearest offered choice so the select never
 *  renders blank if the value was ever set outside these presets. */
function nearest(choices: { value: string }[], value: number): string {
  let best = choices[0]!.value;
  let bestDist = Infinity;
  for (const c of choices) {
    const d = Math.abs(Number(c.value) - value);
    if (d < bestDist) {
      bestDist = d;
      best = c.value;
    }
  }
  return best;
}

/** The Hall's studio — settings that belong to the whole house rather than to
 *  one bond: the hearth (models, context, Ollama) and the shared rhythm of
 *  every gathering. */
export function HallStudio() {
  const store = useStore();
  const s = useAppState();
  const [saved, setSaved] = useState(false);
  const flash = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const patchSettings = (patch: Parameters<typeof store.updateSettings>[0]) => {
    void store.updateSettings(patch).then(flash);
  };

  return (
    <div className="dh-studio">
      <header className="dh-studio__head">
        <div className="dh-studio__title">
          <div>
            <p className="dh-eyebrow" style={{ margin: 0 }}>
              The Studio
            </p>
            <h2 className="dh-studio__name">The house itself</h2>
          </div>
        </div>
        <IconButton label="Close the studio" variant="ghost" onClick={() => store.setStudioOpen(false)}>
          <Icons.Close />
        </IconButton>
      </header>

      <div className="dh-studio__body">
        <div className="dh-studio__pane">
          <p className="dh-studio__note">
            What holds for everyone under this roof. Each soul's own voice and manner live in their
            Studio, opened from their conversation.
          </p>

          <p className="dh-field-lab">The hearth</p>
          <p className="dh-field-hint">Which minds answer, how much they hold, and where they live.</p>

          <HearthSettings onSaved={flash} />

          <p className="dh-field-lab">Every gathering</p>
          <p className="dh-field-hint">The rhythm all gatherings share, wherever the fire is lit.</p>

          <Select
            label="When you're quiet, the room…"
            options={IDLE_CHOICES}
            value={nearest(IDLE_CHOICES, s.settings.roomIdleSeconds)}
            onChange={(e) => patchSettings({ roomIdleSeconds: Number(e.target.value) })}
          />

          <Select
            label="Left to themselves, they trade…"
            options={CHATTER_CHOICES}
            value={nearest(CHATTER_CHOICES, s.settings.roomFollowUpBase)}
            onChange={(e) => patchSettings({ roomFollowUpBase: Number(e.target.value) })}
          />

          <Select
            label="…then settle and wait for you"
            options={SETTLE_CHOICES}
            value={nearest(SETTLE_CHOICES, s.settings.roomIdleCapMessages)}
            onChange={(e) => patchSettings({ roomIdleCapMessages: Number(e.target.value) })}
          />

          <div className="dh-studio__foot">
            {saved ? <span className="dh-studio__saved">Kept.</span> : <span />}
          </div>
        </div>
      </div>
    </div>
  );
}
