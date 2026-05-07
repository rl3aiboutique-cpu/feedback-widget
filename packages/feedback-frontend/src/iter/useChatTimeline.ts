/**
 * Pure derivation: turn the persisted iter session state (versions
 * + assumptions) into a chronological list of events the
 * `CopilotChatPanel` renders as chat bubbles.
 *
 * The chat timeline IS the ledger. Every persisted artifact appears
 * as one bubble; nothing is hidden. Live synthetic events (the
 * "Incorporando feedback…" status, the auto-iter countdown, the
 * "¿Marco como listo?" proactive prompt) are NOT emitted from this
 * hook — they're appended client-side per render in the panel
 * itself, since they're recomputed from `useIterRunStream` state
 * and don't survive page reloads.
 *
 * Why no separate resolution event: each assumption row carries
 * `status` + `resolved_at` directly. Emitting one event per
 * `assumption.created_at` and letting the existing `AssumptionCard`
 * render its open vs resolved variant keeps the timeline stable —
 * the user can still re-open a resolved card via the card's own
 * "Change my answer" affordance, and the bubble keeps its position
 * in the timeline (creation order, not resolution order).
 *
 * v0.7.0 — Copilot Chat redesign.
 */

import { useMemo } from "react";

import type { IterAssumptionRead, IterVersionRead } from "../client/types";

export type ChatTimelineEvent =
  | { kind: "version_done"; ts: number; version: IterVersionRead }
  | {
      kind: "user_message";
      ts: number;
      message: string;
      /** The version this message triggered. Used as the bubble's
       * stable React key. */
      versionId: string;
    }
  | { kind: "assumption"; ts: number; assumption: IterAssumptionRead };

export function useChatTimeline(
  versions: IterVersionRead[] | undefined,
  assumptions: IterAssumptionRead[] | undefined,
): ChatTimelineEvent[] {
  return useMemo(() => {
    const out: ChatTimelineEvent[] = [];

    for (const v of versions ?? []) {
      const vts = new Date(v.created_at).getTime();
      // User message precedes the version it triggered chronologically
      // — same DB row, but the user's send happens before the AI
      // produces v(n+1). Place it one tick earlier so the sort puts
      // it before the corresponding version_done event.
      if (v.user_message && v.user_message.trim().length > 0) {
        out.push({
          kind: "user_message",
          ts: vts - 1,
          message: v.user_message,
          versionId: v.id,
        });
      }
      out.push({ kind: "version_done", ts: vts, version: v });
    }

    for (const a of assumptions ?? []) {
      out.push({
        kind: "assumption",
        ts: new Date(a.created_at).getTime(),
        assumption: a,
      });
    }

    out.sort((x, y) => x.ts - y.ts);
    return out;
  }, [versions, assumptions]);
}
