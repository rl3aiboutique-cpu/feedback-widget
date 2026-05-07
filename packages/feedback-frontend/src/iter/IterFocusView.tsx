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
  editIterVersionMarkdown,
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
import { EditableSpecPanel } from "./EditableSpecPanel";
import { ElapsedTimer } from "./ElapsedTimer";
import { FallbackToast } from "./FallbackToast";
import { HintLine } from "./HintLine";
import { IterFocusShell } from "./IterFocusShell";
import { IterMetadataRail } from "./IterMetadataRail";
import { IterPendingSidebar } from "./IterPendingSidebar";
import { ModelBadge } from "./ModelBadge";
import { containsForbidden, defaultForbiddenWords } from "./forbiddenWords";
import { modelLatencyHint } from "./markdownView";
import { deriveIterRunMeta } from "./useIterRunMeta";
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

  // v0.4.4 — submitter can now edit the spec markdown in place.
  // Same endpoint the admin IterWorkspace uses; same query
  // invalidation key so the rendered markdown updates after save.
  const editMarkdownMutation = useMutation({
    mutationFn: ({ versionId, markdown }: { versionId: string; markdown: string }) =>
      editIterVersionMarkdown(bindings, sessionId, versionId, {
        output_markdown: markdown,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
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

  // v0.4.4 — auto-fire the FIRST iteration when the user enters the
  // focus mode of a virgin session. Subsequent iterations stay
  // opt-in. Guard with a ref so a re-mount (host tab switch and
  // back) doesn't double-fire. The user can [Cancelar] the banner
  // to bail before the turn lands; cancel kills the session via
  // abandonMutation so ITER_MAX_TURNS isn't burned.
  const autoFiredRef = useRef(false);
  const autoFireUserCancelledRef = useRef(false);
  const isVirginSession =
    !session.isLoading &&
    session.data !== undefined &&
    !session.data.current_iteration_id &&
    (versions.data?.length ?? 0) === 0;
  useEffect(() => {
    if (
      !autoFiredRef.current &&
      !autoFireUserCancelledRef.current &&
      isVirginSession &&
      stream.state.status === "idle"
    ) {
      autoFiredRef.current = true;
      stream.start({ user_message: "", restructure_allowed: false });
    }
  }, [isVirginSession, stream]);
  // Banner stays visible while the FIRST stream is in flight (no
  // versions yet) and auto-fire was the trigger.
  const showAutoFireBanner =
    autoFiredRef.current && stream.state.status === "running" && (versions.data?.length ?? 0) === 0;
  const cancelAutoFire = () => {
    autoFireUserCancelledRef.current = true;
    stream.reset();
    abandonMutation.mutate();
    onExitRef.current();
  };

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
  const openAssumptions = useMemo(
    () => visibleAssumptions.filter((a) => a.status === "open"),
    [visibleAssumptions],
  );
  const otherAssumptions = useMemo(
    () => visibleAssumptions.filter((a) => a.status !== "open"),
    [visibleAssumptions],
  );

  // v0.5.0 (Block A) — sidebar-driven selection of the focused
  // assumption. Default = first open. If the user resolves the
  // currently selected one (or it leaves the open set for any other
  // reason) we re-anchor on the next first-open so main never
  // renders a card that's no longer "open".
  const [selectedAssumptionId, setSelectedAssumptionId] = useState<string | null>(null);
  useEffect(() => {
    const stillOpen =
      selectedAssumptionId !== null && openAssumptions.some((a) => a.id === selectedAssumptionId);
    if (!stillOpen) {
      setSelectedAssumptionId(openAssumptions[0]?.id ?? null);
    }
  }, [openAssumptions, selectedAssumptionId]);
  const focused: IterAssumptionRead | null =
    openAssumptions.find((a) => a.id === selectedAssumptionId) ?? openAssumptions[0] ?? null;

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

  // Spec area smooth-scrolls to top when a fresh stream lands so the
  // user sees the new content rather than wherever the previous
  // version ended up. Ref only changes on each render of the spec
  // panel; no state needed.
  const specScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId && specScrollRef.current) {
      specScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [stream.state.status, stream.state.versionId]);

  // v0.5 (Block B) — auto-scroll the active spec section into view as
  // the SSE `section` event fires. User scroll cancels until the next
  // section transition. Why a ref instead of state: we want the
  // wheel/touch handler to flip the flag synchronously without
  // re-rendering the whole tree. Reset on the rising edge of
  // activeSection so each new section gets one auto-scroll attempt.
  const userScrollOverrideRef = useRef(false);
  const lastAutoScrolledSectionRef = useRef<string | null>(null);
  useEffect(() => {
    const el = specScrollRef.current;
    if (!el) return;
    const onUserScroll = () => {
      userScrollOverrideRef.current = true;
    };
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
    };
  }, []);
  useEffect(() => {
    const active = stream.state.activeSection;
    if (!active) return;
    if (active === lastAutoScrolledSectionRef.current) return;
    // Section just changed — reset user override + scroll the new
    // card into view.
    userScrollOverrideRef.current = false;
    lastAutoScrolledSectionRef.current = active;
    const target = document.getElementById(`iter-section-${active}`);
    if (target && !userScrollOverrideRef.current) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [stream.state.activeSection]);

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

  // v0.5 (Block C) — single source of truth for the live model
  // state. Drives the rail badge, elapsed timer, hint line, and
  // the fallback toast. Active model never appears as a hard-coded
  // string in copy; everything reads from `meta.active`.
  const meta = useMemo(() => deriveIterRunMeta(stream.state, sess), [stream.state, sess]);

  // v0.5 — auto-iter countdown when the user just resolved the LAST
  // open assumption. Drops a 5 s warning banner with a Cancel button
  // before firing the next iteration so the senior-analyst loop
  // keeps moving without forcing the user to remember to click Run.
  // Counter is wall-clock so re-renders don't drift; refs guard
  // against double-fire from query refetches; cancellation persists
  // for the lifetime of the resolution-state.
  const [autoIterCountdown, setAutoIterCountdown] = useState<number | null>(null);
  const autoIterCancelledRef = useRef(false);
  const autoIterFiredRef = useRef<string | null>(null);
  const allResolvedKey = useMemo(() => {
    if (openAssumptions.length !== 0) return null;
    if ((versions.data?.length ?? 0) === 0) return null;
    if (status === "finalized" || status === "abandoned") return null;
    if (turnBudgetSpent || isComplete || isStreaming) return null;
    const v = versions.data?.[0]?.version_number ?? 0;
    return `v${v}`;
  }, [openAssumptions.length, versions.data, status, turnBudgetSpent, isComplete, isStreaming]);
  useEffect(() => {
    if (allResolvedKey === null) {
      setAutoIterCountdown(null);
      autoIterCancelledRef.current = false;
      return;
    }
    if (autoIterFiredRef.current === allResolvedKey) return;
    if (autoIterCancelledRef.current) return;
    setAutoIterCountdown(5);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const remaining = 5 - Math.floor((Date.now() - startedAt) / 1000);
      if (remaining <= 0) {
        window.clearInterval(tick);
        if (autoIterCancelledRef.current) return;
        autoIterFiredRef.current = allResolvedKey;
        setAutoIterCountdown(null);
        stream.start({ user_message: "", restructure_allowed: false });
      } else {
        setAutoIterCountdown(remaining);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [allResolvedKey, stream]);
  const cancelAutoIter = () => {
    autoIterCancelledRef.current = true;
    setAutoIterCountdown(null);
  };
  // Esc closes the countdown banner — same gesture the toast uses.
  useEffect(() => {
    if (autoIterCountdown === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelAutoIter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoIterCountdown]);

  return (
    <div className="flex h-full flex-col gap-3" data-feedback-id="iter.focus-view">
      {/* Header — round indicator moved to the rail in v0.5.0; the
          header now keeps Back / ticket / title and the Spec-ready
          badge only. Title scales fluidly with the focus pane width
          via clamp(). */}
      <header className="flex items-center gap-2 border-b border-input pb-2">
        <Button size="sm" variant="ghost" onClick={onExit} className="-ml-2 h-7 px-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Button>
        <code
          className="rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground"
          style={{ fontSize: "0.7rem" }}
        >
          {feedback?.ticket_code ?? "—"}
        </code>
        <span
          className="truncate font-semibold"
          style={{ fontSize: "clamp(0.875rem, 0.8rem + 0.3cqi, 1.125rem)" }}
        >
          {feedback?.title ?? "Iter session"}
        </span>
        {isComplete ? (
          <Badge
            className="ml-auto shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 uppercase tracking-wide"
            style={{ fontSize: "0.625rem" }}
          >
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

      {/* v0.4.4 auto-fire banner — visible while the first iteration
          is in flight and the user can still bail without burning a
          turn. Cancel kills the session via abandonMutation. */}
      {showAutoFireBanner ? (
        <div className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
          <div className="flex-1">
            <div className="font-semibold text-primary">Iniciando primera ronda…</div>
            <div className="text-[11px] text-muted-foreground">
              El AI está leyendo tu feedback, los archivos adjuntos y los datos técnicos. Esto tarda
              60–180 segundos en la primera ronda.
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelAutoFire}
            className="shrink-0 text-muted-foreground"
            title="Cancelar la primera ronda y volver al feed (no consume turno)"
          >
            Cancelar
          </Button>
        </div>
      ) : null}

      {/* v0.5 (Block C) — fallback now arrives as a transient
          Radix Toast portaled above the Sheet z-stack. Auto-dismiss
          6 s with pause-on-hover; the rail badge keeps the active
          model visible after dismissal. The static banner that
          lived here in v0.4.6 is gone. */}
      <FallbackToast fallback={stream.state.providerFallback} />

      {isComplete && sess?.completion_reason ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
          <strong className="font-semibold">Why ready: </strong>
          {sess.completion_reason}
        </p>
      ) : null}

      {/* v0.5.0 (Block A) — three-slot fluid grid. The shell owns
          the @container query; the three slots reflow wide → mid →
          narrow without media queries. Sidebar holds the full pending
          list (no `+ N más`); main holds the focused-question card +
          spec stream; rail holds run metadata + IterContextPanel. */}
      <IterFocusShell
        sidebar={
          <IterPendingSidebar
            openAssumptions={openAssumptions}
            resolvedAssumptions={otherAssumptions}
            selectedId={selectedAssumptionId}
            onSelect={setSelectedAssumptionId}
            disabled={status === "finalized" || status === "abandoned"}
          />
        }
        main={
          <div className="flex h-full min-h-0 flex-col gap-3">
            {focused ? (
              <AssumptionCard
                assumption={focused}
                disabled={status === "finalized" || status === "abandoned"}
                onResolve={(body) =>
                  resolveMutation.mutateAsync({ assumptionId: focused.id, body })
                }
                onSkip={() => handleSkip(focused)}
              />
            ) : status !== "finalized" && status !== "abandoned" ? (
              (versions.data?.length ?? 0) > 0 ? (
                autoIterCountdown !== null ? (
                  <div
                    className="flex items-center gap-3 rounded-md border-2 border-primary/60 bg-primary/10 px-3 py-2 text-primary dark:border-primary/70 dark:bg-primary/15"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <Loader2 aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin" />
                    <div className="flex-1 leading-snug">
                      <strong className="font-semibold">Auto-iter en {autoIterCountdown}s.</strong>{" "}
                      Has resuelto todas las preguntas; voy a lanzar la siguiente ronda
                      automáticamente. Pulsa Cancelar (o Esc) si prefieres revisar primero.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelAutoIter}
                      className="shrink-0"
                      title="Cancelar el auto-iter (Esc)"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div
                    className="rounded-md border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100"
                    style={{ fontSize: "0.75rem" }}
                  >
                    <span aria-hidden="true" className="mr-1.5">
                      ✅
                    </span>
                    <strong className="font-semibold">Todo respondido</strong> — listo para iterar
                    de nuevo o marcar como listo.
                  </div>
                )
              ) : (
                <p
                  className="rounded border border-input bg-muted/30 p-3 text-muted-foreground"
                  style={{ fontSize: "0.75rem" }}
                >
                  Run the first iteration to see the AI's draft and any assumptions it needs you to
                  confirm.
                </p>
              )
            ) : null}
            <div
              ref={specScrollRef}
              className="flex-1 min-h-0 overflow-auto"
              style={{ maxWidth: "75ch", marginInline: "auto", width: "100%" }}
            >
              <EditableSpecPanel
                markdown={renderedMarkdown}
                streaming={isStreaming}
                activeSection={stream.state.activeSection}
                sectionStates={isStreaming ? stream.state.sectionStates : undefined}
                hideSections={["diagram"]}
                editable={
                  !isStreaming &&
                  status !== "finalized" &&
                  status !== "abandoned" &&
                  !!latestVersion
                }
                onSaveEdit={async (next) => {
                  if (!latestVersion) return;
                  await editMarkdownMutation.mutateAsync({
                    versionId: latestVersion.id,
                    markdown: next,
                  });
                }}
                saving={editMarkdownMutation.isPending}
                modelHint={modelHint}
                textareaMinHeightClass="min-h-[60vh]"
                emptyStateMessage="El spec aparecerá aquí cuando termine la primera ronda. Mientras tanto, puedes cancelar."
                roundNumber={Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns) || undefined}
                maxRounds={maxTurns || undefined}
              />
            </div>
          </div>
        }
        rail={
          <IterMetadataRail
            feedback={feedback}
            contextDefaultOpen={!sess?.current_iteration_id}
            contextStreaming={isStreaming}
            roundCurrent={
              maxTurns > 0 ? Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns) : null
            }
            roundMax={maxTurns > 0 ? maxTurns : null}
            modelBadgeSlot={<ModelBadge meta={meta} />}
            elapsedTimerSlot={<ElapsedTimer meta={meta} />}
            hintSlot={<HintLine meta={meta} errorMessage={stream.state.errorMessage} />}
          />
        }
      />

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
