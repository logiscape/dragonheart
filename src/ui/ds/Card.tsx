import React from "react";
import { inject } from "./_inject";

inject(
  "dh-card",
  `
  .dh-card{
    background:var(--surface-card); color:var(--text-primary);
    border:1px solid var(--border-subtle); border-radius:var(--radius-lg);
    box-shadow:var(--shadow-md); transition:var(--transition-control);
    overflow:hidden; position:relative;
  }
  .dh-card--pad{ padding:var(--pad-card); }
  .dh-card--raised{ background:var(--surface-raised); box-shadow:var(--shadow-lg); }
  .dh-card--parchment{
    background:var(--surface-parchment); color:var(--text-on-parch);
    border-color:rgba(120,90,40,0.18);
  }
  .dh-card--interactive{ cursor:pointer; }
  .dh-card--interactive:hover{
    border-color:var(--border-gilt); box-shadow:var(--shadow-lg), var(--glow-soft);
    transform:translateY(-2px);
  }
  .dh-card--glow{ box-shadow:var(--shadow-md), var(--glow-ember-sm); border-color:var(--accent-line); }
  .dh-card__gilt{
    position:absolute; inset:0; border-radius:inherit; pointer-events:none;
    border:1px solid var(--border-gilt); opacity:.5;
    -webkit-mask:linear-gradient(#000,transparent 60%);
            mask:linear-gradient(#000,transparent 60%);
  }
`
);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "parchment";
  padded?: boolean;
  interactive?: boolean;
  glow?: boolean;
  gilt?: boolean;
  children?: React.ReactNode;
}

export function Card({
  children,
  variant = "default",
  padded = true,
  interactive = false,
  glow = false,
  gilt = false,
  className = "",
  ...rest
}: CardProps) {
  const cls = [
    "dh-card",
    variant !== "default" ? `dh-card--${variant}` : "",
    padded ? "dh-card--pad" : "",
    interactive ? "dh-card--interactive" : "",
    glow ? "dh-card--glow" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {gilt ? <span className="dh-card__gilt" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}
