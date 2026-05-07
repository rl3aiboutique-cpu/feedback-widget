/**
 * Hook that drives one streaming `runIteration` call.
 *
 * Returns a small machine-shaped state plus a `start()` function the
 * UI calls when the user presses "Run iteration". Internal state
 * accumulates the streaming markdown and active section so the
 * working-document panel can render progressively.
 */

import { useCallback, useRef, useState } from "react";

import type { FeedbackHostBindings } from "../adapter";
import { type IterApiError, newIdempotencyKey, runIterationStream } from "../client/iter";
import type { IterRunRequest, IterStreamEvent } from "../client/types";
import {
  SPEC_SECTION_ORDER,
  type SpecSectionKey,
  type SpecSectionStates,
  _INITIAL_SECTION_STATES,
} from "./specSectionState";

export type IterStreamStatus = "idle" | "running" | "done" | "error";

export interface IterStreamState {
  status: IterStreamStatus;
  partialMarkdown: string;
  activeSection: null | "personas" | "user_stories" | "spec" | "diagram" | "assumptions";
  versionId: string | null;
  versionNumber: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** v0.4.6 — set when the backend swaps models mid-run. Contains
   * the most recent fallback so the UI banner can render context.
   * Cleared on `reset()` / next `start()`. */
  providerFallback: { fromModel: string; toModel: string; reason: string } | null;
  /** v0.5 (Block B) — per-section state derived from the SSE
   * `section` + `token` events. Lets the UI render the spec as
   * five cards transitioning pending → streaming → done without
   * the parent doing client-side splitting. */
  sectionStates: SpecSectionStates;
  /** v0.5 (Block C) — single source of truth for the model
   * currently serving the run. Set by `provider_active` SSE
   * events; the rail badge renders this directly. Null until the
   * first event arrives — callers fall back to the session's
   * `current_primary_model_id` for the cold-start window. */
  activeModel: string | null;
  /** v0.5 (Block C) — wall-clock timestamp (ms) when the user
   * pressed Run / auto-fire kicked in. Drives the elapsed timer
   * and the "Generated in Xs" stamp on done. */
  startedAt: number | null;
  /** v0.5 (Block C) — wall-clock timestamp (ms) when the stream
   * reached `done` or `error`. Frozen for the rest of the
   * session lifetime so the timer pill stops counting. */
  completedAt: number | null;
}

const _INIT: IterStreamState = {
  status: "idle",
  partialMarkdown: "",
  activeSection: null,
  versionId: null,
  versionNumber: null,
  errorCode: null,
  errorMessage: null,
  providerFallback: null,
  sectionStates: _INITIAL_SECTION_STATES,
  activeModel: null,
  startedAt: null,
  completedAt: null,
};

export function useIterRunStream(
  bindings: FeedbackHostBindings,
  sessionId: string,
): {
  state: IterStreamState;
  start: (body: IterRunRequest) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<IterStreamState>(_INIT);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(_INIT);
  }, []);

  const start = useCallback(
    async (body: IterRunRequest) => {
      reset();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ ..._INIT, status: "running", startedAt: Date.now() });
      try {
        await runIterationStream({
          bindings,
          sessionId,
          body,
          idempotencyKey: newIdempotencyKey(),
          signal: ctrl.signal,
          onEvent: (ev: IterStreamEvent) => {
            setState((cur) => _reduce(cur, ev));
          },
        });
        setState((cur) =>
          cur.status === "running" ? { ...cur, status: "done", completedAt: Date.now() } : cur,
        );
      } catch (err) {
        const apiErr = err as IterApiError;
        setState((cur) => ({
          ...cur,
          status: "error",
          errorCode: String(apiErr?.status ?? "network"),
          errorMessage: String(apiErr?.detail ?? apiErr?.message ?? err),
          completedAt: Date.now(),
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [bindings, sessionId, reset],
  );

  return { state, start, reset };
}

function _reduce(cur: IterStreamState, ev: IterStreamEvent): IterStreamState {
  switch (ev.type) {
    case "token": {
      // v0.5 (Block B / B-fix) — append the chunk to both the
      // cumulative markdown buffer (used by the editor / past
      // renderer) AND to the active section's bucket so the
      // SpecSectionCard renders its body progressively. If no
      // section event has fired yet (e.g. preamble bytes before
      // the first `# Personas`), the chunk lands only in
      // `partialMarkdown` and is invisible to the section cards
      // until the first heading boundary.
      // v0.5.1: guard the `cur.activeSection` lookup — Assumptions
      // is no longer in SPEC_SECTION_ORDER, but historical SSE
      // streams may still set `activeSection` to "assumptions".
      const next: IterStreamState = {
        ...cur,
        partialMarkdown: cur.partialMarkdown + ev.chunk,
      };
      const active = cur.activeSection;
      if (active && (SPEC_SECTION_ORDER as readonly string[]).includes(active)) {
        const key = active as SpecSectionKey;
        const prevEntry = cur.sectionStates[key];
        next.sectionStates = {
          ...cur.sectionStates,
          [key]: {
            status: "streaming",
            markdown: prevEntry.markdown + ev.chunk,
          },
        };
      }
      return next;
    }
    case "section": {
      // Flip the previously-active section to `done`, the new one to
      // `streaming`. Sections that never streamed stay `pending`
      // until a later `section`/`done` event reaches them.
      // v0.5.1: Assumptions is no longer a tracked section (prompt
      // emits assumptions as JSON, not MD). If the backend or an
      // older session sends `section: "assumptions"`, ignore it.
      if (!(SPEC_SECTION_ORDER as readonly string[]).includes(ev.section)) {
        return cur;
      }
      const incoming = ev.section as SpecSectionKey;
      const nextStates: SpecSectionStates = { ...cur.sectionStates };
      if (
        cur.activeSection &&
        (SPEC_SECTION_ORDER as readonly string[]).includes(cur.activeSection)
      ) {
        const prev = cur.activeSection as SpecSectionKey;
        nextStates[prev] = {
          status: "done",
          markdown: cur.sectionStates[prev].markdown,
        };
      }
      nextStates[incoming] = {
        status: "streaming",
        markdown: cur.sectionStates[incoming].markdown,
      };
      return { ...cur, activeSection: incoming, sectionStates: nextStates };
    }
    case "done": {
      // Flip every section to `done`. Any section that never streamed
      // ends as a `done` empty card (prompt rarely skips one but if
      // it does we don't want a permanent skeleton hanging there).
      const nextStates: SpecSectionStates = { ...cur.sectionStates };
      for (const key of SPEC_SECTION_ORDER) {
        const e = cur.sectionStates[key];
        nextStates[key] = { status: "done", markdown: e.markdown };
      }
      return {
        ...cur,
        status: "done",
        versionId: ev.version_id,
        versionNumber: ev.version_number,
        sectionStates: nextStates,
        completedAt: cur.completedAt ?? Date.now(),
      };
    }
    case "error":
      return {
        ...cur,
        status: "error",
        errorCode: ev.error_code,
        errorMessage: ev.message,
      };
    case "heartbeat":
      return cur;
    case "provider_fallback":
      return {
        ...cur,
        providerFallback: {
          fromModel: ev.from_model,
          toModel: ev.to_model,
          reason: ev.reason,
        },
      };
    case "provider_active":
      return { ...cur, activeModel: ev.model };
    default:
      return cur;
  }
}
