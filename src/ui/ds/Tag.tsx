import React from "react";
import { inject } from "./_inject";

inject(
  "dh-tag",
  `
  .dh-tag{
    display:inline-flex; align-items:center; gap:.45em;
    font-family:var(--font-sans); font-size:var(--text-sm); font-weight:var(--weight-medium);
    color:var(--text-secondary); background:rgba(241,232,214,0.05);
    border:1px solid var(--border-soft); border-radius:var(--radius-full);
    padding:.36em .8em; line-height:1; transition:var(--transition-control);
  }
  .dh-tag svg{ width:1em; height:1em; }
  .dh-tag--interactive{ cursor:pointer; }
  .dh-tag--interactive:hover{ border-color:var(--border-gilt); color:var(--ember-200); background:var(--accent-soft); }
  .dh-tag--selected{ border-color:var(--accent-line); color:var(--ember-200); background:var(--accent-soft); }
  .dh-tag__remove{
    display:inline-flex; align-items:center; justify-content:center;
    margin-right:-.25em; width:1.15em; height:1.15em; border-radius:var(--radius-full);
    border:none; background:transparent; color:inherit; cursor:pointer; opacity:.65;
    font-size:1.05em; line-height:1; transition:var(--transition-control);
  }
  .dh-tag__remove:hover{ opacity:1; background:rgba(241,232,214,0.12); }
`
);

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: React.ReactNode;
  selected?: boolean;
  interactive?: boolean;
  onRemove?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
}

export function Tag({
  children,
  icon = null,
  selected = false,
  interactive = false,
  onRemove = undefined,
  className = "",
  ...rest
}: TagProps) {
  const cls = [
    "dh-tag",
    interactive || onRemove ? "dh-tag--interactive" : "",
    selected ? "dh-tag--selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} {...rest}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
      {onRemove ? (
        <button type="button" className="dh-tag__remove" aria-label="Remove" onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  );
}
