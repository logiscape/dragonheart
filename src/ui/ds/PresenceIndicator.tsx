import React from "react";
import { inject } from "./_inject";

inject(
  "dh-presence",
  `
  .dh-presence{
    display:inline-flex; align-items:center; gap:.6rem;
    font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-muted);
  }
  .dh-presence__orb{
    width:.7rem; height:.7rem; border-radius:var(--radius-full); flex:none;
    background:var(--_mood, var(--accent)); position:relative;
  }
  .dh-presence--present .dh-presence__orb{ box-shadow:0 0 10px -1px var(--_mood, var(--accent)); }
  .dh-presence--present .dh-presence__orb::after{
    content:""; position:absolute; inset:-4px; border-radius:var(--radius-full);
    border:1px solid var(--_mood, var(--accent)); animation:dh-breathe var(--dur-breath) var(--ease-soft) infinite;
  }
  .dh-presence--dormant .dh-presence__orb{ background:var(--taupe-400); }
  .dh-presence--away .dh-presence__orb{ background:var(--ember-400); }
  .dh-presence__label{ color:var(--text-secondary); }
  .dh-presence__label em{ font-style:italic; color:var(--text-muted); }

  .dh-presence__dots{ display:inline-flex; gap:.22rem; align-items:center; }
  .dh-presence__dots span{
    width:.34rem; height:.34rem; border-radius:var(--radius-full);
    background:var(--_mood, var(--accent)); animation:dh-flicker 1.4s var(--ease-soft) infinite;
  }
  .dh-presence__dots span:nth-child(2){ animation-delay:.2s; }
  .dh-presence__dots span:nth-child(3){ animation-delay:.4s; }
  @media (prefers-reduced-motion: reduce){
    .dh-presence__orb::after, .dh-presence__dots span{ animation:none; }
  }
`
);

const MOODS: Record<string, string> = { ember: "var(--accent)", heart: "var(--heart)", moss: "var(--moss-400)", arcane: "var(--arcane-400)" };

export interface PresenceIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  state?: "present" | "thinking" | "away" | "dormant";
  mood?: "ember" | "heart" | "moss" | "arcane" | string;
  className?: string;
}

export function PresenceIndicator({ name = "", state = "present", mood = "ember", className = "", style = {} }: PresenceIndicatorProps) {
  const vars = { "--_mood": MOODS[mood] || mood, ...style } as React.CSSProperties;
  const labels: Record<NonNullable<PresenceIndicatorProps["state"]>, React.ReactNode> = {
    present: (
      <span className="dh-presence__label">
        {name ? <strong>{name}</strong> : "They"} {name ? "is here" : "are here"}
      </span>
    ),
    thinking: (
      <span className="dh-presence__label">
        <em>{name ? `${name} is gathering their thoughts` : "gathering thoughts"}</em>
      </span>
    ),
    away: <span className="dh-presence__label">{name ? `${name} stepped away` : "away"}</span>,
    dormant: <span className="dh-presence__label">{name ? `${name} is resting` : "resting"}</span>,
  };
  return (
    <span className={["dh-presence", `dh-presence--${state}`, className].filter(Boolean).join(" ")} style={vars}>
      {state === "thinking" ? (
        <span className="dh-presence__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <span className="dh-presence__orb" aria-hidden="true" />
      )}
      {labels[state]}
    </span>
  );
}
