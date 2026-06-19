import React from "react";
import { inject } from "./_inject";

inject(
  "dh-checkbox",
  `
  .dh-checkbox{
    display:inline-flex; align-items:center; gap:.65rem; cursor:pointer;
    font-family:var(--font-sans); font-size:var(--text-md); color:var(--text-secondary);
    user-select:none;
  }
  .dh-checkbox input{ position:absolute; opacity:0; width:0; height:0; }
  .dh-checkbox__box{
    width:1.25rem; height:1.25rem; flex:none; border-radius:var(--radius-xs);
    border:1px solid var(--border-strong); background:var(--surface-inset);
    display:inline-flex; align-items:center; justify-content:center;
    transition:var(--transition-control); box-shadow:var(--shadow-inset);
    color:var(--text-on-ember);
  }
  .dh-checkbox__box svg{ width:.85rem; height:.85rem; opacity:0; transform:scale(.6); transition:var(--transition-control); }
  .dh-checkbox:hover .dh-checkbox__box{ border-color:var(--border-gilt); }
  .dh-checkbox input:checked + .dh-checkbox__box{ background:var(--accent); border-color:var(--accent); box-shadow:var(--glow-ember-sm); }
  .dh-checkbox input:checked + .dh-checkbox__box svg{ opacity:1; transform:scale(1); }
  .dh-checkbox input:focus-visible + .dh-checkbox__box{ box-shadow:var(--ring-focus); }
  .dh-checkbox input:disabled ~ *{ opacity:.45; }
  .dh-checkbox--disabled{ cursor:not-allowed; }
`
);

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  disabled?: boolean;
}

export function Checkbox({ label = null, checked, defaultChecked, disabled = false, className = "", ...rest }: CheckboxProps) {
  return (
    <label className={["dh-checkbox", disabled ? "dh-checkbox--disabled" : "", className].filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        {...rest}
      />
      <span className="dh-checkbox__box">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
