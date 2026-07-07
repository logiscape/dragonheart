import React from "react";
import { Card, Avatar, Tag, Badge, Ornament, Button, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Character } from "@engine/index";

function statusLabel(status: Character["status"]): string {
  return status === "present" ? "Here now" : status === "away" ? "Stepped away" : "Resting";
}

export function Hall() {
  const store = useStore();
  const s = useAppState();
  const present = s.characters.filter((c) => c.status === "present");
  const name = s.user.displayName || "traveller";

  return (
    <main className="dh-hall">
      <header className="dh-hall__head">
        <p className="dh-eyebrow">The Hall</p>
        <h1 className="dh-hall__title">Good evening, {name}.</h1>
        <p className="dh-hall__sub">
          {s.characters.length === 0
            ? "The hall is quiet. Begin a bond, and someone will be here when you return."
            : `${present.length} of your circle ${present.length === 1 ? "is" : "are"} by the fire tonight. Who will you sit with?`}
        </p>
        <div className="dh-hall__actions">
          <Button variant="secondary" leftIcon={<Icons.Plus />} onClick={() => store.gotoCreate()}>
            Begin a new bond
          </Button>
        </div>
      </header>

      <Ornament label="Your circle" />

      <div className="dh-hall__grid">
        {s.characters.length === 0 ? (
          <p className="dh-hall__empty">No one has crossed your threshold yet.</p>
        ) : (
          s.characters.map((c) => (
            <Card
              key={c.id}
              variant="raised"
              interactive
              glow={c.status === "present"}
              gilt
              className="dh-charcard"
              onClick={() => void store.openCharacter(c.id)}
            >
              <div className="dh-charcard__row">
                <Avatar
                  src={c.avatarPath}
                  name={c.name}
                  size="xl"
                  mood={c.mood}
                  ring
                  breathing={c.status === "present"}
                  status={c.status}
                />
                <div className="dh-charcard__id">
                  <h2 className="dh-charcard__name">{c.name}</h2>
                  <p className="dh-charcard__epithet">{c.epithet}</p>
                  <Badge tone={c.status === "present" ? "moss" : "neutral"} dot>
                    {statusLabel(c.status)}
                  </Badge>
                </div>
              </div>
              {c.blurb ? <p className="dh-charcard__blurb">{c.blurb}</p> : null}
              {c.traits.length ? (
                <div className="dh-charcard__tags">
                  {c.traits.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
