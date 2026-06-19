/**
 * Inject a component's scoped CSS exactly once. The design system ships each
 * component's styles co-located with the component (no CSS-in-JS lib, no build
 * step) — calling `inject(id, css)` at module load registers a <style> the
 * first time the component is used and is a no-op thereafter.
 */
export function inject(id: string, css: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
