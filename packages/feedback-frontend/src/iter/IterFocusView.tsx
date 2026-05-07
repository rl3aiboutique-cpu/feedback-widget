/**
 * Iter focus view — full-canvas iter pane that replaces the rest of
 * the widget while the user is iterating.
 *
 * Layout:
 *
 *   - Header: "← Volver" + ticket title + ticket code badge + close X.
 *   - Collapsible `<IterContextPanel>` with the original feedback.
 *   - Two-column body on lg+ (≥1024px panel width):
 *       Left:  Pregunta enfocada (one open assumption + "More to
 *              review" disclosure for the rest) → spec markdown
 *              growing live (StreamingSkeleton during a run).
 *       Right: Resueltas / Activity rail (~240px wide).
 *     On md/sm: stacks vertically; Resueltas demoted to <details>.
 *   - Footer: Run / Mark ready / Abandon controls + optional comment.
 *
 * Reuses the same data hooks as `IterWorkspace` and `InlineIterPane`
 * so the wire shape and convergence logic stay identical — the
 * difference is purely presentational.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

import { useFeedbackBindings } from "../FeedbackProvider";
import { useMyFeedbackQuery } from "../adapter";
import type { FeedbackRead } from "../client";
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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { AssumptionCard } from "./AssumptionCard";
import { IterContextPanel } from "./IterContextPanel";
import { containsForbidden, defaultForbiddenWords } from "./forbiddenWords";
import { RenderedMarkdown, StreamingSkeleton, modelLatencyHint } from "./markdownView";
import { useIterRunStream } from "./useIterRunStream";

// "Skip" — user can't answer this and asks the model to infer it.
// Reuses `irrelevant` enum value with a marker token in user_response
// so we don't burn a destructive enum migration.
const SKIP_MARKER = "__skip_inferred__";

export interface IterFocusViewProps {
  sessionId: string;
  feedbackId: string;
  onExit: () => void;
}

export function IterFocusView({ sessionId, feedbackId, onExit }: IterFocusViewProps): ReactElement {
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

  // Pull the original feedback from the my-feedback cache. Always
  // available because the canvas renders the focus mode FROM that
  // list — the row is in the query cache by the time we mount.
  const myFeedback = useMyFeedbackQuery(25);
  const feedback: FeedbackRead | undefined = useMemo(
    () => (myFeedback.data ?? []).find((f) => f.id === feedbackId),
    [myFeedback.data, feedbackId],
  );

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

  // Refresh the persisted lists as soon as a stream completes so the
  // spec markdown re-renders on the new version.
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId) {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  }, [stream.state.status, stream.state.versionId, qc, sessionId]);

  // Auto-exit focus when the session reaches a terminal state.
  const status = session.data?.status ?? "loading";
  // Auto-exit on `abandoned` — user explicitly killed the session,
  // dropping them back to the feed avoids a dead screen. For
  // `finalized` we deliberately keep the user in focus so the
  // package download CTA stays visible (1.2s wasn't enough time to
  // read + click; surfaced as the biggest UX risk in the v0.4.1
  // review). The user clicks "← Volver" when ready.
  // ``onExit`` is captured via a ref so re-renders of the parent
  // don't reset the abandoned-exit timeout.
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);
  useEffect(() => {
    if (status === "abandoned") {
      const id = window.setTimeout(() => onExitRef.current(), 1200);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [status]);

  // Defense-in-depth: hide any assumption whose text matches a
  // forbidden word the scrubber might have missed. Soft-fail with
  // a single console.warn so the dev sees the leak.
  const userFacing = useMemo(
    () => (assumptions.data ?? []).filter((a) => a.kind !== "technical"),
    [assumptions.data],
  );
  const visibleAssumptions = useMemo(() => {
    const out: IterAssumptionRead[] = [];
    for (const a of userFacing) {
      const haystack = `${a.statement}\n${a.rationale}`;
      if (containsForbidden(haystack, defaultForbiddenWords)) {
        // eslint-disable-next-line no-console
        console.warn("[iter] hid jargon-leaking assumption", a.slot_key);
        continue;
      }
      out.push(a);
    }
    return out;
  }, [userFacing]);
  const openAssumptions = visibleAssumptions.filter((a) => a.status === "open");
  const otherAssumptions = visibleAssumptions.filter((a) => a.status !== "open");
  const focused: IterAssumptionRead | null = openAssumptions[0] ?? null;
  const remainingOpen = openAssumptions.slice(1);

  const sess = session.data;
  const isStreaming = stream.state.status === "running";
  const isComplete = !!sess?.is_complete;
  const remainingTurns = sess?.remaining_turns ?? 0;
  const maxTurns = sess?.max_turns ?? 0;
  const usedTurns = Math.max(0, maxTurns - remainingTurns);
  const turnBudgetSpent = maxTurns > 0 && remainingTurns <= 0;
  const streamBudgetExhausted =
    stream.state.status === "error" && stream.state.errorCode === "turn_budget_exhausted";

  const latestVersion = useMemo(() => {
    const list = versions.data ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.version_number - a.version_number)[0] ?? null;
  }, [versions.data]);
  const renderedMarkdown = isStreaming ? "" : (latestVersion?.output_markdown ?? "");

  const [msg, setMsg] = useState("");

  const handleSkip = (a: IterAssumptionRead) =>
    resolveMutation.mutateAsync({
      assumptionId: a.id,
      body: { status: "irrelevant", user_response: SKIP_MARKER },
    });

  const onMarkReady = () => {
    void finalizeMutation.mutateAsync();
  };

  const modelHint = modelLatencyHint(
    sess?.current_primary_model_id ?? sess?.last_call_model_id ?? sess?.model_id ?? "",
  );

  return (
    <div className="flex h-full flex-col gap-3" data-feedback-id="iter.focus-view">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-input pb-2">
        <Button size="sm" variant="ghost" onClick={onExit} className="-ml-2 h-7 px-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Button>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground">
          {feedback?.ticket_code ?? "—"}
        </code>
        <span className="truncate font-semibold text-sm">{feedback?.title ?? "Iter session"}</span>
        {maxTurns > 0 ? (
          <Badge variant="outline" className="ml-auto shrink-0 text-[10px] uppercase tracking-wide">
            Round {Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns)} / {maxTurns}
          </Badge>
        ) : null}
        {isComplete ? (
          <Badge className="shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 text-[10px] uppercase tracking-wide">
            Spec ready
          </Badge>
        ) : null}
      </header>

      {/* Surface session/version/assumption fetch failures explicitly
          so the user doesn't sit on a blank loading state forever. */}
      {session.error ? (
        <div className="rounded border border-destructive/60 bg-destructive/10 p-2 text-[11px] text-destructive">
          <strong className="font-semibold">Couldn't load this session.</strong>{" "}
          {String((session.error as { message?: string }).message ?? session.error)}
        </div>
      ) : null}

      {/* Original-context disclosure — force-open on the very first
          entry to a session so the user sees their screenshot at
          least once before it tucks itself away. */}
      <IterContextPanel feedback={feedback} defaultOpen={!sess?.current_iteration_id} />

      {isComplete && sess?.completion_reason ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
          <strong className="font-semibold">Why ready: </strong>
          {sess.completion_reason}
        </p>
      ) : null}

      {/* Two-column body on lg+; stacked on md/sm. */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-3">
        {/* Left: focused question + spec markdown */}
        <div className="flex flex-1 min-w-0 flex-col gap-3 overflow-hidden">
          {focused ? (
            <div className="space-y-2">
              <AssumptionCard
                assumption={focused}
                disabled={status === "finalized" || status === "abandoned"}
                onResolve={(body) =>
                  resolveMutation.mutateAsync({ assumptionId: focused.id, body })
                }
                onSkip={() => handleSkip(focused)}
              />
              {remainingOpen.length > 0 ? (
                <details className="rounded border border-input bg-muted/30 p-2 text-xs">
                  <summary className="cursor-pointer font-medium select-none">
                    More to review ({remainingOpen.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {remainingOpen.map((a) => (
                      <AssumptionCard
                        key={a.id}
                        assumption={a}
                        disabled={status === "finalized" || status === "abandoned"}
                        onResolve={(body) =>
                          resolveMutation.mutateAsync({ assumptionId: a.id, body })
                        }
                        onSkip={() => handleSkip(a)}
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : status !== "finalized" && status !== "abandoned" ? (
            <p className="rounded border border-input bg-muted/30 p-3 text-xs text-muted-foreground">
              {(versions.data?.length ?? 0) > 0
                ? "All assumptions on this round are resolved. Run another iteration to refresh the spec, or mark it ready if you're happy with it."
                : "Run the first iteration to see the AI's draft and any assumptions it needs you to confirm."}
            </p>
          ) : null}

          {/* Spec markdown — streaming skeleton during a run, rendered
              markdown otherwise. Lives in the LEFT column under the
              focused assumption so the user sees the spec growing as
              they answer. */}
          <div className="flex-1 min-h-0 overflow-auto">
            {isStreaming ? (
              <StreamingSkeleton activeSection={stream.state.activeSection} modelHint={modelHint} />
            ) : renderedMarkdown ? (
              <RenderedMarkdown markdown={renderedMarkdown} />
            ) : (
              <div className="rounded border border-input bg-muted/30 p-3 text-xs text-muted-foreground">
                The spec document will appear here once you run the first iteration.
              </div>
            )}
          </div>
        </div>

        {/* Right: resolved-assumptions rail. Closed by default —
            during deep iter work the open ✅ list competes with the
            focused question for attention. The badge keeps the count
            visible so the user knows progress is being tracked. */}
        <aside className="lg:w-60 lg:shrink-0">
          <details className="rounded-md border border-input bg-card text-xs">
            <summary className="cursor-pointer px-2 py-1.5 font-medium select-none flex items-center gap-2">
              <span>Resueltas</span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                {otherAssumptions.length}
              </span>
            </summary>
            <div className="border-t border-input p-2 space-y-2 max-h-72 overflow-auto">
              {otherAssumptions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Nada resuelto todavía.</p>
              ) : (
                otherAssumptions.map((a) => (
                  <div
                    key={a.id}
                    className="rounded border border-input bg-background p-1.5 text-[11px]"
                  >
                    <div className="flex items-center gap-1">
                      <span aria-hidden="true">
                        {a.status === "confirmed" ? "✅" : a.status === "corrected" ? "✏️" : "—"}
                      </span>
                      <code className="truncate font-mono text-[10px] text-muted-foreground">
                        {a.slot_key}
                      </code>
                    </div>
                    <p className="mt-0.5 leading-snug line-clamp-2">{a.statement}</p>
                  </div>
                ))
              )}
            </div>
          </details>
        </aside>
      </div>

      {(stream.state.errorMessage || streamBudgetExhausted) && stream.state.status === "error" ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
          {streamBudgetExhausted
            ? "Has usado todas las rondas para este spec. Marca como listo o abandona la sesión."
            : stream.state.errorMessage}
        </div>
      ) : null}

      {status === "finalized" && pkgQuery.data?.presigned_zip_url ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-2">
          <p className="font-semibold">Spec finalized — your package is ready.</p>
          <a
            href={pkgQuery.data.presigned_zip_url}
            download
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-white text-[11px] font-semibold hover:bg-emerald-700"
          >
            ⬇ Download package ZIP
          </a>
          <p className="text-[10px] text-emerald-800/80">
            You can also re-download anytime from the ticket card after returning to the feed.
          </p>
        </div>
      ) : null}

      {/* Footer controls */}
      {status !== "finalized" && status !== "abandoned" ? (
        <footer className="space-y-2 border-t border-input pt-3">
          {!turnBudgetSpent && !isComplete ? (
            <Textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Optional: anything else for the next iteration?"
              rows={2}
              disabled={isStreaming}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {!turnBudgetSpent && !isComplete ? (
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
                {isStreaming ? (
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
              className="ml-auto text-muted-foreground"
              title="Discard this iter session permanently"
            >
              Abandon
            </Button>
            {/* Note: there's no Close button here on purpose. "← Volver"
                in the header is the single exit semantic — the iter
                session stays alive in the background; "Abandon" is
                the explicit kill. Keeping both made non-technical
                users worry that "Close" was destructive. */}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
