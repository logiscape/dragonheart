import React from "react";
import { inject } from "./_inject";

inject(
  "dh-badge",
  `
  .dh-badge{
    display:inline-flex; align-items:center; gap:.4em;
    font-family:var(--font-sans); font-weight:var(--weight-semibold);
    font-size:var(--text-2xs); letter-spacing:var(--tracking-wide);
    text-transform:uppercase; line-height:1;
    padding:.34em .68em; border-radius:var(--radius-full);
    border:1px solid transparent; white-space:nowrap;
  }
  .dh-badge__dot{ width:.5em; height:.5em; border-radius:var(--radius-full); background:currentColor; }

  .dh-badge--neutral{ background:rgba(241,232,214,0.07); color:var(--text-secondary); border-color:var(--border-soft); }
  .dh-badge--ember{ background:var(--accent-soft); color:var(--ember-200); border-color:var(--accent-line); }
  .dh-badge--heart{ background:var(--heart-soft); color:var(--garnet-300); border-color:rgba(186,70,50,0.32); }
  .dh-badge--moss{ background:var(--success-soft); color:var(--moss-300); border-color:rgba(135,160,109,0.32); }
  .dh-badge--arcane{ background:var(--info-soft); color:var(--arcane-300); border-color:rgba(120,145,168,0.32); }

  .dh-badge--solid.dh-badge--ember{ background:var(--accent); color:var(--text-on-ember); border-color:transparent; }
  .dh-badge--solid.dh-badge--heart{ background:var(--heart); color:var(--parch-50); border-color:transparent; }
  .dh-badge--solid.dh-badge--moss{ background:var(--moss-500); color:var(--parch-50); border-color:transparent; }
`
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "ember" | "heart" | "moss" | "arcane";
  solid?: boolean;
  dot?: boolean;
  children?: React.ReactNode;
}

export function Badge({
  children,
  tone = "neutral",
  solid = false,
  dot = false,
  className = "",
  ...rest
}: BadgeProps) {
  const cls = ["dh-badge", `dh-badge--${tone}`, solid ? "dh-badge--solid" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} {...rest}>
      {dot ? <span className="dh-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
