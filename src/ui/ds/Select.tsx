import React from "react";
import { inject } from "./_inject";

inject(
  "dh-select",
  `
  .dh-select-field{ display:flex; flex-direction:column; gap:.4rem; font-family:var(--font-sans); }
  .dh-select-field__label{
    font-size:var(--text-2xs); font-weight:var(--weight-semibold);
    letter-spacing:var(--tracking-caps); text-transform:uppercase; color:var(--text-muted);
  }
  .dh-select{ position:relative; display:flex; align-items:center; }
  .dh-select select{
    appearance:none; -webkit-appearance:none; width:100%;
    background:var(--surface-inset); border:1px solid var(--border-soft);
    border-radius:var(--radius-md); box-shadow:var(--shadow-inset);
    color:var(--text-primary); font-family:var(--font-sans); font-size:var(--text-md);
    padding:.7rem 2.4rem .7rem 1rem; outline:none; cursor:pointer;
    transition:var(--transition-control);
  }
  .dh-select select:focus{ border-color:var(--accent); box-shadow:var(--shadow-inset), var(--glow-ember-sm); }
  .dh-select select:disabled{ color:var(--text-faint); cursor:not-allowed; }
  .dh-select__chev{
    position:absolute; right:.95rem; pointer-events:none; color:var(--text-muted);
    width:1rem; height:1rem;
  }
  .dh-select option{ background:var(--surface-overlay); color:var(--text-primary); }
`
);

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string | null;
  options?: (string | SelectOption)[];
  children?: React.ReactNode;
}

export function Select({ label = null, options = [], children, id, className = "", ...rest }: SelectProps) {
  const fieldId = id || (label ? `dh-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const control = (
    <div className="dh-select">
      <select id={fieldId} className={className} {...rest}>
        {options.length
          ? options.map((o) =>
              typeof o === "string" ? (
                <option key={o} value={o}>
                  {o}
                </option>
              ) : (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )
            )
          : children}
      </select>
      <svg className="dh-select__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
  if (!label) return control;
  return (
    <div className="dh-select-field">
      <label className="dh-select-field__label" htmlFor={fieldId}>
        {label}
      </label>
      {control}
    </div>
  );
}
