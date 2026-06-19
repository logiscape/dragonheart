import React, { useState } from "react";
import { Button, Input, Textarea, Tabs, Toast, Icons } from "@ui/ds";
import { useStore } from "@state/store";
import { pickOpenPath, readBytes } from "@adapters/tauriFiles";
import type { SoulDocument } from "@engine/index";

type Mode = "guided" | "freeform" | "import";

const TABS = [
  { id: "guided", label: "Guided" },
  { id: "freeform", label: "Free-form" },
  { id: "import", label: "Import a card" },
];

/** Format a comma list for editing soul fields that hold string arrays. */
function listToText(values: string[]): string {
  return values.join(", ");
}
function textToList(text: string): string[] {
  return text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function CreateCharacter() {
  const store = useStore();
  const [mode, setMode] = useState<Mode>("guided");

  // --- shared identity ---
  const [name, setName] = useState("");
  const [epithet, setEpithet] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- guided ---
  const [sketch, setSketch] = useState("");
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState<SoulDocument | null>(null);
  const [coreIdentity, setCoreIdentity] = useState("");
  const [drives, setDrives] = useState("");
  const [wounds, setWounds] = useState("");
  const [voice, setVoice] = useState("");
  const [contradiction, setContradiction] = useState("");
  const [tells, setTells] = useState("");
  const [valuesText, setValuesText] = useState("");

  // --- free-form ---
  const [blurb, setBlurb] = useState("");
  const [freeform, setFreeform] = useState("");

  const canName = name.trim().length > 0;

  async function imagineThem() {
    if (!canName || thinking) return;
    setError(null);
    setThinking(true);
    try {
      const soul = await store.engine.draftSoulFromSketch(name.trim(), sketch.trim());
      setDraft(soul);
      setCoreIdentity(soul.coreIdentity);
      setDrives(soul.drives);
      setWounds(soul.wounds);
      setVoice(soul.voice);
      setContradiction(soul.contradiction);
      setTells(soul.tells);
      setValuesText(listToText(soul.values));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setThinking(false);
    }
  }

  async function bringToLifeGuided() {
    if (!canName || !draft || busy) return;
    setError(null);
    setBusy(true);
    try {
      const soul: SoulDocument = {
        ...draft,
        coreIdentity,
        drives,
        wounds,
        voice,
        contradiction,
        tells,
        values: textToList(valuesText),
        freeform: "",
      };
      const ch = await store.engine.createCharacter({
        name: name.trim(),
        epithet: epithet.trim(),
        soul,
        firstMessage: firstMessage.trim(),
        mood: "ember",
        traits: [],
      });
      await store.createAndOpen(ch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function bringToLifeFreeform() {
    if (!canName || busy) return;
    setError(null);
    setBusy(true);
    try {
      const ch = await store.engine.createCharacter({
        name: name.trim(),
        epithet: epithet.trim(),
        blurb: blurb.trim(),
        soul: { ...store.engine.blankSoul(), freeform: freeform.trim() },
        firstMessage: firstMessage.trim(),
        mood: "ember",
        traits: [],
      });
      await store.createAndOpen(ch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function chooseCard() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const path = await pickOpenPath([{ name: "Character cards", extensions: ["png", "json"] }]);
      if (!path) {
        setBusy(false);
        return;
      }
      const bytes = await readBytes(path);
      const ch = await store.engine.importCard(bytes);
      await store.createAndOpen(ch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="dh-sheet">
      <div className="dh-sheet__col">
        <h1 className="dh-sheet__title">Begin a new bond</h1>
        <p className="dh-sheet__sub">
          Some you imagine from a whisper; some you write whole; some arrive carrying a card.
        </p>

        <Tabs tabs={TABS} value={mode} onChange={(id) => setMode(id as Mode)} />

        {error ? (
          <Toast tone="heart" title="That didn't take" onClose={() => setError(null)}>
            {error}
          </Toast>
        ) : null}

        {mode === "guided" ? (
          <div className="dh-studio__pane">
            <p className="dh-studio__note">
              Give them a name and a few sentences. The hearth will dream the rest, and you can shape it
              before they wake.
            </p>

            <Input
              label="Name"
              placeholder="What shall we call them?"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Epithet"
              placeholder="Keeper of the lighthouse"
              value={epithet}
              onChange={(e) => setEpithet(e.target.value)}
            />
            <Textarea
              label="Sketch"
              placeholder="A few sentences about who they are…"
              value={sketch}
              onChange={(e) => setSketch(e.target.value)}
            />

            <div>
              <Button
                variant="secondary"
                leftIcon={<Icons.Sparkle />}
                disabled={!canName || thinking}
                onClick={() => void imagineThem()}
              >
                {thinking ? "Dreaming them up…" : "Imagine them"}
              </Button>
            </div>

            {draft ? (
              <>
                <p className="dh-field-lab">Core identity</p>
                <Textarea value={coreIdentity} onChange={(e) => setCoreIdentity(e.target.value)} />
                <p className="dh-field-lab">Drives</p>
                <Textarea value={drives} onChange={(e) => setDrives(e.target.value)} />
                <p className="dh-field-lab">Wounds</p>
                <Textarea value={wounds} onChange={(e) => setWounds(e.target.value)} />
                <p className="dh-field-lab">Voice</p>
                <Textarea value={voice} onChange={(e) => setVoice(e.target.value)} />
                <p className="dh-field-lab">Contradiction</p>
                <Textarea value={contradiction} onChange={(e) => setContradiction(e.target.value)} />
                <p className="dh-field-lab">Tells</p>
                <p className="dh-field-hint">What they do when frightened, moved, or lying.</p>
                <Textarea value={tells} onChange={(e) => setTells(e.target.value)} />
                <p className="dh-field-lab">Values</p>
                <p className="dh-field-hint">A comma-separated list of lines they won't cross.</p>
                <Textarea value={valuesText} onChange={(e) => setValuesText(e.target.value)} />

                <Textarea
                  label="First message"
                  placeholder="The first thing they say when you sit down together…"
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                />

                <div>
                  <Button
                    variant="primary"
                    leftIcon={<Icons.Flame />}
                    disabled={!canName || busy}
                    onClick={() => void bringToLifeGuided()}
                  >
                    {busy ? "Lighting the wick…" : "Bring them to life"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {mode === "freeform" ? (
          <div className="dh-studio__pane">
            <p className="dh-studio__note">
              For when you already know them. Write their soul in your own words, and it goes to them
              whole, unstructured.
            </p>

            <Input
              label="Name"
              placeholder="What shall we call them?"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Epithet"
              placeholder="Keeper of the lighthouse"
              value={epithet}
              onChange={(e) => setEpithet(e.target.value)}
            />
            <Textarea
              label="Blurb"
              placeholder="A short line for their card in the Hall…"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
            />
            <Textarea
              label="Soul"
              placeholder="Everything that makes them who they are — drives, wounds, voice, the way they hold a room…"
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              style={{ minHeight: "16rem" }}
            />
            <Textarea
              label="First message"
              placeholder="The first thing they say when you sit down together…"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
            />

            <div>
              <Button
                variant="primary"
                leftIcon={<Icons.Flame />}
                disabled={!canName || busy}
                onClick={() => void bringToLifeFreeform()}
              >
                {busy ? "Lighting the wick…" : "Bring them to life"}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "import" ? (
          <div className="dh-studio__pane">
            <p className="dh-studio__note">
              Bring someone home from elsewhere. A character card — a PNG with their soul tucked inside,
              or a plain JSON — carries their name, voice, greeting, and lore across the threshold.
            </p>

            <div>
              <Button
                variant="secondary"
                leftIcon={<Icons.Upload />}
                disabled={busy}
                onClick={() => void chooseCard()}
              >
                {busy ? "Reading the card…" : "Choose a card…"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="dh-studio__foot">
          <Button variant="ghost" leftIcon={<Icons.Back />} onClick={() => store.gotoHall()}>
            Back to the Hall
          </Button>
        </div>
      </div>
    </main>
  );
}
