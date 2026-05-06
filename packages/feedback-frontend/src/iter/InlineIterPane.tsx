/**
 * Inline iter pane — replaces the v0.3.x fullscreen `IterWorkspace`
 * for the submitter's flow.
 *
 * Renders inside the expanded ticket card on the canvas, NOT as a
 * modal-over-Sheet. Reuses every data hook from `IterWorkspace` so
 * the wire shape stays identical; the difference is purely
 * presentational + the convergence UI:
 *
 *   * "Round N of M" counter from the session's `remaining_turns`.
 *   * One-question-at-a-time disclosure: a single open assumption
 *     is featured, the rest collapse under "More to review".
 *   * `is_complete` from the latest version swaps "Run iteration"
 *     for "Mark ready" + the model's `completion_reason` rationale.
 *   * Multiple-choice assumption rendering when `options[]` is set.
 *
 * Errors with code `turn_budget_exhausted` (sent by the iter router
 * when the session has used all `ITER_MAX_TURNS`) collapse the run
 * controls and surface "Mark ready" / "Abandon" only.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

import { useFeedbackBindings } from "../FeedbackProvider";
import {
  abandonIterSession,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  listIterAssumptions,
  listIterVersions,
  resolveIterAssumption,
} from "../client/iter";
import type { IterAssumptionRead } from "../client/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { AssumptionCard } from "./AssumptionCard";
import { useIterRunStream } from "./useIterRunStream";

// "Skip" — user can't answer this and asks the model to infer it.
// Reuses the existing `irrelevant` enum value with a marker token in
// `user_response` so we don't burn a destructive enum migration.
const SKIP_MARKER = "__skip_inferred__";

export interface InlineIterPaneProps {
  sessionId: string;
  onClose?: () => void;
}

export function InlineIterPane({ sessionId, onClose }: InlineIterPaneProps): ReactElement {
  const bindings = useFeedbackBindings();
  const qc = useQueryClient();

  const session = useQuery({
    queryKey: ["iter-session", sessionId],
    queryFn: () => getIterSession(bindings, sessionId),
    refetchInterval: 5000,
  });

  const versions = useQuery({
    queryKey: ["iter-versions", sessionId],
    queryFn: () => listIterVersions(bindings, sessionId),
    enabled: !!session.data,
  });

  const assumptions = useQuery({
    queryKey: ["iter-assumptions", sessionId],
    queryFn: () => listIterAssumptions(bindings, sessionId),
    enabled: !!session.data?.current_iteration_id,
  });

  const stream = useIterRunStream(bindings, sessionId);

  const resolveMutation = useMutation({
    mutationFn: ({
      assumptionId,
      body,
    }: {
      assumptionId: string;
      body: {
        status: "confirmed" | "corrected" | "irrelevant";
        user_response?: string;
      };
    }) => resolveIterAssumption(bindings, assumptionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeIterSession(bindings, sessionId),
    onSuccess: (pkg) => {
      qc.setQueryData(["iter-package", sessionId], pkg);
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    },
  });

  const abandonMutation = useMutation({
    mutationFn: () => abandonIterSession(bindings, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    },
  });

  const pkgQuery = useQuery({
    queryKey: ["iter-package", sessionId],
    queryFn: () => getIterPackage(bindings, sessionId),
    enabled: session.data?.status === "finalized",
  });

  const userFacing = useMemo(
    () => (assumptions.data ?? []).filter((a) => a.kind !== "technical"),
    [assumptions.data],
  );
  const openAssumptions = userFacing.filter((a) => a.status === "open");
  const otherAssumptions = userFacing.filter((a) => a.status !== "open");
  const focused: IterAssumptionRead | null = openAssumptions[0] ?? null;
  const remainingOpen = openAssumptions.slice(1);

  const sess = session.data;
  const status = sess?.status ?? "loading";
  const isStreaming = stream.state.status === "running";
  const isComplete = !!sess?.is_complete;
  const remainingTurns = sess?.remaining_turns ?? 0;
  const maxTurns = sess?.max_turns ?? 0;
  const usedTurns = Math.max(0, maxTurns - remainingTurns);
  const turnBudgetSpent = maxTurns > 0 && remainingTurns <= 0;
  const streamBudgetExhausted =
    stream.state.status === "error" && stream.state.errorCode === "turn_budget_exhausted";

  const [msg, setMsg] = useState("");

  const handleSkip = (a: IterAssumptionRead) =>
    resolveMutation.mutateAsync({
      assumptionId: a.id,
      body: { status: "irrelevant", user_response: SKIP_MARKER },
    });

  const onMarkReady = () => {
    if (openAssumptions.length === 0) {
      void finalizeMutation.mutateAsync();
      return;
    }
    // If user marks ready while there are still open assumptions,
    // surface a confirmation in the parent — we keep this pane
    // light, so we just call finalize directly. The iter router's
    // existing finalize-warning path handles the "are you sure?"
    // confirmation modal at the page level.
    void finalizeMutation.mutateAsync();
  };

  if (status === "loading") {
    return (
      <div className="rounded-md border border-input bg-card p-3 text-xs text-muted-foreground">
        Loading iter session…
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-primary/30 bg-card p-3 space-y-3 text-xs"
      data-feedback-id="iter.inline-pane"
    >
      <header className="flex items-center gap-2">
        <span className="font-semibold">Iterate with AI</span>
        {maxTurns > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            Round {Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns)} of {maxTurns}
          </span>
        )}
        {isStreaming && (
          <span className="flex items-center gap-1 text-[11px] text-primary">
            <Loader2 className="h-3 w-3 animate-spin" /> writing…
          </span>
        )}
        {isComplete && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-900">
            Spec ready
          </span>
        )}
        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="ml-auto h-6 px-2 text-[11px]"
          >
            <X className="h-3 w-3" /> Close
          </Button>
        )}
      </header>

      {isComplete && sess?.completion_reason && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
          <strong className="font-semibold">Why ready: </strong>
          {sess.completion_reason}
        </p>
      )}

      {/* Focused assumption — one at a time, the rest under a disclosure. */}
      {focused ? (
        <div className="space-y-2">
          <AssumptionCard
            assumption={focused}
            disabled={status === "finalized" || status === "abandoned"}
            onResolve={(body) => resolveMutation.mutateAsync({ assumptionId: focused.id, body })}
            onSkip={() => handleSkip(focused)}
          />
          {remainingOpen.length > 0 && (
            <details className="rounded border bg-muted/40 p-2">
              <summary className="cursor-pointer font-medium">
                More to review ({remainingOpen.length})
              </summary>
              <div className="mt-2 space-y-2">
                {remainingOpen.map((a) => (
                  <AssumptionCard
                    key={a.id}
                    assumption={a}
                    disabled={status === "finalized" || status === "abandoned"}
                    onResolve={(body) => resolveMutation.mutateAsync({ assumptionId: a.id, body })}
                    onSkip={() => handleSkip(a)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      ) : status !== "finalized" && status !== "abandoned" ? (
        <p className="text-muted-foreground">
          {versions.data?.length
            ? "All assumptions on this round are resolved. Run another iteration to refresh the spec, or mark it ready if you're happy with it."
            : "Run the first iteration to see the AI's draft and any assumptions it needs you to confirm."}
        </p>
      ) : null}

      {otherAssumptions.length > 0 && (
        <details className="rounded border bg-muted/40 p-2">
          <summary className="cursor-pointer font-medium">
            Resolved ({otherAssumptions.length})
          </summary>
          <div className="mt-2 space-y-2">
            {otherAssumptions.map((a) => (
              <AssumptionCard
                key={a.id}
                assumption={a}
                disabled={status === "finalized" || status === "abandoned"}
                onResolve={(body) => resolveMutation.mutateAsync({ assumptionId: a.id, body })}
                onSkip={() => handleSkip(a)}
              />
            ))}
          </div>
        </details>
      )}

      {(stream.state.errorMessage || streamBudgetExhausted) && stream.state.status === "error" && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
          {streamBudgetExhausted
            ? "You've used all the iteration rounds for this spec. Mark it ready or abandon the session."
            : stream.state.errorMessage}
        </div>
      )}

      {status === "finalized" && pkgQuery.data?.presigned_zip_url && (
        <a
          href={pkgQuery.data.presigned_zip_url}
          download
          className="inline-block text-primary underline"
        >
          Download package ZIP
        </a>
      )}

      {/* Run / Mark ready / Abandon controls. */}
      {status !== "finalized" && status !== "abandoned" && (
        <div className="space-y-2">
          {!turnBudgetSpent && !isComplete && (
            <Textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Optional: anything else for the next iteration?"
              rows={2}
              disabled={isStreaming}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!turnBudgetSpent && !isComplete && (
              <Button
                size="sm"
                disabled={isStreaming || openAssumptions.length > 0}
                onClick={() => {
                  stream.start({ user_message: msg, restructure_allowed: false });
                  setMsg("");
                }}
                title={
                  openAssumptions.length > 0
                    ? "Resolve the open assumption(s) first"
                    : "Run the next iteration"
                }
              >
                {isStreaming ? "Running…" : "Run iteration"}
              </Button>
            )}
            <Button
              size="sm"
              variant={turnBudgetSpent || isComplete ? "default" : "secondary"}
              onClick={onMarkReady}
              disabled={!sess?.current_iteration_id || finalizeMutation.isPending || isStreaming}
              title="Finalize the spec and produce the developer package"
            >
              {finalizeMutation.isPending ? "Marking ready…" : "Mark ready"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => abandonMutation.mutate()}
              disabled={abandonMutation.isPending || isStreaming}
              className="text-muted-foreground"
            >
              Abandon
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
