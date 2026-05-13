/**
 * Final synthesis card for the chat-first feedback flow (D-015, D-012).
 *
 * Rendered once the backend emits the `synthesis` SSE event. Surfaces the
 * structured turn payload (title / summary / user_story / acceptance
 * criteria / open questions).
 *
 * Type + severity are deliberately NOT rendered (D-008: admin-only).
 *
 * Bottom buttons (Confirmar / Sigamos iterando) live in the Sheet footer
 * via `<FooterActions>` per S3F shell-hybrid — this card is content-only.
 *
 * Spanish copy is fixed — the sandbox runs in `es` and v1 hosts inherit
 * that. Locale-aware copy lands later if a non-es host appears.
 */

import type { ReactElement } from "react";

import type { Synthesis } from "./types";

export interface SynthesisCardProps {
  synthesis: Synthesis;
}

export function SynthesisCard({ synthesis }: SynthesisCardProps): ReactElement {
  return (
    <div
      className="mx-4 my-3 flex flex-col gap-3 rounded-lg border border-input bg-card p-4 shadow-sm"
      data-feedback-id="feedback.chat_synthesis_card"
    >
      <h3 className="text-base font-bold text-foreground">{synthesis.title}</h3>

      <p className="text-sm text-muted-foreground">{synthesis.summary}</p>

      <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-foreground">
        {synthesis.user_story}
      </blockquote>

      {synthesis.acceptance_criteria.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Criterios de aceptación
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {synthesis.acceptance_criteria.map((ac, idx) => (
              <li key={`ac-${idx}-${ac.slice(0, 16)}`}>{ac}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {synthesis.open_questions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preguntas abiertas
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {synthesis.open_questions.map((q, idx) => (
              <li key={`oq-${idx}-${q.slice(0, 16)}`}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
