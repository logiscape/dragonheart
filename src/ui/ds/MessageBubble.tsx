import React from "react";
import { inject } from "./_inject";

inject(
  "dh-message",
  `
  .dh-msg{ display:flex; gap:var(--space-4); max-width:var(--measure-reading); }
  .dh-msg__col{ flex:1; min-width:0; }
  .dh-msg__name{
    font-family:var(--font-sans); font-size:var(--text-2xs); font-weight:var(--weight-semibold);
    letter-spacing:var(--tracking-caps); text-transform:uppercase; color:var(--ember-300);
    margin:0 0 .3rem;
  }
  .dh-msg__time{ color:var(--text-faint); letter-spacing:var(--tracking-wide); margin-left:.6rem; }

  /* The character speaks: flowing serif prose, no bubble. */
  .dh-msg--character .dh-msg__text{
    font-family:var(--font-serif); font-size:var(--type-body-size);
    line-height:var(--leading-relaxed); color:var(--text-primary); margin:0;
  }
  .dh-msg--character .dh-msg__text + .dh-msg__text{ margin-top:.85em; }
  .dh-msg--dropcap .dh-msg__text:first-of-type::first-letter{
    font-family:var(--font-display); font-weight:var(--weight-medium);
    font-size:3.1em; line-height:.84; float:left; padding:.06em .12em 0 0; color:var(--ember-400);
  }

  /* The user speaks: a quiet right-aligned well. */
  .dh-msg--user{ margin-left:auto; flex-direction:row-reverse; }
  .dh-msg--user .dh-msg__col{ display:flex; flex-direction:column; align-items:flex-end; }
  .dh-msg--user .dh-msg__bubble{
    background:var(--surface-card); border:1px solid var(--border-subtle);
    border-radius:var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg);
    padding:.7rem 1.05rem; color:var(--text-secondary);
    font-family:var(--font-serif); font-size:var(--text-md); line-height:var(--leading-normal);
    box-shadow:var(--shadow-sm);
  }
`
);

export interface MessageBubbleProps {
  from?: "character" | "user";
  name?: string | null;
  time?: string | null;
  avatar?: React.ReactNode;
  dropcap?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function MessageBubble({
  from = "character",
  name = null,
  time = null,
  avatar = null,
  dropcap = false,
  children,
  className = "",
}: MessageBubbleProps) {
  const isUser = from === "user";
  const cls = [
    "dh-msg",
    isUser ? "dh-msg--user" : "dh-msg--character",
    dropcap && !isUser ? "dh-msg--dropcap" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const paras = typeof children === "string" ? children.split(/\n{2,}/) : null;

  return (
    <div className={cls}>
      {avatar ? <div className="dh-msg__avatar">{avatar}</div> : null}
      <div className="dh-msg__col">
        {!isUser && (name || time) ? (
          <p className="dh-msg__name">
            {name}
            {time ? <span className="dh-msg__time">{time}</span> : null}
          </p>
        ) : null}
        {isUser ? (
          <div className="dh-msg__bubble">{children}</div>
        ) : paras ? (
          paras.map((p, i) => (
            <p key={i} className="dh-msg__text">
              {p}
            </p>
          ))
        ) : (
          <div className="dh-msg__text">{children}</div>
        )}
      </div>
    </div>
  );
}
