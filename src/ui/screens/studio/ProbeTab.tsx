import React, { useState } from "react";
import { Button } from "@ui/ds";
import { useStore } from "@state/store";
import type { ProbeResult } from "@engine/index";

export function ProbeTab() {
  const store = useStore();
  const character = store.currentCharacter();

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  if (!character) {
    return (
      <div className="dh-studio__pane">
        <p className="dh-studio__note">No one is here to answer yet. Step into a conversation first.</p>
      </div>
    );
  }

  const name = character.name;

  async function run() {
    if (!character) return;
    setRunning(true);
    setResults([]);
    setDone(0);
    setTotal(0);
    try {
      await store.engine.runProbes(character, (r, i, t) => {
        setResults((prev) => [...prev, r]);
        setDone(i + 1);
        setTotal(t);
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="dh-studio__pane">
      <p className="dh-studio__note">
        Run the same questions you always do — see if a change made her more herself, or less.
      </p>

      <div className="dh-tagrow">
        <Button variant="primary" onClick={() => void run()} disabled={running}>
          Run the soul probes
        </Button>
      </div>

      <p className="dh-field-hint">
        These run on {name}'s own model and may take a little while.
      </p>

      {running ? (
        <p className="dh-inline-note">
          Asking {name}…{total > 0 ? ` (${done}/${total})` : ""}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="dh-probe">
          {results.map((r) => (
            <div key={r.id} className="dh-probe__item">
              <p className="dh-probe__q">{`${r.reveals} — "${r.question}"`}</p>
              <p className="dh-probe__a">{r.answer}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
