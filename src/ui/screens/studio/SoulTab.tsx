import React, { useState, useEffect } from "react";
import { Button, Input, Textarea, Switch, Tag, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { DialogueExchange, SoulDocument, SpeechRegister } from "@engine/index";

export function SoulTab() {
  const store = useStore();
  useAppState(); // subscribe so the pane re-renders as the character changes
  const character = store.currentCharacter();

  const [name, setName] = useState("");
  const [epithet, setEpithet] = useState("");
  const [blurb, setBlurb] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [greetingDropcap, setGreetingDropcap] = useState(true);

  const [freehand, setFreehand] = useState(false);
  const [freeform, setFreeform] = useState("");

  const [coreIdentity, setCoreIdentity] = useState("");
  const [drives, setDrives] = useState("");
  const [wounds, setWounds] = useState("");
  const [voice, setVoice] = useState("");
  const [relationalStance, setRelationalStance] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [contradiction, setContradiction] = useState("");
  const [tells, setTells] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [valueDraft, setValueDraft] = useState("");
  const [registers, setRegisters] = useState<SpeechRegister[]>([]);
  const [examples, setExamples] = useState<DialogueExchange[]>([]);

  const [sketch, setSketch] = useState("");
  const [imagining, setImagining] = useState(false);
  const [kept, setKept] = useState(false);

  const characterId = character?.id;

  useEffect(() => {
    if (!character) return;
    const soul = character.soul;
    setName(character.name);
    setEpithet(character.epithet);
    setBlurb(character.blurb);
    setFirstMessage(character.firstMessage);
    setGreetingDropcap(character.greetingDropcap);
    setFreeform(soul.freeform ?? "");
    setFreehand(!!soul.freeform && soul.freeform.trim().length > 0);
    setCoreIdentity(soul.coreIdentity);
    setDrives(soul.drives);
    setWounds(soul.wounds);
    setVoice(soul.voice);
    setRelationalStance(soul.relationalStance);
    setKnowledge(soul.knowledge);
    setContradiction(soul.contradiction);
    setTells(soul.tells);
    setValues(soul.values);
    setRegisters(soul.registers ?? []);
    setExamples(soul.exampleDialogue ?? []);
    setValueDraft("");
    setSketch("");
    setKept(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  useEffect(() => {
    if (!kept) return;
    const t = setTimeout(() => setKept(false), 2000);
    return () => clearTimeout(t);
  }, [kept]);

  if (!character) {
    return (
      <div className="dh-studio__pane">
        <p className="dh-studio__note">No one is here to shape yet. Step into a bond first.</p>
      </div>
    );
  }

  const addValue = (): void => {
    const v = valueDraft.trim();
    if (!v || values.includes(v)) {
      setValueDraft("");
      return;
    }
    setValues([...values, v]);
    setValueDraft("");
  };

  const removeValue = (v: string): void => {
    setValues(values.filter((x) => x !== v));
  };

  const imagine = async (): Promise<void> => {
    const sk = sketch.trim();
    if (!sk || imagining) return;
    setImagining(true);
    try {
      const soul = await store.engine.draftSoulFromSketch(name, sk);
      setFreehand(false);
      setCoreIdentity(soul.coreIdentity);
      setDrives(soul.drives);
      setWounds(soul.wounds);
      setVoice(soul.voice);
      setRelationalStance(soul.relationalStance);
      setKnowledge(soul.knowledge);
      setContradiction(soul.contradiction);
      setTells(soul.tells);
      setValues(soul.values);
      setRegisters(soul.registers ?? []);
      setExamples(soul.exampleDialogue ?? []);
    } finally {
      setImagining(false);
    }
  };

  const keep = async (): Promise<void> => {
    const soul: SoulDocument = {
      coreIdentity,
      drives,
      wounds,
      values,
      voice,
      relationalStance,
      knowledge,
      contradiction,
      tells,
      registers: registers.filter((r) => r.when.trim() || r.how.trim()),
      exampleDialogue: examples.filter((e) => e.user.trim() && e.character.trim()),
      freeform: freehand ? freeform : "",
    };
    const updated = {
      ...character,
      name,
      epithet,
      blurb,
      firstMessage,
      greetingDropcap,
      soul,
    };
    await store.engine.updateCharacter(updated);
    await store.refreshCharacters();
    setKept(true);
  };

  const setRegisterAt = (i: number, patch: Partial<SpeechRegister>): void => {
    setRegisters(registers.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const setExampleAt = (i: number, patch: Partial<DialogueExchange>): void => {
    setExamples(examples.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  };

  const soulLength = freehand
    ? freeform.length
    : [
        coreIdentity, drives, wounds, voice, relationalStance, knowledge, contradiction, tells,
        values.join(" "),
        registers.map((r) => r.when + r.how).join(" "),
        examples.map((e) => e.user + e.character).join(" "),
      ]
        .join(" ")
        .length;
  const approxTokens = Math.round(soulLength / 4);
  const budgetCeiling = 1200;
  const fillPct = Math.min(100, Math.round((approxTokens / budgetCeiling) * 100));

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">
        This is who she is beneath everything — not instructions, but identity. Her behavior emerges from here.
      </p>

      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="What they answer to" />
      <Input
        label="Epithet"
        value={epithet}
        onChange={(e) => setEpithet(e.target.value)}
        placeholder="Keeper of the lighthouse"
      />
      <Textarea
        label="Blurb"
        value={blurb}
        rows={2}
        onChange={(e) => setBlurb(e.target.value)}
        placeholder="A few words for the Hall card"
      />

      <div className="dh-switchstack">
        <Switch
          label="Write it freehand"
          checked={freehand}
          onChange={(e) => setFreehand(e.target.checked)}
        />
      </div>

      {freehand ? (
        <>
          <p className="dh-field-hint">Your words, used verbatim. The structure below rests while this is on.</p>
          <Textarea
            value={freeform}
            rows={14}
            onChange={(e) => setFreeform(e.target.value)}
            placeholder="Pour the whole of them onto the page…"
          />
        </>
      ) : (
        <>
          <label className="dh-field-lab">Core identity</label>
          <Textarea
            value={coreIdentity}
            rows={2}
            onChange={(e) => setCoreIdentity(e.target.value)}
            placeholder="The one-line truth of who they are"
          />

          <label className="dh-field-lab">What drives them</label>
          <Textarea
            value={drives}
            rows={3}
            onChange={(e) => setDrives(e.target.value)}
            placeholder="What they move toward, and away from"
          />

          <label className="dh-field-lab">The wound</label>
          <Textarea
            value={wounds}
            rows={3}
            onChange={(e) => setWounds(e.target.value)}
            placeholder="What shaped them; what they protect"
          />

          <label className="dh-field-lab">How they speak</label>
          <Textarea
            value={voice}
            rows={3}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="Rhythm, vocabulary, humor — a sample line or two"
          />

          <label className="dh-field-lab">How their voice shifts</label>
          <p className="dh-field-hint">No one speaks in a single register. Name the moments, and how the voice changes in them.</p>
          {registers.map((r, i) => (
            <div key={i} style={{ marginBottom: "0.75rem" }}>
              <Input
                value={r.when}
                onChange={(e) => setRegisterAt(i, { when: e.target.value })}
                placeholder="When… (everyday talk / their passion ignites / put on the spot)"
              />
              <Textarea
                value={r.how}
                rows={2}
                onChange={(e) => setRegisterAt(i, { how: e.target.value })}
                placeholder="…the voice becomes"
              />
              <div className="dh-tagrow">
                <Tag interactive onClick={() => setRegisters(registers.filter((_, j) => j !== i))}>
                  Remove
                </Tag>
              </div>
            </div>
          ))}
          <div className="dh-tagrow">
            <Tag interactive onClick={() => setRegisters([...registers, { when: "", how: "" }])}>
              Add a register
            </Tag>
          </div>

          <label className="dh-field-lab">The voice in practice</label>
          <p className="dh-field-hint">Short example exchanges — cadence to inhabit, never lines to repeat. One per register works well.</p>
          {examples.map((ex, i) => (
            <div key={i} style={{ marginBottom: "0.75rem" }}>
              <Textarea
                value={ex.user}
                rows={1}
                onChange={(e) => setExampleAt(i, { user: e.target.value })}
                placeholder="Someone says to them…"
              />
              <Textarea
                value={ex.character}
                rows={2}
                onChange={(e) => setExampleAt(i, { character: e.target.value })}
                placeholder="…and they answer, in their true voice"
              />
              <div className="dh-tagrow">
                <Tag interactive onClick={() => setExamples(examples.filter((_, j) => j !== i))}>
                  Remove
                </Tag>
              </div>
            </div>
          ))}
          <div className="dh-tagrow">
            <Tag interactive onClick={() => setExamples([...examples, { user: "", character: "" }])}>
              Add an exchange
            </Tag>
          </div>

          <label className="dh-field-lab">How they treat people</label>
          <Textarea
            value={relationalStance}
            rows={2}
            onChange={(e) => setRelationalStance(e.target.value)}
            placeholder="Their general stance toward others"
          />

          <label className="dh-field-lab">What they know</label>
          <Textarea
            value={knowledge}
            rows={2}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder="The world they live in; what they don't know"
          />

          <label className="dh-field-lab">A contradiction</label>
          <Textarea
            value={contradiction}
            rows={2}
            onChange={(e) => setContradiction(e.target.value)}
            placeholder="What makes them real rather than pleasant"
          />

          <label className="dh-field-lab">Tells</label>
          <Textarea
            value={tells}
            rows={2}
            onChange={(e) => setTells(e.target.value)}
            placeholder="What they do when frightened, moved, lying"
          />

          <label className="dh-field-lab">Values</label>
          <p className="dh-field-hint">The lines they will and won't cross.</p>
          <div className="dh-tagrow">
            {values.map((v) => (
              <Tag key={v} onRemove={() => removeValue(v)}>
                {v}
              </Tag>
            ))}
          </div>
          <Input
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addValue();
              }
            }}
            placeholder="Name a value, then press Enter"
            rightIcon={
              valueDraft.trim() ? (
                <Tag interactive onClick={addValue}>
                  Add
                </Tag>
              ) : null
            }
          />
        </>
      )}

      <Textarea
        label="Their first words to you"
        value={firstMessage}
        rows={3}
        onChange={(e) => setFirstMessage(e.target.value)}
        placeholder="The greeting they open with"
      />
      <div className="dh-switchstack">
        <Switch
          label="Open with an illuminated capital"
          checked={greetingDropcap}
          onChange={(e) => setGreetingDropcap(e.target.checked)}
        />
      </div>

      <label className="dh-field-lab">Draft from a sketch</label>
      <p className="dh-field-hint">A line or two, and the model will imagine the rest into the fields above.</p>
      <div className="dh-tagrow" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: "12rem" }}>
          <Input
            value={sketch}
            onChange={(e) => setSketch(e.target.value)}
            placeholder="A weary lighthouse keeper who hums old songs…"
            disabled={imagining}
          />
        </div>
        <Button
          variant="secondary"
          leftIcon={<Icons.Sparkle />}
          onClick={() => void imagine()}
          disabled={imagining || !sketch.trim()}
        >
          Imagine them
        </Button>
      </div>
      {imagining ? <p className="dh-field-hint">Thinking them into being…</p> : null}

      <div className="dh-budget">
        <span>Soul ≈ {approxTokens} tokens</span>
        <span className="dh-budget__bar">
          <span
            className={["dh-budget__fill", fillPct >= 100 ? "dh-budget__fill--over" : ""].filter(Boolean).join(" ")}
            style={{ width: `${fillPct}%` }}
          />
        </span>
      </div>

      <div className="dh-studio__foot">
        <Button variant="heart" onClick={() => void keep()}>
          Keep
        </Button>
        {kept ? <span className="dh-studio__saved">Kept.</span> : null}
      </div>
    </div>
  );
}
