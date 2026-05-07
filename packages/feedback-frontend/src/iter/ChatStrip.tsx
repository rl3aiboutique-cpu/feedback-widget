/**
 * Bottom strip of the v0.6 focus view — chat-style free-text input
 * for the user's pushback / new ideas / corrections that don't fit
 * an assumption card.
 *
 * Behaviour:
 *
 *   - The textarea is always visible. What the user types here is
 *     the next iter call's `user_message` — it persists in the DB
 *     row and lands in the downloadable package along with the
 *     resolved assumptions and spec versions.
 *   - "Run iteration" sends the current textarea content with the
 *     stream.start call. Enabled even when assumptions are still
 *     open: that's the chat-driven path (the user pushes back on
 *     the spec without answering pending Qs first; the next iter
 *     incorporates the chat AND keeps the open assumptions).
 *   - "Mark ready" triggers finalize. Disabled when an open
 *     assumption is still pending (the user must resolve all
 *     before declaring the spec ready).
 *   - "Abandon" kills the session. Always available except during
 *     a stream.
 *
 * No version bump per intra-iteration polish. v0.6.0 — replaces the
 * old footer that lived inside IterFocusView.
 */

import { Loader2 } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export interface ChatStripProps {
  /** True while a stream is in flight — disables Run / Mark / Abandon
   * and shows a spinner on the Run button. */
  streaming: boolean;
  /** True when the session has burned through ITER_MAX_TURNS. The
   * Run button hides; Mark ready becomes the recommended action. */
  turnBudgetSpent: boolean;
  /** True when the session is already complete (`is_complete` from
   * the backend). Run hides; Mark ready stays prominent. */
  isComplete: boolean;
  /** Number of open assumptions still awaiting a user response.
   * Mark ready is disabled while > 0. */
  openCount: number;
  /** Optional warning copy shown above the textarea — used by the
   * focus view to surface 'turn budget exhausted' or session error
   * in line with the input field. */
  banner?: string | null;
  /** Caller's submit handler — receives the current textarea value
   * (may be empty), clears the textarea on success. */
  onRunIteration: (message: string) => Promise<unknown> | undefined;
  onMarkReady: () => Promise<unknown> | undefined;
  onAbandon: () => Promise<unknown> | undefined;
}

export function ChatStrip({
  streaming,
  turnBudgetSpent,
  isComplete,
  openCount,
  banner,
  onRunIteration,
  onMarkReady,
  onAbandon,
}: ChatStripProps): ReactElement {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const showRun = !turnBudgetSpent && !isComplete;
  const markReadyDisabled = openCount > 0 || streaming || busy;

  const submit = async () => {
    setBusy(true);
    try {
      await onRunIteration(msg);
      setMsg("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer
      className="flex flex-col gap-2 border-t border-input bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Chat e iteración"
    >
      {banner ? (
        <p
          className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100"
          style={{ fontSize: "0.7rem" }}
        >
          {banner}
        </p>
      ) : null}

      <Textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder={
          showRun
            ? "Escribe tu desacuerdo, una idea nueva o lo que el AI deba reconsiderar…"
            : "El chat queda registrado en el ledger. (No iterable: ronda completada.)"
        }
        rows={2}
        disabled={streaming || busy || (!showRun && isComplete)}
        className="min-h-[3rem] resize-y"
        style={{ fontSize: "0.85rem" }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {showRun ? (
          <Button
            size="sm"
            onClick={submit}
            disabled={streaming || busy}
            title={
              openCount > 0
                ? "Iterar incorporando el chat (las preguntas abiertas siguen disponibles)."
                : "Ejecutar la siguiente ronda."
            }
          >
            {streaming || busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
              </>
            ) : (
              "Run iteration"
            )}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={turnBudgetSpent || isComplete ? "default" : "secondary"}
          onClick={() => onMarkReady()}
          disabled={markReadyDisabled}
          title={
            openCount > 0
              ? "Resuelve las preguntas pendientes antes de marcar como listo."
              : "Finalizar el spec y producir el paquete dev-ready."
          }
        >
          Mark ready
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAbandon()}
          disabled={streaming || busy}
          className="ml-auto text-muted-foreground"
          title="Descartar esta sesión iter permanentemente."
        >
          Abandon
        </Button>
      </div>
    </footer>
  );
}
