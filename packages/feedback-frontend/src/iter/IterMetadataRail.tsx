/**
 * Right rail of the iter focus view — run-metadata only.
 *
 * v0.5.2 redesign — the rail is now slim (~16% of the focus pane),
 * so the contents need a tight visual hierarchy:
 *
 *   1. Active model — primary line (larger, bold-ish, with the ⚡).
 *   2. Round + elapsed time — secondary line (small, muted).
 *   3. Latency / status hint — tertiary line (smallest, muted).
 *   4. Contexto original — collapsible disclosure below.
 *
 * Earlier the rail was 22% wide but rendered as a single low-density
 * flex strip; user feedback was that the column "looked empty" and
 * competed with the spec hero. Reducing rail width AND tightening
 * the typography hierarchy together makes the column feel
 * intentionally compact instead of underused.
 *
 * Implementation note — v0.5.2: the rail now takes the metadata
 * directly as `meta` and `errorMessage` instead of pre-rendered
 * slots. The slots abstraction was carrying its weight when Block C
 * had unknowns; now the rail's content is fixed, so direct props
 * read cleaner and let the rail own its own layout. `toastLandingSlot`
 * stays as a slot because the toast portal needs to be mounted by
 * the parent for z-stacking with the Sheet host.
 */

import { Loader2 } from "lucide-react";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";

import type { FeedbackRead } from "../client";
import { IterContextPanel } from "./IterContextPanel";
import { modelLatencyHint } from "./markdownView";
import type { IterRunMeta } from "./useIterRunMeta";

export interface IterMetadataRailProps {
  feedback: FeedbackRead | null | undefined;
  contextDefaultOpen: boolean;
  contextStreaming: boolean;
  roundCurrent: number | null;
  roundMax: number | null;
  meta: IterRunMeta;
  errorMessage: string | null;
  toastLandingSlot?: ReactNode;
}

export function IterMetadataRail({
  feedback,
  contextDefaultOpen,
  contextStreaming,
  roundCurrent,
  roundMax,
  meta,
  errorMessage,
  toastLandingSlot,
}: IterMetadataRailProps): ReactElement {
  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-2 overflow-auto"
      aria-label="Metadatos de la iteración"
    >
      <div className="rounded-md border border-input bg-card p-2.5">
        {/* Primary — model id. v0.5.2: prominent, ⚡ icon, breaks
            on long names. The amber tint when fellBack signals the
            chain walked, replacing the previous chip-style render. */}
        <_PrimaryModelLine meta={meta} />

        {/* Secondary — round indicator + elapsed time. Small,
            muted, single line where possible. */}
        <_SecondaryStatusLine meta={meta} roundCurrent={roundCurrent} roundMax={roundMax} />

        {/* Tertiary — latency hint while generating, "Listo." when
            done, friendly error otherwise. */}
        <_HintLine meta={meta} errorMessage={errorMessage} />
      </div>

      {/* Toast landing zone — FallbackToast still portals to body for
          correct z-stacking with the Sheet host. */}
      {toastLandingSlot ? <div>{toastLandingSlot}</div> : null}

      {/* Original-feedback collapsible. Stays collapsed by default
          when the rail is narrow (v0.5.2 Option A). */}
      <IterContextPanel
        feedback={feedback}
        defaultOpen={contextDefaultOpen}
        streaming={contextStreaming}
      />
    </aside>
  );
}

function _PrimaryModelLine({ meta }: { meta: IterRunMeta }): ReactElement {
  const fellBack = meta.fallbackReason !== null;
  const display = meta.active ?? "—";
  const tooltip = fellBack
    ? `${meta.fallbackReason} — primario configurado: ${meta.requested ?? "—"}`
    : `Modelo activo: ${display}`;
  return (
    <div className="flex items-start gap-1.5" title={tooltip}>
      <span
        aria-hidden="true"
        className={fellBack ? "text-amber-600 dark:text-amber-400" : "text-primary"}
        style={{ fontSize: "0.85rem", lineHeight: "1.1" }}
      >
        ⚡
      </span>
      <code
        className={[
          "break-all font-mono leading-tight",
          fellBack ? "text-amber-900 dark:text-amber-200" : "text-foreground",
        ].join(" ")}
        style={{ fontSize: "0.75rem", lineHeight: "1.2" }}
      >
        {display}
      </code>
    </div>
  );
}

function _SecondaryStatusLine({
  meta,
  roundCurrent,
  roundMax,
}: {
  meta: IterRunMeta;
  roundCurrent: number | null;
  roundMax: number | null;
}): ReactElement | null {
  const showRound = roundCurrent !== null && roundMax !== null && roundMax > 0;
  const elapsedText = _useElapsedText(meta);
  if (!showRound && !elapsedText) return null;
  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground"
      style={{ fontSize: "0.6rem" }}
    >
      {showRound ? (
        <span className="rounded bg-muted px-1 py-0.5 font-mono uppercase tracking-wide">
          Round {roundCurrent}/{roundMax}
        </span>
      ) : null}
      {elapsedText ? <span className="font-mono">{elapsedText}</span> : null}
      {meta.status === "running" ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function _HintLine({
  meta,
  errorMessage,
}: {
  meta: IterRunMeta;
  errorMessage: string | null;
}): ReactElement | null {
  if (meta.status === "idle") return null;
  let copy: ReactNode = null;
  if (meta.status === "running") {
    copy = meta.active ? modelLatencyHint(meta.active) : null;
  } else if (meta.status === "error") {
    copy = (
      <span className="text-amber-700 dark:text-amber-300">
        Stream interrumpido. {errorMessage ?? ""}
      </span>
    );
  } else {
    copy = "Listo.";
  }
  if (!copy) return null;
  return (
    <div className="mt-1 leading-snug text-muted-foreground" style={{ fontSize: "0.6rem" }}>
      {copy}
    </div>
  );
}

/** Elapsed time text. Live during running (recomputed per-frame so
 * no drift), frozen on done/error. Returns null when no run has
 * started yet. */
function _useElapsedText(meta: IterRunMeta): string | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (meta.status !== "running") return;
    let raf = 0;
    const tick = () => {
      force((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meta.status]);
  if (meta.startedAt === null || meta.status === "idle") return null;
  if (meta.status === "running") {
    return _format(Date.now() - meta.startedAt);
  }
  const total = (meta.completedAt ?? Date.now()) - meta.startedAt;
  if (meta.status === "error") return `paró tras ${_format(total)}`;
  return _format(total);
}

function _format(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}
