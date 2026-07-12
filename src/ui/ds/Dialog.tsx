import React from "react";
import { createPortal } from "react-dom";
import { inject } from "./_inject";

inject(
  "dh-dialog",
  `
  .dh-dialog__scrim{
    position:fixed; inset:0; background:var(--surface-scrim);
    backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
    display:flex; align-items:center; justify-content:center; padding:var(--space-6);
    z-index:1000; animation:dh-rise var(--dur-base) var(--ease-gentle);
  }
  .dh-dialog{
    position:relative; width:100%; max-width:min(520px, 92vw);
    background:var(--surface-overlay); color:var(--text-primary);
    border:1px solid var(--border-soft); border-radius:var(--radius-xl);
    box-shadow:var(--shadow-xl), var(--glow-soft); overflow:hidden;
  }
  .dh-dialog::before{
    content:""; position:absolute; inset:0 0 auto 0; height:3px;
    background:linear-gradient(90deg, transparent, var(--accent), transparent); opacity:.7;
  }
  .dh-dialog__body{ padding:var(--space-7) var(--space-7) var(--space-6); }
  .dh-dialog__title{
    font-family:var(--font-display); font-weight:var(--weight-medium);
    font-size:var(--text-2xl); line-height:var(--leading-snug); margin:0 0 .4rem;
    color:var(--text-primary);
  }
  .dh-dialog__desc{
    font-family:var(--font-serif); font-size:var(--text-lg);
    line-height:var(--leading-relaxed); color:var(--text-secondary); margin:0;
  }
  .dh-dialog__footer{
    display:flex; justify-content:flex-end; gap:var(--space-3);
    padding:var(--space-5) var(--space-7); border-top:1px solid var(--border-subtle);
    background:rgba(0,0,0,0.15);
  }
  .dh-dialog__close{
    position:absolute; top:var(--space-4); right:var(--space-4);
    width:2rem; height:2rem; border-radius:var(--radius-full);
    border:none; background:transparent; color:var(--text-muted); cursor:pointer;
    font-size:1.4rem; line-height:1; transition:var(--transition-control);
  }
  .dh-dialog__close:hover{ background:rgba(241,232,214,0.08); color:var(--text-primary); }
`
);

export interface DialogProps {
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function Dialog({ open = false, title = null, description = null, onClose, children, footer = null }: DialogProps) {
  if (!open) return null;
  // Portal to <body>: ancestors create stacking contexts (.dh-app > * sets
  // z-index:1), which would trap the fixed scrim behind later siblings.
  return createPortal(
    <div className="dh-dialog__scrim" onClick={onClose}>
      <div className="dh-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {onClose ? (
          <button className="dh-dialog__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        ) : null}
        <div className="dh-dialog__body">
          {title ? <h2 className="dh-dialog__title">{title}</h2> : null}
          {description ? <p className="dh-dialog__desc">{description}</p> : null}
          {children}
        </div>
        {footer ? <div className="dh-dialog__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
