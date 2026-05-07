/**
 * Right column of the v0.6 focus view — the assumption stack.
 *
 * Lists ALL assumptions for the current session, full size, in two
 * blocks:
 *
 *   1. ABIERTAS — top, full action buttons via existing AssumptionCard
 *      (Confirm / Correct / Skip + multi-choice options when present).
 *   2. RESUELTAS — below, dimmed but legible. Each card surfaces a
 *      "✎ Change my answer" affordance that re-opens it in place
 *      (existing AssumptionCard behaviour). Critical for the user's
 *      'siempre se puede volver y responder otra cosa' rule.
 *
 * Why all-visible-instead-of-archived: the iter session's downstream
 * purpose is producing a chronological context ledger that an
 * implementation agent (Claude Code) consumes. Hiding resolved cards
 * behind a disclosure breaks the visible track. The user explicitly
 * confirmed: "todo eso es contexto para guardar".
 *
 * v0.6.0 — replaces IterPendingSidebar (which is being deleted).
 */

import { type ReactElement, useMemo } from "react";

import type { IterAssumptionRead } from "../client/types";
import { AssumptionCard } from "./AssumptionCard";

export interface QuestionStackPanelProps {
  /** All assumptions for the current session, post-forbidden-words
   * filter. Open + resolved together; the panel partitions internally. */
  assumptions: IterAssumptionRead[];
  /** Resolution callback — same signature as AssumptionCard. */
  onResolve: (
    assumptionId: string,
    body: { status: "confirmed" | "corrected" | "irrelevant"; user_response?: string },
  ) => Promise<unknown> | undefined;
  /** Skip callback — sets status=irrelevant with the SKIP_MARKER token. */
  onSkip: (assumption: IterAssumptionRead) => Promise<unknown> | undefined;
  /** Disable interaction — finalized / abandoned sessions stay
   * read-only so historical state doesn't drift. */
  disabled: boolean;
  /** Empty-state message when the session has zero assumptions
   * (round 1 pre-iter, or nothing-pending nothing-resolved). The
   * caller passes context-specific copy. */
  emptyMessage?: string;
}

export function QuestionStackPanel({
  assumptions,
  onResolve,
  onSkip,
  disabled,
  emptyMessage,
}: QuestionStackPanelProps): ReactElement {
  const { open, resolved } = useMemo(() => {
    const o: IterAssumptionRead[] = [];
    const r: IterAssumptionRead[] = [];
    for (const a of assumptions) {
      if (a.status === "open") o.push(a);
      else r.push(a);
    }
    return { open: o, resolved: r };
  }, [assumptions]);

  const empty = open.length === 0 && resolved.length === 0;

  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-2 overflow-auto"
      aria-label="Preguntas del AI"
    >
      <header
        className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-1 py-2 font-semibold text-primary backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ fontSize: "0.7rem" }}
      >
        <span aria-hidden="true">❓</span>
        <span className="uppercase tracking-wide">Preguntas</span>
        {open.length > 0 ? (
          <span
            className="rounded-full bg-yellow-100 px-1.5 py-0.5 font-mono text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100"
            style={{ fontSize: "0.6rem" }}
          >
            {open.length} abrt
          </span>
        ) : null}
        {resolved.length > 0 ? (
          <span
            className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
            style={{ fontSize: "0.6rem" }}
          >
            {resolved.length} resueltas
          </span>
        ) : null}
      </header>

      {empty ? (
        <p
          className="rounded border border-input bg-muted/30 p-3 italic text-muted-foreground"
          style={{ fontSize: "0.7rem" }}
        >
          {emptyMessage ?? "Las preguntas aparecerán cuando el AI termine de leer tu feedback."}
        </p>
      ) : null}

      {open.length > 0 ? (
        <div className="space-y-2">
          {open.map((a) => (
            <AssumptionCard
              key={a.id}
              assumption={a}
              disabled={disabled}
              onResolve={(body) => onResolve(a.id, body)}
              onSkip={() => onSkip(a)}
            />
          ))}
        </div>
      ) : null}

      {resolved.length > 0 ? (
        <>
          <div
            className="mt-2 flex items-center gap-2 px-1 text-muted-foreground"
            style={{ fontSize: "0.6rem" }}
          >
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="uppercase tracking-wide">Resueltas ({resolved.length})</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          {/* Resolved cards render at reduced visual weight so the
              attention budget goes to the open block — but they're
              still full AssumptionCards so 'Change my answer' lifts
              them right back into the open state in place. */}
          <div className="space-y-2 opacity-75">
            {resolved.map((a) => (
              <AssumptionCard
                key={a.id}
                assumption={a}
                disabled={disabled}
                onResolve={(body) => onResolve(a.id, body)}
                onSkip={() => onSkip(a)}
              />
            ))}
          </div>
        </>
      ) : null}
    </aside>
  );
}
