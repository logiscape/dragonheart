import React from "react";
import { inject } from "./_inject";

inject(
  "dh-iconbutton",
  `
  .dh-iconbtn{
    --_bg:transparent; --_fg:var(--text-secondary); --_bd:transparent;
    display:inline-flex; align-items:center; justify-content:center;
    border:1px solid var(--_bd); background:var(--_bg); color:var(--_fg);
    border-radius:var(--radius-md); cursor:pointer;
    transition:var(--transition-control); -webkit-font-smoothing:antialiased;
  }
  .dh-iconbtn svg{ width:1.25em; height:1.25em; display:block; }
  .dh-iconbtn:focus-visible{ outline:none; box-shadow:var(--ring-focus); }
  .dh-iconbtn:active:not([disabled]){ transform:scale(.92); }
  .dh-iconbtn[disabled]{ opacity:.4; cursor:not-allowed; }

  .dh-iconbtn--sm{ width:2rem; height:2rem; font-size:.95rem; }
  .dh-iconbtn--md{ width:2.5rem; height:2.5rem; font-size:1.1rem; }
  .dh-iconbtn--lg{ width:3rem; height:3rem; font-size:1.3rem; }
  .dh-iconbtn--round{ border-radius:var(--radius-full); }

  .dh-iconbtn--ghost:hover:not([disabled]){ --_bg:rgba(241,232,214,0.06); --_fg:var(--text-primary); }
  .dh-iconbtn--solid{ --_bg:var(--surface-card); --_fg:var(--text-primary); --_bd:var(--border-soft); }
  .dh-iconbtn--solid:hover:not([disabled]){ --_bg:var(--surface-overlay); --_bd:var(--border-gilt); }
  .dh-iconbtn--ember{ --_bg:var(--accent); --_fg:var(--text-on-ember); box-shadow:var(--glow-ember-sm); }
  .dh-iconbtn--ember:hover:not([disabled]){ --_bg:var(--accent-hover); box-shadow:var(--glow-ember); }
`
);

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  label: string;
  variant?: "ghost" | "solid" | "ember";
  size?: "sm" | "md" | "lg";
  round?: boolean;
  children?: React.ReactNode;
}

export function IconButton({
  children,
  label,
  variant = "ghost",
  size = "md",
  round = false,
  disabled = false,
  className = "",
  ...rest
}: IconButtonProps) {
  const cls = [
    "dh-iconbtn",
    `dh-iconbtn--${variant}`,
    `dh-iconbtn--${size}`,
    round ? "dh-iconbtn--round" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} aria-label={label} title={label} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}
