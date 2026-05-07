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
      setState({ ..._INIT, status: "running" });
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
        setState((cur) => (cur.status === "running" ? { ...cur, status: "done" } : cur));
      } catch (err) {
        const apiErr = err as IterApiError;
        setState((cur) => ({
          ...cur,
          status: "error",
          errorCode: String(apiErr?.status ?? "network"),
          errorMessage: String(apiErr?.detail ?? apiErr?.message ?? err),
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
    case "token":
      return { ...cur, partialMarkdown: cur.partialMarkdown + ev.chunk };
    case "section":
      return { ...cur, activeSection: ev.section };
    case "done":
      return {
        ...cur,
        status: "done",
        versionId: ev.version_id,
        versionNumber: ev.version_number,
      };
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
    default:
      return cur;
  }
}
