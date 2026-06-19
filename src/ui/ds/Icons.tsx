/* Lucide-style line icons (stroke 1.7) — the brand's working icon language:
   thin, calm, unobtrusive, so they recede the way the chrome is meant to.
   Ported to ESM/TSX from the reference kit and extended with the glyphs the
   real app needs (recall, image, mic, trash, edit, pin, import/export, wand). */
import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

const BASE: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: "1em",
  height: "1em",
};

/** Build a stroked icon from a list of path `d` strings. */
function stroke(paths: string[], extra: Partial<IconProps> = {}) {
  return function Icon(props: IconProps) {
    return React.createElement(
      "svg",
      { ...BASE, ...extra, ...props },
      paths.map((d, i) => React.createElement("path", { key: i, d })),
    );
  };
}

const circle = (cx: number, cy: number, r: number) =>
  React.createElement("circle", { key: `c${cx}-${cy}`, cx, cy, r });

export const Send = stroke(["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"]);
export const Plus = stroke(["M12 5v14", "M5 12h14"]);
export const Book = stroke([
  "M4 19.5A2.5 2.5 0 0 1 6.5 17H20",
  "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
]);
export const Quill = stroke(["M20 4 9 15", "M20 4c-3 9-8 13-15 15 0 0 1.5-6 5-9", "M9 15l-1 4 4-1"]);
export const Close = stroke(["M18 6 6 18", "M6 6l12 12"]);
export const Back = stroke(["M19 12H5", "M12 19l-7-7 7-7"]);
export const Bell = stroke([
  "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
  "M10.3 21a1.94 1.94 0 0 0 3.4 0",
]);
export const Moon = stroke(["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"]);
export const Flame = stroke([
  "M12 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.5C9.5 8 11 6 12 2z",
  "M12 22a6 6 0 0 0 6-6c0-3-2-5-3.5-7",
]);
export const Trash = stroke([
  "M3 6h18",
  "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
  "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  "M10 11v6", "M14 11v6",
]);
export const Edit = stroke([
  "M12 20h9",
  "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
]);
export const Pin = stroke([
  "M12 17v5",
  "M9 10.76V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5.76l1.5 2.24a1 1 0 0 1-.83 1.5H8.33a1 1 0 0 1-.83-1.5L9 10.76Z",
]);
export const Image = stroke([
  "M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
  "M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  "M21 15l-5-5L5 21",
]);
export const Mic = stroke([
  "M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z",
  "M19 10a7 7 0 0 1-14 0",
  "M12 17v5", "M8 22h8",
]);
export const Download = stroke(["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"]);
export const Upload = stroke(["M12 21V9", "M7 14l5-5 5 5", "M5 3h14"]);
export const Check = stroke(["M20 6 9 17l-5-5"]);
export const Heart = function Heart(props: IconProps) {
  return React.createElement(
    "svg",
    { ...BASE, fill: "currentColor", stroke: "none", ...props },
    React.createElement("path", {
      key: "h",
      d: "M12 21s-7-4.6-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.4 12 21 12 21Z",
    }),
  );
};
export const Sparkle = stroke([
  "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z",
  "M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z",
]);
export const Wand = stroke([
  "M15 4V2", "M15 10V8", "M11.5 6.5H9.5", "M20.5 6.5h-2",
  "M18 4l-1 1", "M13 7l-1 1",
  "M3 21l11-11", "M12.5 6.5l5 5",
]);
export const Search = function Search(props: IconProps) {
  return React.createElement("svg", { ...BASE, ...props }, circle(11, 11, 7),
    React.createElement("path", { key: "p", d: "m21 21-4.3-4.3" }));
};
export const Sun = function Sun(props: IconProps) {
  return React.createElement("svg", { ...BASE, ...props }, circle(12, 12, 4),
    React.createElement("path", {
      key: "p",
      d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    }));
};
export const Studio = function Studio(props: IconProps) {
  return React.createElement(
    "svg",
    { ...BASE, ...props },
    circle(12, 12, 3),
    React.createElement("path", {
      key: "p",
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    }),
  );
};

/** Convenience record so screens can do `const I = Icons; <I.Send/>`. */
export const Icons = {
  Send, Plus, Book, Quill, Close, Back, Bell, Moon, Sun, Flame, Heart,
  Trash, Edit, Pin, Image, Mic, Download, Upload, Check, Sparkle, Wand,
  Search, Studio,
};

export type IconComponent = (props: IconProps) => React.ReactElement;
