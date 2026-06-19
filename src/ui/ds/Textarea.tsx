import React from "react";
import { inject } from "./_inject";

inject(
  "dh-textarea",
  `
  .dh-textarea-field{ display:flex; flex-direction:column; gap:.4rem; font-family:var(--font-sans); }
  .dh-textarea-field__label{
    font-size:var(--text-2xs); font-weight:var(--weight-semibold);
    letter-spacing:var(--tracking-caps); text-transform:uppercase; color:var(--text-muted);
  }
  .dh-textarea{
    width:100%; resize:vertical; min-height:6rem;
    background:var(--surface-inset); border:1px solid var(--border-soft);
    border-radius:var(--radius-md); box-shadow:var(--shadow-inset);
    color:var(--text-primary); font-family:var(--font-serif);
    font-size:var(--type-body-size); line-height:var(--leading-relaxed);
    padding:.85rem 1rem; outline:none; transition:var(--transition-control);
  }
  .dh-textarea::placeholder{ color:var(--text-faint); }
  .dh-textarea:focus{ border-color:var(--accent); box-shadow:var(--shadow-inset), var(--glow-ember-sm); }
  .dh-textarea--seamless{
    background:transparent; border-color:transparent; box-shadow:none; padding:0;
    resize:none; min-height:2.5rem;
  }
  .dh-textarea--seamless:focus{ box-shadow:none; border-color:transparent; }
`
);

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string | null;
  seamless?: boolean;
  /** Grow with content up to `maxRows`, then cap height and scroll. */
  autoGrow?: boolean;
  /** Maximum visible rows before the field stops growing and scrolls (autoGrow only). */
  maxRows?: number;
}

export function Textarea({
  label = null,
  seamless = false,
  autoGrow = false,
  maxRows = 3,
  id,
  className = "",
  value,
  ...rest
}: TextareaProps) {
  const fieldId = id || (label ? `dh-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    if (!autoGrow) return;
    const el = ref.current;
    if (!el) return;
    // Measure natural content height, then cap at maxRows and toggle scrolling.
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 0;
    const vPad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const vBorder = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const maxHeight = lineHeight * maxRows + vPad + vBorder;
    const content = el.scrollHeight + vBorder; // scrollHeight omits border under border-box
    el.style.height = `${Math.min(content, maxHeight)}px`;
    el.style.overflowY = content > maxHeight ? "auto" : "hidden";
  }, [value, autoGrow, maxRows]);

  const ta = (
    <textarea
      ref={ref}
      id={fieldId}
      value={value}
      className={["dh-textarea", seamless ? "dh-textarea--seamless" : "", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
  if (!label) return ta;
  return (
    <div className="dh-textarea-field">
      <label className="dh-textarea-field__label" htmlFor={fieldId}>
        {label}
      </label>
      {ta}
    </div>
  );
}
