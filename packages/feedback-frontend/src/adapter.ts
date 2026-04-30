/**
 * Adapter — the seam between the widget and the host application.
 *
 * The host provides a small set of `bindings` (see `FeedbackHostBindings`)
 * via the `<FeedbackProvider bindings={...}>` mount. Internally we
 * combine those bindings with widget-owned defaults (translator,
 * redactor list, build provenance) into a `FeedbackAdapter` that the
 * widget components read through `useFeedbackAdapter()`.
 *
 * No `@/*` imports here — the host plugs in via the bindings prop.
 */

import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";

import { useFeedbackBindings, useFeedbackConfig } from "./FeedbackProvider";
import type {
  FeedbackListResponse,
  FeedbackRead,
  FeedbackStatus,
  FeedbackStatusUpdate,
  FeedbackType,
} from "./client";
import { createTranslator } from "./locales";
import { DEFAULT_REDACTION_SELECTORS, registerRedactor } from "./redactors";
import type { CurrentUserSnapshot, FeedbackReadShape, ToastApi, Translator } from "./types";

const _DEFAULT_TOAST: ToastApi = {
  success: (msg) => {
    if (typeof window !== "undefined") console.log("[feedback]", msg);
  },
  error: (msg) => {
    if (typeof window !== "undefined") console.error("[feedback]", msg);
  },
  info: (msg) => {
    if (typeof window !== "undefined") console.info("[feedback]", msg);
  },
  warning: (msg) => {
    if (typeof window !== "undefined") console.warn("[feedback]", msg);
  },
};

declare const __APP_VERSION__: string | undefined;
declare const __GIT_COMMIT_SHA__: string | undefined;

const ENV_APP_VERSION =
  import.meta.env.VITE_APP_VERSION ||
  (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "") ||
  "0.0.0-dev";
const ENV_GIT_SHA =
  import.meta.env.VITE_GIT_COMMIT_SHA ||
  (typeof __GIT_COMMIT_SHA__ !== "undefined" ? __GIT_COMMIT_SHA__ : "") ||
  "unknown";

// ─────────────────────────────────────────────────────────────────────
// Host bindings — the host implements these
// ─────────────────────────────────────────────────────────────────────

export interface FeedbackHostBindings {
  /** Hook returning the currently signed-in user, or null when absent. */
  useCurrentUser: () => CurrentUserSnapshot | null;

  /**
   * Returns the CSRF token to attach as `X-CSRF-Token`.
   *
   * Hosts that don't use CSRF (Bearer-only) should return an empty
   * string; the package-side router gates CSRF behind
   * `FEEDBACK_CSRF_REQUIRED`.
   */
  getCsrfToken: () => Promise<string>;

  /**
   * Optional. Returns the value to attach as `Authorization` header
   * (e.g. `"Bearer <token>"`). Hosts using cookie-based auth (with
   * `credentials: "include"`) leave this undefined; hosts that store
   * the token in localStorage / memory provide a callback. Returning
   * an empty string skips the header.
   */
  authHeader?: () => Promise<string>;

  /**
   * Optional CSV/list of roles permitted to triage feedback. The widget
   * exposes a `useCanTriageFeedback()` hook that reads this and gates
   * admin-only UI. When unset, the hook compares
   * `useCurrentUser().role` against `"MASTER_ADMIN"` case-insensitively.
   * Hosts with multiple admin-shaped roles set this from a build-time
   * env var (e.g. `VITE_FEEDBACK_TRIAGE_ROLES`).
   */
  triageRoles?: readonly string[];

  /** Backend root URL — the SDK appends `/api/v1/feedback` to this. */
  apiBaseUrl: string;

  /** Optional: override the API path prefix (default: `/api/v1/feedback`). */
  apiPathPrefix?: string;

  /**
   * Optional override of the deep-link base for the admin button in
   * notification emails. Defaults to `window.location.origin`.
   */
  getDeepLinkBase?: () => string;

  /** Optional: register additional redaction selectors at mount time. */
  extraRedactionSelectors?: readonly string[];

  /** Optional: locale override (defaults to "en"). */
  locale?: "en";

  /**
   * Optional toast notifier. When omitted the widget falls back to a
   * console-only stub. Hosts running ``sonner`` /
   * ``react-hot-toast`` / etc. pass their own to surface widget
   * messages in the host's notification UI.
   */
  toast?: ToastApi;
}

