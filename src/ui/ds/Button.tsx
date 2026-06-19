import React from "react";
import { inject } from "./_inject";

inject(
  "dh-button",
  `
  .dh-btn{
    --_bg: var(--accent); --_fg: var(--text-on-ember); --_bd: transparent; --_glow: none;
    display:inline-flex; align-items:center; justify-content:center; gap:.55em;
    font-family:var(--font-sans); font-weight:var(--weight-semibold);
    letter-spacing:.01em; line-height:1; white-space:nowrap; cursor:pointer;
    border:1px solid var(--_bd); background:var(--_bg); color:var(--_fg);
    border-radius:var(--radius-md); box-shadow:var(--_glow);
    transition:var(--transition-control); -webkit-font-smoothing:antialiased;
    user-select:none;
  }
  .dh-btn:focus-visible{ outline:none; box-shadow:var(--ring-focus); }
  .dh-btn:active{ transform:translateY(1px) scale(.99); }
  .dh-btn[disabled]{ cursor:not-allowed; opacity:.42; box-shadow:none; transform:none; }

  .dh-btn--sm{ font-size:var(--text-sm); padding:.5rem .85rem; }
  .dh-btn--md{ font-size:var(--text-md); padding:.7rem 1.25rem; }
  .dh-btn--lg{ font-size:var(--text-lg); padding:.9rem 1.7rem; border-radius:var(--radius-lg); }
  .dh-btn--block{ display:flex; width:100%; }
  .dh-btn--pill{ border-radius:var(--radius-full); }

  .dh-btn--primary{ --_bg:var(--accent); --_fg:var(--text-on-ember); --_glow:var(--glow-ember-sm); }
  .dh-btn--primary:hover:not([disabled]){ --_bg:var(--accent-hover); box-shadow:var(--glow-ember); }
  .dh-btn--primary:active:not([disabled]){ --_bg:var(--accent-press); }

  .dh-btn--heart{ --_bg:var(--heart); --_fg:var(--parch-50); --_glow:var(--glow-heart); }
  .dh-btn--heart:hover:not([disabled]){ --_bg:var(--garnet-400); }

  .dh-btn--secondary{ --_bg:transparent; --_fg:var(--text-primary); --_bd:var(--border-gilt); }
  .dh-btn--secondary:hover:not([disabled]){ --_bg:var(--accent-soft); --_bd:var(--accent-line); --_fg:var(--ember-200); }

  .dh-btn--ghost{ --_bg:transparent; --_fg:var(--text-secondary); --_bd:transparent; }
  .dh-btn--ghost:hover:not([disabled]){ --_bg:rgba(241,232,214,0.06); --_fg:var(--text-primary); }

  .dh-btn__icon{ display:inline-flex; align-items:center; }
  .dh-btn__icon svg{ width:1.15em; height:1.15em; display:block; }
`
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "primary" | "heart" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  pill?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  children?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  pill = false,
  leftIcon = null,
  rightIcon = null,
  disabled = false,
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  const cls = [
    "dh-btn",
    `dh-btn--${variant}`,
    `dh-btn--${size}`,
    block ? "dh-btn--block" : "",
    pill ? "dh-btn--pill" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {leftIcon ? <span className="dh-btn__icon">{leftIcon}</span> : null}
      {children}
      {rightIcon ? <span className="dh-btn__icon">{rightIcon}</span> : null}
    </button>
  );
}
