/**
 * Iter focus view — v0.7 Copilot Chat redesign.
 *
 * Two zones:
 *
 *   - SPEC (left, ~65%)   — Radix Tabs over Personas / User
 *                          Stories / Spec / Diagrama. Auto-follow
 *                          during stream + highlight-glow on new
 *                          version. Per-tab edit.
 *   - COPILOT (right, ~35%) — chronological chat timeline of session
 *                            events (versions, AI questions inline,
 *                            user messages). Free-text input
 *                            auto-fires the next iter.
 *
 * Header: ← Volver, ticket code, title, [Mark ready] [Abandon],
 * round + active model chips, ⚙ Contexto button.
 *
 * The downstream objective is unchanged from v0.6: every artifact
 * persists in chronological order so Claude Code consumes the full
 * ledger when implementing the ticket. The chat timeline IS the
 * ledger, surfaced as a UI.
 *
 * See `docs/specs/2026-05-08-copilot-chat-redesign.md`.
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
import { ContextDialog } from "./ContextDialog";
import { CopilotChatPanel } from "./CopilotChatPanel";
import { FallbackToast } from "./FallbackToast";
import { IterFocusShell } from "./IterFocusShell";
import { SpecTabsPanel } from "./SpecTabsPanel";
import { containsForbidden, defaultForbiddenWords } from "./forbiddenWords";
import { SPEC_SECTION_ORDER, type SpecSectionKey } from "./specSectionState";
import { useChatTimeline } from "./useChatTimeline";
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

  // Refresh the persisted lists as soon as a stream completes.
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId) {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  }, [stream.state.status, stream.state.versionId, qc, sessionId]);

  // Auto-fire the FIRST iteration (round 1, virgin session).
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
  const showAutoFireBanner =
    autoFiredRef.current && stream.state.status === "running" && (versions.data?.length ?? 0) === 0;
  const cancelAutoFire = () => {
    autoFireUserCancelledRef.current = true;
    stream.reset();
    abandonMutation.mutate();
    onExitRef.current();
  };

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

  // Defense-in-depth: hide assumptions whose text matches a forbidden
  // word the scrubber missed.
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
  const latestMarkdown = latestVersion?.output_markdown ?? "";

  const handleSkip = (a: IterAssumptionRead) =>
    resolveMutation.mutateAsync({
      assumptionId: a.id,
      body: { status: "irrelevant", user_response: SKIP_MARKER },
    });

  const onMarkReady = () => finalizeMutation.mutateAsync();

  const meta = useMemo(() => deriveIterRunMeta(stream.state, sess), [stream.state, sess]);

  // Auto-iter countdown when 0 open + has version (post-iter).
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

  // Chat timeline derivation — a single chronological list of
  // bubbles for the Copilot panel.
  const timelineEvents = useChatTimeline(versions.data, visibleAssumptions);

  // Active stream section, narrowed to SpecSectionKey for the tabs
  // panel. Old sessions might still report "assumptions" — guard
  // against it.
  const activeStreamSection = useMemo<SpecSectionKey | null>(() => {
    const s = stream.state.activeSection;
    if (!s) return null;
    return (SPEC_SECTION_ORDER as readonly string[]).includes(s) ? (s as SpecSectionKey) : null;
  }, [stream.state.activeSection]);

  const sessionDisabled = status === "finalized" || status === "abandoned";
  const showReadyPrompt =
    !isComplete &&
    !sessionDisabled &&
    openAssumptions.length === 0 &&
    (versions.data?.length ?? 0) > 0 &&
    !isStreaming &&
    autoIterCountdown === null;

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-2" data-feedback-id="iter.focus-view">
      {/* Header — slim. Mark ready / Abandon always reachable. */}
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
          style={{ fontSize: "clamp(0.85rem, 0.78rem + 0.3cqi, 1.05rem)" }}
        >
          {feedback?.title ?? "Iter session"}
        </span>
        <span
          className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground"
          style={{ fontSize: "0.65rem" }}
        >
          {maxTurns > 0 ? (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono uppercase tracking-wide">
              R {Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns)}/{maxTurns}
            </span>
          ) : null}
          {meta.active ? (
            <span
              className="hidden truncate font-mono @[60ch]/focus:inline"
              title={`Modelo activo: ${meta.active}`}
              style={{ maxWidth: "10ch" }}
            >
              <span aria-hidden="true">⚡</span> {meta.active}
            </span>
          ) : null}
        </span>
        {isComplete ? (
          <Badge
            className="shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 uppercase tracking-wide"
            style={{ fontSize: "0.6rem" }}
          >
            Spec ready
          </Badge>
        ) : null}
        {!sessionDisabled ? (
          <>
            <Button
              size="sm"
              onClick={() => onMarkReady()}
              disabled={
                !sess?.current_iteration_id ||
                finalizeMutation.isPending ||
                isStreaming ||
                openAssumptions.length > 0
              }
              className="h-7 px-2"
              style={{ fontSize: "0.7rem" }}
              title={
                openAssumptions.length > 0
                  ? "Resuelve las preguntas pendientes antes de marcar como listo."
                  : "Finalizar el spec y producir el paquete dev-ready."
              }
            >
              Mark ready
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => abandonMutation.mutateAsync()}
              disabled={abandonMutation.isPending || isStreaming}
              className="h-7 px-2 text-muted-foreground"
              style={{ fontSize: "0.7rem" }}
              title="Descartar esta sesión iter permanentemente."
            >
              Abandon
            </Button>
          </>
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

      {session.error ? (
        <div
          className="rounded border border-destructive/60 bg-destructive/10 p-2 text-destructive"
          style={{ fontSize: "0.7rem" }}
        >
          <strong className="font-semibold">Couldn't load this session.</strong>{" "}
          {String((session.error as { message?: string }).message ?? session.error)}
        </div>
      ) : null}

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

      {streamBudgetExhausted || (stream.state.errorMessage && stream.state.status === "error") ? (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100"
          style={{ fontSize: "0.7rem" }}
        >
          {streamBudgetExhausted
            ? "Has usado todas las rondas para este spec. Marca como listo o abandona la sesión."
            : stream.state.errorMessage}
        </div>
      ) : null}

      {status === "finalized" && pkgQuery.data?.presigned_zip_url ? (
        <div
          className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100"
          style={{ fontSize: "0.75rem" }}
        >
          <p className="mb-2 font-semibold">Spec finalized — your package is ready.</p>
          <a
            href={pkgQuery.data.presigned_zip_url}
            download
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
            style={{ fontSize: "0.7rem" }}
          >
            ⬇ Download package ZIP
          </a>
        </div>
      ) : null}

      <IterFocusShell
        spec={
          <SpecTabsPanel
            latestMarkdown={latestMarkdown}
            latestVersionId={latestVersion?.id ?? null}
            streaming={isStreaming}
            sectionStates={isStreaming ? stream.state.sectionStates : undefined}
            activeStreamSection={activeStreamSection}
            editable={!isStreaming && !sessionDisabled && !!latestVersion}
            saving={editMarkdownMutation.isPending}
            onSaveEdit={async (next) => {
              if (!latestVersion) return;
              await editMarkdownMutation.mutateAsync({
                versionId: latestVersion.id,
                markdown: next,
              });
            }}
          />
        }
        chat={
          <CopilotChatPanel
            events={timelineEvents}
            streamStatus={stream.state.status}
            disabled={sessionDisabled}
            showReadyPrompt={showReadyPrompt}
            autoIterCountdown={autoIterCountdown}
            isComplete={isComplete}
            onResolveAssumption={(assumptionId, body) =>
              resolveMutation.mutateAsync({ assumptionId, body })
            }
            onSkipAssumption={(a) => handleSkip(a)}
            onSend={(message) =>
              stream.start({ user_message: message, restructure_allowed: false })
            }
            onCancelAutoIter={cancelAutoIter}
            onMarkReady={onMarkReady}
          />
        }
      />
    </div>
  );
}