// ─────────────────────────────────────────────────────────────────────
// Submit / download helpers (raw fetch — binary bodies bypass any SDK)
// ─────────────────────────────────────────────────────────────────────

export class SubmitFeedbackError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly retryAfter: string | null,
  ) {
    super(`POST /feedback failed with ${status}`);
    this.name = "SubmitFeedbackError";
  }
}

function _resolvePrefix(b: FeedbackHostBindings): string {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}

function _resolveBase(b: FeedbackHostBindings): string {
  return b.apiBaseUrl.replace(/\/$/, "");
}

/** Build the auth-aware headers for a request. CSRF + optional bearer.
 * Both binding callbacks are wrapped in try/catch so a host's broken
 * implementation degrades to "request without that header" rather than
 * an unhandled rejection that nukes React Query state. */
async function _buildHeaders(
  bindings: FeedbackHostBindings,
  base: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...base };
  try {
    const csrfToken = await bindings.getCsrfToken();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[feedback] getCsrfToken threw, proceeding without CSRF token", err);
    }
  }
  if (bindings.authHeader) {
    try {
      const auth = await bindings.authHeader();
      if (auth) headers.Authorization = auth;
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[feedback] authHeader threw, proceeding without Authorization", err);
      }
    }
  }
  return headers;
}

async function submitFeedback(
  bindings: FeedbackHostBindings,
  payloadJson: string,
  screenshot: Blob | null,
  attachments?: readonly File[],
): Promise<FeedbackReadShape> {
  const form = new FormData();
  form.append("payload", payloadJson);
  if (screenshot) {
    form.append("screenshot", screenshot, "screenshot.png");
  }
  if (attachments && attachments.length > 0) {
    for (const file of attachments) {
      form.append("attachments", file, file.name);
    }
  }
  const headers = await _buildHeaders(bindings);
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  if (!resp.ok) {
    let detail: unknown;
    try {
      detail = await resp.json();
    } catch {
      detail = await resp.text().catch(() => "");
    }
    throw new SubmitFeedbackError(
      resp.status,
      typeof detail === "string" ? detail : JSON.stringify(detail),
      resp.headers.get("Retry-After"),
    );
  }
  return (await resp.json()) as FeedbackReadShape;
}

/** Re-exported as a named binding so the admin triage page can import it directly. */
export async function downloadFeedbackBundleViaBindings(
  bindings: FeedbackHostBindings,
  feedbackId: string,
): Promise<{ blob: Blob; filename: string }> {
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/${encodeURIComponent(
    feedbackId,
  )}/download`;
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GET /feedback/${feedbackId}/download failed (${resp.status}) ${text}`);
  }
  const cd = resp.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `feedback-${feedbackId}.zip`;
  return { blob: await resp.blob(), filename };
}

// ─────────────────────────────────────────────────────────────────────
// JSON helpers for typed list/detail + admin mutations
// ─────────────────────────────────────────────────────────────────────

async function _getJson<T>(
  bindings: FeedbackHostBindings,
  path: string,
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  const url = new URL(`${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GET ${path} failed (${resp.status}) ${text}`);
  }
  return (await resp.json()) as T;
}

async function _patchJson<T>(
  bindings: FeedbackHostBindings,
  path: string,
  body: unknown,
): Promise<T> {
  const headers = await _buildHeaders(bindings, {
    "Content-Type": "application/json",
  });
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`PATCH ${path} failed (${resp.status}) ${text}`);
  }
  return (await resp.json()) as T;
}

