import React from "react";
import { inject } from "./_inject";

inject(
  "dh-toast",
  `
  .dh-toast{
    display:flex; align-items:flex-start; gap:.85rem;
    min-width:280px; max-width:420px;
    background:var(--surface-overlay); border:1px solid var(--border-soft);
    border-left:3px solid var(--_accent, var(--accent));
    border-radius:var(--radius-md); box-shadow:var(--shadow-lg);
    padding:var(--space-4) var(--space-5);
    font-family:var(--font-sans); animation:dh-rise var(--dur-base) var(--ease-gentle);
  }
  .dh-toast--ember{ --_accent:var(--accent); }
  .dh-toast--heart{ --_accent:var(--heart); }
  .dh-toast--moss{ --_accent:var(--moss-400); }
  .dh-toast--arcane{ --_accent:var(--arcane-400); }
  .dh-toast__icon{ color:var(--_accent, var(--accent)); display:inline-flex; margin-top:.1rem; }
  .dh-toast__icon svg{ width:1.25rem; height:1.25rem; }
  .dh-toast__body{ flex:1; min-width:0; }
  .dh-toast__title{ font-size:var(--text-md); font-weight:var(--weight-semibold); color:var(--text-primary); margin:0 0 .15rem; }
  .dh-toast__msg{ font-size:var(--text-sm); color:var(--text-secondary); margin:0; line-height:var(--leading-snug); }
  .dh-toast__close{
    border:none; background:transparent; color:var(--text-faint); cursor:pointer;
    font-size:1.1rem; line-height:1; padding:.1rem; transition:var(--transition-control);
  }
  .dh-toast__close:hover{ color:var(--text-primary); }
`
);

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: "ember" | "heart" | "moss" | "arcane";
  title?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
}

export function Toast({ tone = "ember", title = null, icon = null, onClose, children, className = "", ...rest }: ToastProps) {
  return (
    <div className={["dh-toast", `dh-toast--${tone}`, className].filter(Boolean).join(" ")} role="status" {...rest}>
      {icon ? <span className="dh-toast__icon">{icon}</span> : null}
      <div className="dh-toast__body">
        {title ? <p className="dh-toast__title">{title}</p> : null}
        {children ? <p className="dh-toast__msg">{children}</p> : null}
      </div>
      {onClose ? (
        <button className="dh-toast__close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      ) : null}
    </div>
  );
}
