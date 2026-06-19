import React from "react";
import { inject } from "./_inject";

inject(
  "dh-tabs",
  `
  .dh-tabs{ display:flex; gap:var(--space-2); border-bottom:1px solid var(--border-subtle); }
  .dh-tabs__tab{
    position:relative; appearance:none; border:none; background:transparent; cursor:pointer;
    font-family:var(--font-sans); font-size:var(--text-sm); font-weight:var(--weight-semibold);
    letter-spacing:var(--tracking-wide); text-transform:uppercase;
    color:var(--text-muted); padding:.7rem .9rem; transition:var(--transition-control);
  }
  .dh-tabs__tab:hover{ color:var(--text-secondary); }
  .dh-tabs__tab--active{ color:var(--ember-200); }
  .dh-tabs__tab--active::after{
    content:""; position:absolute; left:.9rem; right:.9rem; bottom:-1px; height:2px;
    background:var(--accent); border-radius:var(--radius-full); box-shadow:var(--glow-ember-sm);
  }
  .dh-tabs__tab:focus-visible{ outline:none; box-shadow:var(--ring-focus); border-radius:var(--radius-sm); }
`
);

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

export interface TabsProps {
  tabs: (string | TabItem)[];
  value: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs = [], value, onChange, className = "" }: TabsProps) {
  return (
    <div className={["dh-tabs", className].filter(Boolean).join(" ")} role="tablist">
      {tabs.map((t) => {
        const id = typeof t === "string" ? t : t.id;
        const label = typeof t === "string" ? t : t.label;
        const active = id === value;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            className={["dh-tabs__tab", active ? "dh-tabs__tab--active" : ""].filter(Boolean).join(" ")}
            onClick={() => onChange && onChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
