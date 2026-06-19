import React from "react";
import { inject } from "./_inject";

inject(
  "dh-field",
  `
  .dh-field{ display:flex; flex-direction:column; gap:.4rem; font-family:var(--font-sans); }
  .dh-field__label{
    font-size:var(--text-2xs); font-weight:var(--weight-semibold);
    letter-spacing:var(--tracking-caps); text-transform:uppercase; color:var(--text-muted);
  }
  .dh-field__wrap{
    display:flex; align-items:center; gap:.6rem;
    background:var(--surface-inset); border:1px solid var(--border-soft);
    border-radius:var(--radius-md); padding:0 .85rem;
    box-shadow:var(--shadow-inset); transition:var(--transition-control);
  }
  .dh-field__wrap:focus-within{ border-color:var(--accent); box-shadow:var(--shadow-inset), var(--glow-ember-sm); }
  .dh-field__wrap--error{ border-color:var(--danger); }
  .dh-field__icon{ display:inline-flex; color:var(--text-muted); }
  .dh-field__icon svg{ width:1.15em; height:1.15em; display:block; }
  .dh-field__input{
    flex:1; min-width:0; background:transparent; border:none; outline:none;
    color:var(--text-primary); font-family:var(--font-serif); font-size:var(--text-md);
    padding:.7rem 0;
  }
  .dh-field__input::placeholder{ color:var(--text-faint); }
  .dh-field__input:disabled{ color:var(--text-faint); cursor:not-allowed; }
  .dh-field__hint{ font-size:var(--text-xs); color:var(--text-faint); }
  .dh-field__hint--error{ color:var(--garnet-300); }
`
);

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string | null;
  hint?: string | null;
  error?: string | null;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label = null,
  hint = null,
  error = null,
  leftIcon = null,
  rightIcon = null,
  id,
  className = "",
  ...rest
}: InputProps) {
  const fieldId = id || (label ? `dh-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <div className={["dh-field", className].filter(Boolean).join(" ")}>
      {label ? (
        <label className="dh-field__label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className={["dh-field__wrap", error ? "dh-field__wrap--error" : ""].filter(Boolean).join(" ")}>
        {leftIcon ? <span className="dh-field__icon">{leftIcon}</span> : null}
        <input id={fieldId} className="dh-field__input" {...rest} />
        {rightIcon ? <span className="dh-field__icon">{rightIcon}</span> : null}
      </div>
      {error ? (
        <span className="dh-field__hint dh-field__hint--error">{error}</span>
      ) : hint ? (
        <span className="dh-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
