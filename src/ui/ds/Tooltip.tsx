import React from "react";
import { inject } from "./_inject";

inject(
  "dh-tooltip",
  `
  .dh-tooltip{ position:relative; display:inline-flex; }
  .dh-tooltip__bubble{
    position:absolute; z-index:50; left:50%; transform:translateX(-50%) translateY(4px);
    bottom:calc(100% + 8px); white-space:nowrap; pointer-events:none;
    background:var(--surface-overlay); color:var(--text-primary);
    border:1px solid var(--border-soft); border-radius:var(--radius-sm);
    padding:.35rem .6rem; font-family:var(--font-sans); font-size:var(--text-xs);
    box-shadow:var(--shadow-md); opacity:0; transition:opacity var(--dur-quick) var(--ease-soft), transform var(--dur-quick) var(--ease-gentle);
  }
  .dh-tooltip__bubble::after{
    content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
    border:5px solid transparent; border-top-color:var(--surface-overlay);
  }
  .dh-tooltip:hover .dh-tooltip__bubble, .dh-tooltip:focus-within .dh-tooltip__bubble{
    opacity:1; transform:translateX(-50%) translateY(0);
  }
  .dh-tooltip--bottom .dh-tooltip__bubble{ bottom:auto; top:calc(100% + 8px); transform:translateX(-50%) translateY(-4px); }
  .dh-tooltip--bottom .dh-tooltip__bubble::after{ top:auto; bottom:100%; border-top-color:transparent; border-bottom-color:var(--surface-overlay); }
  .dh-tooltip--bottom:hover .dh-tooltip__bubble{ transform:translateX(-50%) translateY(0); }
`
);

export interface TooltipProps {
  label: React.ReactNode;
  placement?: "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ label, placement = "top", children, className = "" }: TooltipProps) {
  return (
    <span className={["dh-tooltip", `dh-tooltip--${placement}`, className].filter(Boolean).join(" ")}>
      {children}
      <span className="dh-tooltip__bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}
