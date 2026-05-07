/**
 * Layout for the v0.7 Copilot focus view — two zones, full-bleed.
 *
 *   ┌────────────────────────────────────────┬─────────────────────┐
 *   │ SPEC (tabs)              ~65% width    │ COPILOT (chat) ~35% │
 *   └────────────────────────────────────────┴─────────────────────┘
 *
 * No bottom strip — the chat input lives inside the Copilot panel
 * itself. Container queries on `@container/focus` reflow to a
 * single column on narrow widths (tabs above chat).
 *
 * v0.7.0.
 */

import type { ReactElement, ReactNode } from "react";

export interface IterFocusShellProps {
  spec: ReactNode;
  chat: ReactNode;
}

export function IterFocusShell({ spec, chat }: IterFocusShellProps): ReactElement {
  return (
    <div className="@container/focus min-h-0 flex-1">
      <div
        className={[
          "h-full grid gap-0",
          // Narrow: stack spec above chat. The chat panel keeps its
          // internal scroll + sticky input.
          "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]",
          // Mid + Wide: side-by-side. ~65% / ~35% via 13fr / 7fr.
          "@[60ch]/focus:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]",
          "@[60ch]/focus:grid-rows-1",
        ].join(" ")}
      >
        <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">{spec}</div>
        <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">{chat}</div>
      </div>
    </div>
  );
}
