/**
 * Pure layout for the iter focus view.
 *
 * Holds an `@container/focus` parent and a CSS Grid that reflows by
 * the FOCUS PANE'S OWN width (not viewport / not Sheet). Three slots:
 * sidebar / main / rail. Three reflow modes:
 *
 *   - wide  (≥ 100ch): three columns side-by-side.
 *   - mid   (60–100ch): two columns (sidebar | main) with the rail
 *                       folded as a horizontal strip on top of main.
 *   - narrow (< 60ch): single stacked column rail → sidebar → main.
 *
 * Decisions:
 *   - Container queries instead of viewport breakpoints so the view
 *     can be embedded in narrower parents later (admin tile, dashboard
 *     pane) without depending on host Sheet width.
 *   - `grid-template-areas` via Tailwind v4 arbitrary value (underscores
 *     become spaces in the compiled CSS) — keeps the placement
 *     declarative and lets the same DOM nodes reflow without duplicate
 *     rendering.
 *   - All units in `ch`, `fr`, `rem`. Zero `px` for layout.
 *
 * v0.5.0 — Block A.
 */

import type { ReactElement, ReactNode } from "react";

export interface IterFocusShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  rail: ReactNode;
}

export function IterFocusShell({ sidebar, main, rail }: IterFocusShellProps): ReactElement {
  return (
    <div className="@container/focus min-h-0 flex-1">
      <div
        className={[
          "h-full grid gap-3",
          // Narrow: single column, stacked rail → sidebar → main.
          "grid-cols-1",
          "[grid-template-areas:'rail'_'sidebar'_'main']",
          // Mid: two columns (sidebar | main); rail spans top.
          "@[60ch]/focus:grid-cols-[minmax(0,0.5fr)_minmax(0,3.2fr)]",
          "@[60ch]/focus:[grid-template-areas:'rail_rail'_'sidebar_main']",
          // Wide: three columns. v0.5.2 tuning — rail had density
          // mismatch (22% wide but ~2 elements inside), competing
          // with the spec hero. Reduced to a slim 16% metadata
          // strip; the saved 6% goes to the main column.
          // Approximate share on a 1400px focus pane: 11% / 73% / 16%.
          "@[100ch]/focus:grid-cols-[minmax(0,0.5fr)_minmax(0,3.2fr)_minmax(0,0.7fr)]",
          "@[100ch]/focus:grid-rows-1",
          "@[100ch]/focus:[grid-template-areas:'sidebar_main_rail']",
        ].join(" ")}
      >
        <div className="[grid-area:sidebar] min-w-0 min-h-0 flex flex-col overflow-hidden">
          {sidebar}
        </div>
        <div className="[grid-area:main] min-w-0 min-h-0 flex flex-col overflow-hidden">{main}</div>
        <div className="[grid-area:rail] min-w-0 min-h-0 flex flex-col overflow-hidden">{rail}</div>
      </div>
    </div>
  );
}
