import React from "react";
import { inject } from "./_inject";

inject(
  "dh-ornament",
  `
  .dh-ornament{
    display:flex; align-items:center; gap:var(--space-4);
    color:var(--accent); width:100%;
  }
  .dh-ornament__rule{
    flex:1; height:1px; border:none;
    background:linear-gradient(90deg, transparent, var(--border-gilt));
  }
  .dh-ornament__rule--right{ background:linear-gradient(90deg, var(--border-gilt), transparent); }
  .dh-ornament__mark{ display:flex; align-items:center; gap:.5em; }
  .dh-ornament__mark svg{ width:1.6em; height:1.9em; }
  .dh-ornament__label{
    font-family:var(--font-sans); font-weight:var(--weight-semibold);
    font-size:var(--text-2xs); letter-spacing:var(--tracking-caps);
    text-transform:uppercase; color:var(--text-muted); white-space:nowrap;
  }
  .dh-ornament__diamond{ width:5px; height:5px; background:var(--accent); transform:rotate(45deg); opacity:.8; }
`
);

const Fleuron = () => (
  <svg viewBox="0 0 40 48" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round">
      <path d="M20 8 C20 16, 20 18, 20 24" />
      <path d="M20 24 C12 20, 8 14, 12 9 C16 5, 20 12, 20 18" />
      <path d="M20 24 C28 20, 32 14, 28 9 C24 5, 20 12, 20 18" />
    </g>
    <circle cx="20" cy="30" r="2.2" fill="currentColor" />
  </svg>
);

export interface OrnamentProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string | null;
  mark?: "fleuron" | "diamond";
}

export function Ornament({ label = null, mark = "fleuron", className = "", ...rest }: OrnamentProps) {
  return (
    <div className={["dh-ornament", className].filter(Boolean).join(" ")} role="separator" {...rest}>
      <hr className="dh-ornament__rule" />
      <span className="dh-ornament__mark">
        {mark === "fleuron" ? <Fleuron /> : <span className="dh-ornament__diamond" />}
        {label ? <span className="dh-ornament__label">{label}</span> : null}
      </span>
      <hr className="dh-ornament__rule dh-ornament__rule--right" />
    </div>
  );
}
