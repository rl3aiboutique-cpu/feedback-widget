/**
 * Iter focus view — full-canvas iter pane that replaces the rest of
 * the widget while the user is iterating.
 *
 * v0.6.0 — Spec-protagonist redesign. Three zones:
 *
 *   - SPEC HERO (left-center, ~67%) — always visible, always
 *     dominant; streams progressively, editable in place.
 *   - QUESTION STACK (right, ~28%) — all assumptions visible
 *     (open above, resolved below dimmed and re-editable).
 *   - CHAT STRIP (full-width bottom) — free-text textarea +
 *     Run iteration / Mark ready / Abandon.
 *
 * Why three zones, no left sidebar: the iter session's downstream
 * purpose is producing a chronological context ledger that an
 * implementation agent (Claude Code) consumes. Resolved
 * assumptions stay visible because every artifact is part of the
 * ledger; nothing is "archived". The spec is the protagonist; the
 * user reads it always; questions and chat orbit it.
 *
 * Reuses the same data hooks as `IterWorkspace` and `InlineIterPane`
 * so the wire shape stays identical — the difference is purely
 * presentational. See `docs/specs/2026-05-08-spec-protagonist-redesign.md`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
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
import { ChatStrip } from "./ChatStrip";
import { ContextDialog } from "./ContextDialog";
import { EditableSpecPanel } from "./EditableSpecPanel";
import { FallbackToast } from "./FallbackToast";
import { IterFocusShell } from "./IterFocusShell";
import { QuestionStackPanel } from "./QuestionStackPanel";
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

  // Spec area smooth-scrolls to top when a fresh stream lands so the
  // user sees the new content rather than wherever the previous
  // version ended up.
  const specScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId && specScrollRef.current) {
      specScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [stream.state.status, stream.state.versionId]);

  // v0.5 (Block B) — auto-scroll the active spec section into view as
  // the SSE `section` event fires. User scroll cancels until the next
  // section transition.
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

  const onMarkReady = () => finalizeMutation.mutateAsync();

  const modelHint = modelLatencyHint(
    sess?.current_primary_model_id ?? sess?.last_call_model_id ?? sess?.model_id ?? "",
  );

  // v0.5 (Block C) — single source of truth for the live model
  // state. Drives the header chips line and the fallback toast.
  // Active model name is never hardcoded in copy.
  const meta = useMemo(() => deriveIterRunMeta(stream.state, sess), [stream.state, sess]);

  // v0.5 — auto-iter countdown when the user just resolved the LAST
  // open assumption. 5s warning, Cancel + Esc, wall-clock timer.
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
  useEffect(() => {
    if (autoIterCountdown === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        autoIterCancelledRef.current = true;
        setAutoIterCountdown(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoIterCountdown]);

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-3" data-feedback-id="iter.focus-view">
      {/* Header — slim. Round + tiny model chip on the right; ⚙
          Contexto button opens the Dialog with the original feedback. */}
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
        <span
          className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground"
          style={{ fontSize: "0.65rem" }}
        >
          {maxTurns > 0 ? (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono uppercase tracking-wide">
              Round {Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns)}/{maxTurns}
            </span>
          ) : null}
          {meta.active ? (
            <span
              className="hidden truncate font-mono @[60ch]/focus:inline"
              title={`Modelo activo: ${meta.active}`}
              style={{ maxWidth: "12ch" }}
            >
              <span aria-hidden="true">⚡</span> {meta.active}
            </span>
          ) : null}
        </span>
        {isComplete ? (
          <Badge
            className="shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 uppercase tracking-wide"
            style={{ fontSize: "0.625rem" }}
          >
            Spec ready
          </Badge>
        ) : null}
        <ContextDialog
          feedback={feedback}
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0"
              title="Ver contexto original (feedback + screenshot)"
              aria-label="Ver contexto original"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          }
        />
      </header>

      {/* Surface session/version/assumption fetch failures so the
          user doesn't sit on a blank loading state forever. */}
      {session.error ? (
        <div
          className="rounded border border-destructive/60 bg-destructive/10 p-2 text-destructive"
          style={{ fontSize: "0.7rem" }}
        >
          <strong className="font-semibold">Couldn't load this session.</strong>{" "}
          {String((session.error as { message?: string }).message ?? session.error)}
        </div>
      ) : null}

      {/* v0.4.4 auto-fire banner — round 1 only. */}
      {showAutoFireBanner ? (
        <div className="flex items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
          <div className="flex-1">
            <div className="font-semibold text-primary">Iniciando primera ronda…</div>
            <div className="text-muted-foreground" style={{ fontSize: "0.65rem" }}>
              El AI está leyendo tu feedback, los archivos adjuntos y los datos técnicos.
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

      <FallbackToast fallback={stream.state.providerFallback} />

      {isComplete && sess?.completion_reason ? (
        <p
          className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100"
          style={{ fontSize: "0.7rem" }}
        >
          <strong className="font-semibold">Why ready: </strong>
          {sess.completion_reason}
        </p>
      ) : null}

      {/* v0.6.0 — three-zone shell: spec hero / question stack / chat. */}
      <IterFocusShell
        spec={
          <div className="flex h-full min-h-0 flex-col gap-2">
            {/* Auto-iter countdown OR all-resolved strip — sits ABOVE
                the spec hero in the user's reading area, not in the
                chat strip below. */}
            {(versions.data?.length ?? 0) > 0 &&
            !isStreaming &&
            status !== "finalized" &&
            status !== "abandoned" ? (
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
              ) : openAssumptions.length === 0 ? (
                <div
                  className="rounded-md border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100"
                  style={{ fontSize: "0.75rem" }}
                >
                  <span aria-hidden="true" className="mr-1.5">
                    ✅
                  </span>
                  <strong className="font-semibold">Todo respondido</strong> — listo para iterar de
                  nuevo o marcar como listo.
                </div>
              ) : null
            ) : null}

            {/* The spec — protagonist. 75ch max-width centered. */}
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
        questions={
          <QuestionStackPanel
            assumptions={visibleAssumptions}
            onResolve={(assumptionId, body) => resolveMutation.mutateAsync({ assumptionId, body })}
            onSkip={(a) => handleSkip(a)}
            disabled={status === "finalized" || status === "abandoned"}
            emptyMessage={
              (versions.data?.length ?? 0) === 0
                ? "Las preguntas aparecerán cuando el AI termine de leer tu feedback."
                : "El AI no devolvió preguntas en esta ronda. Edita el spec o usa el chat para pedir cambios."
            }
          />
        }
        chat={
          status === "finalized" && pkgQuery.data?.presigned_zip_url ? (
            <div
              className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 space-y-2 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100"
              style={{ fontSize: "0.75rem" }}
            >
              <p className="font-semibold">Spec finalized — your package is ready.</p>
              <a
                href={pkgQuery.data.presigned_zip_url}
                download
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                style={{ fontSize: "0.7rem" }}
              >
                ⬇ Download package ZIP
              </a>
              <p className="text-emerald-800/80" style={{ fontSize: "0.625rem" }}>
                You can also re-download anytime from the ticket card after returning to the feed.
              </p>
            </div>
          ) : status === "abandoned" ? null : (
            <ChatStrip
              streaming={isStreaming}
              turnBudgetSpent={turnBudgetSpent}
              isComplete={isComplete}
              openCount={openAssumptions.length}
              banner={
                streamBudgetExhausted
                  ? "Has usado todas las rondas para este spec. Marca como listo o abandona la sesión."
                  : stream.state.errorMessage && stream.state.status === "error"
                    ? stream.state.errorMessage
                    : null
              }
              onRunIteration={(message) =>
                stream.start({ user_message: message, restructure_allowed: false })
              }
              onMarkReady={onMarkReady}
              onAbandon={() => abandonMutation.mutateAsync()}
            />
          )
        }
      />
    </div>
  );
}
