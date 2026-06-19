import React from "react";
import { inject } from "./_inject";

inject(
  "dh-avatar",
  `
  .dh-avatar{
    --_size:3rem; --_mood:var(--accent);
    position:relative; display:inline-flex; align-items:center; justify-content:center;
    width:var(--_size); height:var(--_size); flex:none;
  }
  .dh-avatar__face{
    position:relative; width:100%; height:100%; border-radius:var(--radius-full);
    overflow:hidden; display:flex; align-items:center; justify-content:center;
    background:
      radial-gradient(120% 120% at 30% 20%, rgba(243,194,119,0.22), transparent 60%),
      linear-gradient(155deg, var(--ink-600), var(--ink-850));
    border:1px solid var(--border-soft);
    color:var(--parch-100); font-family:var(--font-display);
    font-weight:var(--weight-medium); line-height:1;
    box-shadow:var(--shadow-sm);
  }
  .dh-avatar__face img{ width:100%; height:100%; object-fit:cover; display:block; }
  .dh-avatar__mono{ font-size:calc(var(--_size) * 0.42); padding-top:.04em; letter-spacing:.01em; }

  /* presence ring */
  .dh-avatar--ring .dh-avatar__face{ border-color:color-mix(in srgb, var(--_mood) 70%, transparent); }
  .dh-avatar--ring::after{
    content:""; position:absolute; inset:-3px; border-radius:var(--radius-full);
    border:1.5px solid var(--_mood); opacity:.55; pointer-events:none;
  }
  .dh-avatar--breathing::after{ animation:dh-breathe var(--dur-breath) var(--ease-soft) infinite; box-shadow:0 0 18px -4px var(--_mood); }
  @media (prefers-reduced-motion: reduce){ .dh-avatar--breathing::after{ animation:none; } }

  /* status pip */
  .dh-avatar__pip{
    position:absolute; right:2%; bottom:2%; width:30%; height:30%;
    min-width:9px; min-height:9px; border-radius:var(--radius-full);
    border:2px solid var(--surface-base); background:var(--taupe-400);
  }
  .dh-avatar__pip--present{ background:var(--moss-400); box-shadow:0 0 8px -1px var(--moss-400); }
  .dh-avatar__pip--away{ background:var(--ember-400); }
  .dh-avatar__pip--dormant{ background:var(--taupe-400); }
`
);

const SIZES: Record<string, string> = { xs: "1.75rem", sm: "2.25rem", md: "3rem", lg: "4rem", xl: "5.5rem", "2xl": "8rem" };
const MOODS: Record<string, string> = {
  ember: "var(--accent)",
  heart: "var(--heart)",
  moss: "var(--moss-400)",
  arcane: "var(--arcane-400)",
};

function initials(name: string): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | string;
  mood?: "ember" | "heart" | "moss" | "arcane" | string;
  ring?: boolean;
  breathing?: boolean;
  status?: "none" | "present" | "away" | "dormant";
}

export function Avatar({
  src = null,
  name = "",
  size = "md",
  mood = "ember",
  ring = false,
  breathing = false,
  status = "none",
  className = "",
  style = {},
  ...rest
}: AvatarProps) {
  const cls = [
    "dh-avatar",
    ring || breathing ? "dh-avatar--ring" : "",
    breathing ? "dh-avatar--breathing" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const vars = { "--_size": SIZES[size] || size, "--_mood": MOODS[mood] || mood, ...style } as React.CSSProperties;
  return (
    <span className={cls} style={vars} {...rest}>
      <span className="dh-avatar__face">
        {src ? <img src={src} alt={name} /> : <span className="dh-avatar__mono">{initials(name)}</span>}
      </span>
      {status !== "none" ? <span className={`dh-avatar__pip dh-avatar__pip--${status}`} aria-hidden="true" /> : null}
    </span>
  );
}