async function _deleteJson(bindings: FeedbackHostBindings, path: string): Promise<void> {
  const headers = await _buildHeaders(bindings);
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`DELETE ${path} failed (${resp.status}) ${text}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hooks — components call these via `useFeedbackAdapter()`
// ─────────────────────────────────────────────────────────────────────

export function useCurrentUser(): CurrentUserSnapshot | null {
  const bindings = useFeedbackBindings();
  return bindings.useCurrentUser();
}

export function getDeepLinkToFeedback(id: string, base?: string): string {
  if (base) return `${base.replace(/\/$/, "")}/admin/feedback?id=${id}`;
  if (typeof window === "undefined") return `/admin/feedback?id=${id}`;
  return `${window.location.origin}/admin/feedback?id=${id}`;
}

export function getDefaultRedactionSelectors(): readonly string[] {
  return DEFAULT_REDACTION_SELECTORS;
}

export { registerRedactor };

export function useTranslation(): Translator {
  const config = useFeedbackConfig();
  return useMemo(() => createTranslator({ locale: config.locale }), [config.locale]);
}

export const APP_VERSION = ENV_APP_VERSION;
export const GIT_COMMIT_SHA = ENV_GIT_SHA;

// ─────────────────────────────────────────────────────────────────────
// Admin hooks (used by the triage page inside the widget)
// ─────────────────────────────────────────────────────────────────────

export interface FeedbackListFilters {
  type?: FeedbackType | null;
  status?: FeedbackStatus | null;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function useFeedbackListQuery(
  filters: FeedbackListFilters,
): UseQueryResult<FeedbackListResponse, Error> {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "list", filters],
    queryFn: () =>
      _getJson<FeedbackListResponse>(bindings, "", {
        type: filters.type ?? undefined,
        status: filters.status ?? undefined,
        q: filters.q?.trim() || undefined,
        page: filters.page ?? 1,
        page_size: filters.pageSize ?? 50,
      }),
  });
}

export function useMyFeedbackQuery(limit = 25): UseQueryResult<FeedbackRead[], Error> {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "mine", limit],
    queryFn: () => _getJson<FeedbackRead[]>(bindings, "/mine", { limit }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useFeedbackDetailQuery(
  feedbackId: string | null,
): UseQueryResult<FeedbackRead, Error> {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "detail", feedbackId],
    queryFn: () =>
      feedbackId
        ? _getJson<FeedbackRead>(bindings, `/${encodeURIComponent(feedbackId)}`)
        : (Promise.resolve(null) as unknown as Promise<FeedbackRead>),
    enabled: !!feedbackId,
  });
}

export function useUpdateFeedbackStatusMutation(): UseMutationResult<
  FeedbackRead,
  Error,
  { id: string; status: FeedbackStatus; triage_note?: string }
> {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      _patchJson<FeedbackRead>(bindings, `/${encodeURIComponent(input.id)}/status`, {
        status: input.status,
        triage_note: input.triage_note ?? null,
      } satisfies FeedbackStatusUpdate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
}

export function useDeleteFeedbackMutation(): UseMutationResult<void, Error, string> {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => _deleteJson(bindings, `/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Adapter shape — the bag the FeedbackProvider injects into context
// ─────────────────────────────────────────────────────────────────────

export interface FeedbackAdapter {
  useCurrentUser: typeof useCurrentUser;
  appVersion: string;
  gitSha: string;
  /** Caller passes payloadJson + optional screenshot + up to 5 user
   * attachments; we attach CSRF + cookies. */
  submitFeedback: (
    payloadJson: string,
    screenshot: Blob | null,
    attachments?: readonly File[],
  ) => Promise<FeedbackReadShape>;
  downloadFeedbackBundle: (feedbackId: string) => Promise<{ blob: Blob; filename: string }>;
  getDeepLinkToFeedback: (id: string) => string;
  getDefaultRedactionSelectors: typeof getDefaultRedactionSelectors;
  registerRedactor: typeof registerRedactor;
  useTranslation: typeof useTranslation;
  /** Toast notifier — host-injected via bindings or console-only fallback. */
  toast: ToastApi;
}

export function createAdapter(bindings: FeedbackHostBindings): FeedbackAdapter {
  const adapter: FeedbackAdapter = {
    useCurrentUser,
    appVersion: APP_VERSION,
    gitSha: GIT_COMMIT_SHA,
    submitFeedback: (payloadJson: string, screenshot: Blob | null, attachments?: readonly File[]) =>
      submitFeedback(bindings, payloadJson, screenshot, attachments),
    downloadFeedbackBundle: (feedbackId: string) =>
      downloadFeedbackBundleViaBindings(bindings, feedbackId),
    getDeepLinkToFeedback: (id: string) => getDeepLinkToFeedback(id, bindings.getDeepLinkBase?.()),
    getDefaultRedactionSelectors,
    registerRedactor,
    useTranslation,
    toast: bindings.toast ?? _DEFAULT_TOAST,
  };
  return Object.freeze(adapter);
}
