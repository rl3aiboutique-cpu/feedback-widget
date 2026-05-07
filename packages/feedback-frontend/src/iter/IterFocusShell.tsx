/**
 * Layout for the v0.6 spec-protagonist focus view.
 *
 * Three zones:
 *
 *   ┌───────────────────────────────────────┬─────────────────┐
 *   │ SPEC HERO                              │ QUESTION STACK   │
 *   │ (~67%, always visible, scrollable)    │ (~28%, scrolls)  │
 *   ├────────────────────────────────────────┴─────────────────┤
 *   │ CHAT STRIP (full-width, sticky bottom)                    │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Implemented as a CSS grid with three named areas: `spec`,
 * `questions`, `chat`. The chat strip spans both columns at the
 * bottom; the top row splits into spec | questions.
 *
 * Container queries on `@container/focus` drive the reflow at
 * narrow widths — the questions column folds below the spec, and
 * the chat strip stays anchored at the bottom of the viewport.
 *
 * Replaces the v0.5 sidebar / main / rail layout. v0.6.0.
 */

import type { ReactElement, ReactNode } from "react";

export interface IterFocusShellProps {
  spec: ReactNode;
  questions: ReactNode;
  chat: ReactNode;
}

export function IterFocusShell({ spec, questions, chat }: IterFocusShellProps): ReactElement {
  return (
    <div className="@container/focus min-h-0 flex-1">
      <div
        className={[
          "h-full grid gap-3",
          // Narrow: stack spec → questions → chat.
          "grid-cols-1",
          "[grid-template-areas:'spec'_'questions'_'chat']",
          "grid-rows-[minmax(0,1.6fr)_minmax(0,1fr)_auto]",
          // Mid + Wide: two columns top, chat full-width bottom.
          // Spec dominant (~67%), questions narrow (~28%), gap covered
          // by gap-3.
          "@[60ch]/focus:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]",
          "@[60ch]/focus:[grid-template-areas:'spec_questions'_'chat_chat']",
          "@[60ch]/focus:grid-rows-[minmax(0,1fr)_auto]",
        ].join(" ")}
      >
        <div className="[grid-area:spec] min-w-0 min-h-0 flex flex-col overflow-hidden">{spec}</div>
        <div className="[grid-area:questions] min-w-0 min-h-0 flex flex-col overflow-hidden">
          {questions}
        </div>
        <div className="[grid-area:chat] min-w-0">{chat}</div>
      </div>
    </div>
  );
}
