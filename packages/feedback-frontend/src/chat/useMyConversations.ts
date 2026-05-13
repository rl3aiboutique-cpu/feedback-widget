/**
 * Hook that backs the collapsible "Conversaciones previas" header (S3C).
 *
 * Fans out to two backend endpoints in parallel and folds the results
 * into one unified ``PreviousConversationItem[]`` list:
 *
 * * ``GET /chat/sessions/in-progress`` — chat sessions the user can
 *   resume mid-conversation (D-014, live since S1).
 * * ``GET /feedback/mine``             — tickets the user already filed.
 *
 * The merged list is sorted newest-first by ``updated_at`` so the
 * resume-cue (most recent in_progress) and the unread-badge cue land
 * at the top of the header where ``FeedbackChatSheet`` looks for them.
 *
 * v1.0.0 SIMPLIFICATION: ``unread_admin_replies`` is a placeholder —
 * we set it to ``1`` when ``status === "in_progress"`` (rough proxy
 * for "the admin is working on it") and ``0`` otherwise. S3E replaces
 * this with a real per-feedback comment-count lookup.
 */

import { useCallback, useEffect, useState } from "react";

import { useFeedbackBindings } from "../FeedbackProvider";
import type { FeedbackHostBindings } from "../adapter";
import type { FeedbackRead } from "../client/types";
import type { PreviousConversationItem } from "./types";

export interface UseMyConversationsResult {
  items: PreviousConversationItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Backend shape returned by ``GET /chat/sessions/in-progress``. Mirrors
 * the Pydantic ``InProgressSessionItem`` in ``chat_schemas.py``. */
interface InProgressSessionApi {
  session_id: string;
  last_message_preview: string | null;
  updated_at: string;
  mode: string;
}

interface InProgressListApi {
  sessions: InProgressSessionApi[];
}

function _base(b: FeedbackHostBindings): string {
  return b.apiBaseUrl.replace(/\/$/, "");
}

function _prefix(b: FeedbackHostBindings): string {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}

async function _authHeaders(b: FeedbackHostBindings): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const csrf = await b.getCsrfToken();
    if (csrf) out["X-CSRF-Token"] = csrf;
  } catch {
    /* degrade — host's broken CSRF should not break the header fetch */
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader();
      if (auth) out.Authorization = auth;
    } catch {
      /* same */
    }
  }
  return out;
}

async function _getJson<T>(b: FeedbackHostBindings, path: string): Promise<T> {
  const url = `${_base(b)}${_prefix(b)}${path}`;
  const headers = await _authHeaders(b);
  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers,
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`GET ${path} failed (${resp.status}): ${detail || resp.statusText}`);
  }
  return (await resp.json()) as T;
}

function _mapInProgress(s: InProgressSessionApi): PreviousConversationItem {
  return {
    kind: "in_progress",
    session_id: s.session_id,
    title: s.last_message_preview?.trim() || "Conversación en curso",
    status: "in_progress",
    updated_at: s.updated_at,
    // In-progress chats have no admin comments yet — the unread cue
    // only applies to submitted tickets.
    unread_admin_replies: 0,
  };
}

function _mapSubmitted(f: FeedbackRead): PreviousConversationItem {
  // v1.0.0 placeholder per task brief — S3E will replace with a real
  // per-feedback comment-count + last-seen-ts comparison.
  const unread = f.status === "in_progress" ? 1 : 0;
  return {
    kind: "submitted",
    feedback_id: f.id,
    ticket_code: f.ticket_code,
    title: f.title,
    status: f.status,
    updated_at: f.updated_at ?? f.created_at ?? new Date(0).toISOString(),
    unread_admin_replies: unread,
  };
}

export function useMyConversations(): UseMyConversationsResult {
  const bindings = useFeedbackBindings();
  const [items, setItems] = useState<PreviousConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Promise.all so both fetches happen in parallel. One side's
      // failure does NOT take down the other — we degrade to a partial
      // list instead so a transient /mine 5xx still surfaces the user's
      // active chat session.
      const [inProgressRes, submittedRes] = await Promise.allSettled([
        _getJson<InProgressListApi>(bindings, "/chat/sessions/in-progress"),
        _getJson<FeedbackRead[]>(bindings, "/mine?limit=25"),
      ]);

      const merged: PreviousConversationItem[] = [];

      if (inProgressRes.status === "fulfilled") {
        for (const s of inProgressRes.value.sessions) {
          merged.push(_mapInProgress(s));
        }
      } else if (typeof console !== "undefined") {
        console.warn("[feedback-chat] in-progress fetch failed", inProgressRes.reason);
      }

      if (submittedRes.status === "fulfilled") {
        for (const f of submittedRes.value) {
          merged.push(_mapSubmitted(f));
        }
      } else if (typeof console !== "undefined") {
        console.warn("[feedback-chat] /mine fetch failed", submittedRes.reason);
      }

      // Newest first — both ISO timestamps, lexicographic compare is safe.
      merged.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

      setItems(merged);

      // Only surface an error to the UI when BOTH sides failed, so a
      // partial list still renders.
      if (inProgressRes.status === "rejected" && submittedRes.status === "rejected") {
        setError(String((inProgressRes.reason as Error)?.message ?? "fetch failed"));
      }
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setIsLoading(false);
    }
  }, [bindings]);

  // Fetch once on mount. The hook is mounted by the chat sheet which
  // only renders when `open=true`, so this naturally re-fetches every
  // time the user opens the sheet — no further refetch loop needed
  // for v1.0.0.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { items, isLoading, error, refetch };
}
