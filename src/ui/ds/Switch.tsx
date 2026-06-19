import React from "react";
import { inject } from "./_inject";

inject(
  "dh-switch",
  `
  .dh-switch{
    display:inline-flex; align-items:center; gap:.7rem; cursor:pointer;
    font-family:var(--font-sans); font-size:var(--text-md); color:var(--text-secondary);
    user-select:none;
  }
  .dh-switch input{ position:absolute; opacity:0; width:0; height:0; }
  .dh-switch__track{
    width:2.6rem; height:1.5rem; flex:none; border-radius:var(--radius-full);
    background:var(--surface-inset); border:1px solid var(--border-strong);
    box-shadow:var(--shadow-inset); transition:var(--transition-control); position:relative;
  }
  .dh-switch__thumb{
    position:absolute; top:50%; left:3px; transform:translateY(-50%);
    width:1.05rem; height:1.05rem; border-radius:var(--radius-full);
    background:var(--taupe-200); transition:var(--transition-control);
  }
  .dh-switch input:checked + .dh-switch__track{ background:var(--accent); border-color:var(--accent); box-shadow:var(--glow-ember-sm); }
  .dh-switch input:checked + .dh-switch__track .dh-switch__thumb{ left:calc(100% - 1.05rem - 3px); background:var(--ink-950); }
  .dh-switch input:focus-visible + .dh-switch__track{ box-shadow:var(--ring-focus); }
  .dh-switch input:disabled ~ *{ opacity:.45; }
`
);

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  disabled?: boolean;
}

export function Switch({ label = null, checked, defaultChecked, disabled = false, className = "", ...rest }: SwitchProps) {
  return (
    <label className={["dh-switch", className].filter(Boolean).join(" ")}>
      <input type="checkbox" role="switch" checked={checked} defaultChecked={defaultChecked} disabled={disabled} {...rest} />
      <span className="dh-switch__track">
        <span className="dh-switch__thumb" />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
