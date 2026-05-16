// src/chat/FeedbackChatSheet.tsx
import { useCallback as useCallback6, useEffect as useEffect10, useState as useState11 } from "react";

// src/FeedbackProvider.tsx
import { createContext, useContext, useMemo as useMemo2 } from "react";

// src/adapter.ts
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { useMemo } from "react";

// src/locales/en.ts
var en = {
  "feedback.open_button": "Send feedback with RL3 Feedback",
  "feedback.open_button_with_pending": "RL3 Feedback \u2014 {count} ticket(s) updated recently",
  "feedback.tab.submit": "Submit feedback",
  "feedback.tab.mine": "My tickets",
  "feedback.mine.loading": "Loading your tickets\u2026",
  "feedback.mine.empty": "You haven't submitted any feedback yet.",
  "feedback.mine.error": "Could not load your tickets. Please retry later.",
  "feedback.mine.action_hint": "We marked this resolved. Reply by email or file fresh feedback if it's still not right.",
  "feedback.mine.submitted_at": "Submitted {date} UTC",
  "feedback.mine.no_description": "(no description)",
  "feedback.mine.triage_note": "Note from the team",
  "feedback.mine.attachments": "Attachments ({count})",
  "feedback.mine.open": "Open",
  "feedback.mine.open_in_app": "Open in app \u2192",
  "feedback.comments.thread_title": "Conversation",
  "feedback.comments.loading": "Loading messages\u2026",
  "feedback.comments.error": "Could not load messages.",
  "feedback.comments.empty": "No messages yet \u2014 be the first to reply.",
  "feedback.comments.placeholder": "Write a reply\u2026",
  "feedback.comments.send": "Send",
  "feedback.comments.sending": "Sending\u2026",
  "feedback.comments.send_error": "Could not send the message. Please retry.",
  "feedback.comments.send_unauthorized": "You don't have permission to post on this ticket. Try refreshing the page.",
  "feedback.comments.admin_label": "Team",
  "feedback.comments.submitter_label": "Submitter",
  "feedback.comments.you_label": "You",
  "feedback.button_label": "Feedback",
  "feedback.panel_title": "RL3 Feedback",
  "feedback.panel_description": "Tell us what's on your mind. We capture page context for triage.",
  "feedback.powered_by": "powered by",
  "feedback.powered_by_aria": "Powered by RL3 AI Agency",
  "feedback.optional": "optional",
  "feedback.mode_label": "Capture",
  "feedback.mode_whole_page": "Whole page",
  "feedback.mode_select_element": "Select element",
  "feedback.mode_select_element_hint": "We'll take you to the page: hover over any element and click to lock it.",
  "feedback.element_locked": "Element locked",
  "feedback.clear_element": "Clear element",
  "feedback.element_selector_active": "Element-selector mode active. Click to lock, ESC to cancel.",
  "feedback.element_selector_hint": "Move the mouse to highlight \xB7 Click to lock \xB7 ESC to cancel",
  "feedback.type_label": "Type",
  "feedback.type_placeholder": "Pick a category\u2026",
  "feedback.type.bug": "Bug",
  "feedback.type.bug_hint": "Something is broken or behaves wrong. Use this when reality doesn't match expectation.",
  "feedback.type.ui": "UI",
  "feedback.type.ui_hint": "Something on screen feels off \u2014 copy, layout, contrast, hierarchy, motion.",
  "feedback.type.performance": "Performance",
  "feedback.type.performance_hint": "Something is technically working but unacceptably slow.",
  "feedback.type.new_feature": "New feature",
  "feedback.type.new_feature_hint": "A capability that doesn't exist yet.",
  "feedback.type.extend_feature": "Extend feature",
  "feedback.type.extend_feature_hint": "Something exists but doesn't go far enough.",
  "feedback.type.other": "Other",
  "feedback.type.other_hint": "Anything that doesn't fit the categories above.",
  "feedback.field.title": "Title",
  "feedback.field.title_hint": "Short, specific summary. Will be the email subject.",
  "feedback.field.title_placeholder": "Short summary\u2026",
  "feedback.field.description": "What's happening?",
  "feedback.field.description_placeholder": "Describe what you're seeing or what's missing. Be concrete.",
  "feedback.field.expected_outcome": "How should it work?",
  "feedback.field.expected_outcome_placeholder": "What you'd expect instead.",
  "feedback.attachments.label": "Attachments",
  "feedback.attachments.hint": "Wireframes, drawings, external logs, notes \u2014 up to 5 files of 10 MB each.",
  "feedback.attachments.dropzone": "Drop files here or click to choose",
  "feedback.attachments.too_many": "Up to {max} files per submission.",
  "feedback.attachments.too_big": "{name} is too large (max {max}).",
  "feedback.attachments.bad_type": "{name} has an unsupported file type. We accept images (PNG/JPG/GIF/WebP), PDFs, plain text, markdown, and JSON.",
  "feedback.attachments.remove": "Remove {name}",
  "feedback.metadata_disclosure": "We capture page URL and basic context (viewport, recent logs) to help triage. Tokens and cookies are redacted automatically.",
  "feedback.cancel": "Cancel",
  "feedback.submit": "Send feedback",
  "feedback.submitting": "Sending\u2026",
  "feedback.submit_disabled_until_form": "Pick a type first",
  "feedback.toast_success": "Feedback sent \xB7 {id}",
  "feedback.toast_success_link": "Open in admin",
  "feedback.toast_error_generic": "Could not send the feedback. Try again.",
  "feedback.toast_error_429": "Too much feedback. Retry in {seconds}s.",
  "feedback.toast_error_required_field": "Required: {field}.",
  "feedback.toast_screenshot_failed": "Could not capture the screen. Sending the feedback without it."
};

// src/locales/index.ts
var _DICTIONARIES = { en };
function createTranslator(_options) {
  return function t(key, vars) {
    let msg = _DICTIONARIES.en?.[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        msg = msg.split(`{${k}}`).join(v);
      }
    }
    return msg;
  };
}

// src/redactors.ts
var _ZERO_WIDTH = "";
var _DEFAULT_PATTERNS = [
  // Authorization: Bearer xxx / Authorization: Basic xxx → keep the header,
  // wipe the value. Multiline-friendly via [^\r\n]+.
  {
    re: /(authorization\s*[:=]\s*)[^\r\n]+/gi,
    replace: (m) => m.replace(/(authorization\s*[:=]\s*)[^\r\n]+/i, "$1[REDACTED]")
  },
  // Bare bearer tokens outside a header context.
  {
    re: /\bbearer\s+[A-Za-z0-9._\-+/=]+/gi,
    replace: () => "[REDACTED]"
  },
  // JWT-shaped triples (three base64url segments separated by dots).
  {
    re: /\b[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g,
    replace: () => "[REDACTED]"
  },
  // CC-like 13–19 digit runs separated by spaces or dashes.
  {
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    replace: () => "[REDACTED]"
  },
  // OAuth-style query string tokens.
  {
    re: /\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+/gi,
    replace: (m) => m.replace(
      /\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+/i,
      "$1=[REDACTED]"
    )
  },
  // Cookie header values.
  {
    re: /(cookie\s*[:=]\s*)[^\r\n]+/gi,
    replace: (m) => m.replace(/(cookie\s*[:=]\s*)[^\r\n]+/i, "$1[REDACTED]")
  }
];
var _hostRedactors = [];
function registerRedactor(fn) {
  _hostRedactors.push(fn);
}
function redactString(value) {
  let out = value;
  for (const { re, replace } of _DEFAULT_PATTERNS) {
    out = out.replace(re, replace);
  }
  for (const fn of _hostRedactors) {
    try {
      out = fn(out);
    } catch {
    }
  }
  return out + _ZERO_WIDTH;
}
var DEFAULT_REDACTION_SELECTORS = Object.freeze([
  'input[type="password"]',
  'input[autocomplete="one-time-code"]',
  '[data-feedback-redact="true"]'
]);

// src/adapter.ts
var _DEFAULT_TOAST = {
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
  }
};
var ENV_APP_VERSION = import.meta.env.VITE_APP_VERSION || (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "") || "0.0.0-dev";
var ENV_GIT_SHA = import.meta.env.VITE_GIT_COMMIT_SHA || (typeof __GIT_COMMIT_SHA__ !== "undefined" ? __GIT_COMMIT_SHA__ : "") || "unknown";
var DEFAULT_API_PATH_PREFIX = "/api/v1/feedback";
var SubmitFeedbackError = class extends Error {
  constructor(status, body, retryAfter) {
    super(`POST /feedback failed with ${status}`);
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
    this.name = "SubmitFeedbackError";
  }
  status;
  body;
  retryAfter;
};
var FeedbackApiError = class extends Error {
  constructor(status, path, detail, retryAfter) {
    super(`${path} failed with ${status}`);
    this.status = status;
    this.path = path;
    this.detail = detail;
    this.retryAfter = retryAfter;
    this.name = "FeedbackApiError";
  }
  status;
  path;
  detail;
  retryAfter;
};
async function _throwApiError(path, resp) {
  let detail;
  try {
    const data = await resp.json();
    detail = typeof data === "string" ? data : data && typeof data === "object" && "detail" in data ? String(data.detail) : JSON.stringify(data);
  } catch {
    detail = await resp.text().catch(() => "");
  }
  throw new FeedbackApiError(resp.status, path, detail, resp.headers.get("Retry-After"));
}
function _resolvePrefix(b) {
  return b.apiPathPrefix ?? DEFAULT_API_PATH_PREFIX;
}
function _resolveBase(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
async function _buildHeaders(bindings, base = {}) {
  const headers = { ...base };
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
async function submitFeedback(bindings, payloadJson, screenshot, attachments) {
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
    body: form
  });
  if (!resp.ok) {
    let detail;
    try {
      detail = await resp.json();
    } catch {
      detail = await resp.text().catch(() => "");
    }
    throw new SubmitFeedbackError(
      resp.status,
      typeof detail === "string" ? detail : JSON.stringify(detail),
      resp.headers.get("Retry-After")
    );
  }
  return await resp.json();
}
async function downloadFeedbackBundleViaBindings(bindings, feedbackId) {
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/${encodeURIComponent(
    feedbackId
  )}/download`;
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers
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
async function downloadOwnFeedbackBundleViaBindings(bindings, feedbackId) {
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/mine/${encodeURIComponent(
    feedbackId
  )}/download`;
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `GET /feedback/mine/${feedbackId}/download failed (${resp.status}) ${text}`
    );
  }
  const cd = resp.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `feedback-${feedbackId}.zip`;
  return { blob: await resp.blob(), filename };
}
async function _getJson(bindings, path, query) {
  const url = new URL(`${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== void 0 && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    await _throwApiError(`GET ${path}`, resp);
  }
  return await resp.json();
}
function useCurrentUser() {
  const bindings = useFeedbackBindings();
  return bindings.useCurrentUser();
}
function getDeepLinkToFeedback(id, base) {
  if (base) return `${base.replace(/\/$/, "")}/admin/feedback?id=${id}`;
  if (typeof window === "undefined") return `/admin/feedback?id=${id}`;
  return `${window.location.origin}/admin/feedback?id=${id}`;
}
function getDefaultRedactionSelectors() {
  return DEFAULT_REDACTION_SELECTORS;
}
function useTranslation() {
  const config = useFeedbackConfig();
  return useMemo(() => createTranslator({ locale: config.locale }), [config.locale]);
}
var APP_VERSION = ENV_APP_VERSION;
var GIT_COMMIT_SHA = ENV_GIT_SHA;
function useFeedbackListQuery(filters) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "list", filters],
    queryFn: () => _getJson(bindings, "", {
      type: filters.type ?? void 0,
      status: filters.status ?? void 0,
      q: filters.q?.trim() || void 0,
      page: filters.page ?? 1,
      page_size: filters.pageSize ?? 50
    })
  });
}
function useMyFeedbackQuery(limit = 25) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "mine", limit],
    queryFn: () => _getJson(bindings, "/mine", { limit }),
    refetchInterval: 6e4,
    staleTime: 3e4
  });
}
function useFeedbackDetailQuery(feedbackId) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "detail", feedbackId],
    queryFn: () => feedbackId ? _getJson(bindings, `/${encodeURIComponent(feedbackId)}`) : Promise.resolve(null),
    enabled: !!feedbackId
  });
}
async function _postJson(bindings, path, body) {
  const headers = await _buildHeaders(bindings, {
    "Content-Type": "application/json"
  });
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    await _throwApiError(`POST ${path}`, resp);
  }
  return await resp.json();
}
function usePostFeedbackAdminActionMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => _postJson(
      bindings,
      `/${encodeURIComponent(input.feedbackId)}/admin-action`,
      input.payload
    ),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.feedbackId]
      });
      queryClient.invalidateQueries({ queryKey: ["feedback", "list"] });
      queryClient.invalidateQueries({ queryKey: ["feedback", "mine"] });
    }
  });
}
function useAdminHardDeleteTicketMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/${encodeURIComponent(input.ticketId)}`;
      const headers = await _buildHeaders(bindings);
      const resp = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers
      });
      if (!resp.ok && resp.status !== 204) {
        await _throwApiError("DELETE /{id}", resp);
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.ticketId]
      });
      queryClient.invalidateQueries({ queryKey: ["feedback", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["feedback", "list"] });
    }
  });
}
function useAdminSoftDeleteTicketMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/${encodeURIComponent(input.ticketId)}/soft-delete`;
      const headers = await _buildHeaders(bindings);
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers
      });
      if (!resp.ok && resp.status !== 204) {
        await _throwApiError("POST /{id}/soft-delete", resp);
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.ticketId]
      });
      queryClient.invalidateQueries({ queryKey: ["feedback", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["feedback", "list"] });
    }
  });
}
function useSoftDeleteTicketMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/chat/sessions/${encodeURIComponent(input.ticketId)}`;
      const headers = await _buildHeaders(bindings);
      const resp = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers
      });
      if (!resp.ok && resp.status !== 204) {
        await _throwApiError("DELETE /chat/sessions", resp);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "mine"] });
    }
  });
}
function useUploadChatAttachmentMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/chat/sessions/${encodeURIComponent(input.sessionId)}/attachments`;
      const fd = new FormData();
      fd.append("file", input.file);
      const headers = await _buildHeaders(bindings);
      delete headers["Content-Type"];
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: fd
      });
      if (!resp.ok) {
        await _throwApiError("POST /chat/sessions/{sid}/attachments", resp);
      }
      return await resp.json();
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "chat", "session", input.sessionId]
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.sessionId]
      });
    }
  });
}
function useDeleteChatAttachmentMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/chat/sessions/${encodeURIComponent(input.sessionId)}/attachments/${encodeURIComponent(input.attachmentId)}`;
      const headers = await _buildHeaders(bindings);
      const resp = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers
      });
      if (!resp.ok && resp.status !== 204) {
        await _throwApiError(
          "DELETE /chat/sessions/{sid}/attachments/{id}",
          resp
        );
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "chat", "session", input.sessionId]
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.sessionId]
      });
    }
  });
}
function useApproveSynthesisMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/chat/sessions/${encodeURIComponent(input.sessionId)}/synthesis/${encodeURIComponent(input.synthesisTs)}/approve`;
      const headers = await _buildHeaders(bindings, {
        "Content-Type": "application/json"
      });
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          screenshot_b64: input.screenshotB64 ?? null,
          screenshot_content_type: input.screenshotContentType ?? null
        })
      });
      if (!resp.ok) {
        await _throwApiError(
          "POST /chat/sessions/{sid}/synthesis/{ts}/approve",
          resp
        );
      }
      return await resp.json();
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "chat", "session", input.sessionId]
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.sessionId]
      });
      queryClient.invalidateQueries({ queryKey: ["feedback", "mine"] });
    }
  });
}
function useEditSynthesisMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/chat/sessions/${encodeURIComponent(input.sessionId)}/synthesis/${encodeURIComponent(input.synthesisTs)}`;
      const headers = await _buildHeaders(bindings, {
        "Content-Type": "application/json"
      });
      const resp = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify(input.patch)
      });
      if (!resp.ok) {
        await _throwApiError(
          "PATCH /chat/sessions/{sid}/synthesis/{ts}",
          resp
        );
      }
      return await resp.json();
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "chat", "session", input.sessionId]
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback", "detail", input.sessionId]
      });
    }
  });
}
function createAdapter(bindings) {
  const adapter = {
    useCurrentUser,
    appVersion: APP_VERSION,
    gitSha: GIT_COMMIT_SHA,
    submitFeedback: (payloadJson, screenshot, attachments) => submitFeedback(bindings, payloadJson, screenshot, attachments),
    downloadFeedbackBundle: (feedbackId) => downloadFeedbackBundleViaBindings(bindings, feedbackId),
    getDeepLinkToFeedback: (id) => getDeepLinkToFeedback(id, bindings.getDeepLinkBase?.()),
    getDefaultRedactionSelectors,
    registerRedactor,
    useTranslation,
    toast: bindings.toast ?? _DEFAULT_TOAST
  };
  return Object.freeze(adapter);
}

// src/FeedbackProvider.tsx
import { jsx } from "react/jsx-runtime";
var _ENV_ENABLED = (import.meta.env.VITE_FEEDBACK_ENABLED ?? "true").toString().toLowerCase() !== "false";
var _ENV_POSITION = import.meta.env.VITE_FEEDBACK_POSITION ?? "bottom_right";
var _ENV_BRAND = import.meta.env.VITE_FEEDBACK_BRAND_PRIMARY_HEX || "";
var _ENV_LOCALE = "en";
var DEFAULT_CONFIG = Object.freeze({
  enabled: _ENV_ENABLED,
  position: _ENV_POSITION,
  brandPrimaryHex: _ENV_BRAND,
  locale: _ENV_LOCALE,
  iterStyle: "focus"
});
var FeedbackContext = createContext(null);
function FeedbackProvider({ children, bindings, adapter, config }) {
  if (!bindings || typeof bindings.useCurrentUser !== "function") {
    throw new Error(
      "FeedbackProvider: `bindings` prop is required and must include `useCurrentUser`. See @rl3/feedback-widget README for the FeedbackHostBindings contract."
    );
  }
  const value = useMemo2(
    () => ({
      bindings,
      adapter: adapter ?? createAdapter(bindings),
      config: { ...DEFAULT_CONFIG, ...config ?? {} }
    }),
    [bindings, adapter, config]
  );
  return /* @__PURE__ */ jsx(FeedbackContext.Provider, { value, children });
}
function useFeedbackContext() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error(
      "useFeedbackContext must be called inside <FeedbackProvider>. Mount the provider at the app root before rendering any widget component."
    );
  }
  return ctx;
}
function useFeedbackAdapter() {
  return useFeedbackContext().adapter;
}
function useFeedbackConfig() {
  return useFeedbackContext().config;
}
function useFeedbackBindings() {
  return useFeedbackContext().bindings;
}

// src/Rl3Mark.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function Rl3Mark({
  className,
  // gradientId kept on the props for backward compat — the gradient
  // itself was removed when the mark switched to flat RL3 brand.
  gradientId: _gradientId = "rl3-feedback-grad"
}) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 32 32",
      fill: "none",
      role: "img",
      "aria-label": "RL3",
      children: [
        /* @__PURE__ */ jsx2("rect", { width: "32", height: "32", rx: "8", fill: "#000000", stroke: "#C4B07F", strokeWidth: "1" }),
        /* @__PURE__ */ jsx2(
          "text",
          {
            x: "16",
            y: "22",
            textAnchor: "middle",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "15",
            fontWeight: "800",
            fill: "#ffffff",
            letterSpacing: "-0.5",
            children: "RL3"
          }
        )
      ]
    }
  );
}

// src/hooks/useMyPendingActionCount.ts
function useMyPendingActionCount() {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).filter((r) => r.user_action_required).length;
}
function useMyTicketsTotalCount() {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).length;
}

// src/hooks/useResizableSheet.ts
import { useCallback, useEffect, useState } from "react";
var STORAGE_KEY = "rl3-feedback-sheet-width";
var DEFAULT_WIDTH = 480;
var MIN_WIDTH = 360;
var MOBILE_BREAKPOINT_PX = 768;
function _maxWidth(viewportWidth) {
  return Math.floor(viewportWidth * 0.8);
}
function _clamp(width, viewportWidth) {
  const max = _maxWidth(viewportWidth);
  return Math.max(MIN_WIDTH, Math.min(max, width));
}
function _readStoredWidth() {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
  }
  return DEFAULT_WIDTH;
}
function _persistWidth(width) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
  }
}
function useResizableSheet() {
  const [viewportWidth, setViewportWidth] = useState(
    () => typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [width, setWidth] = useState(() => _readStoredWidth());
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    setWidth((prev) => _clamp(prev, viewportWidth));
  }, [viewportWidth]);
  const isMobile = viewportWidth < MOBILE_BREAKPOINT_PX;
  const startResize = useCallback(
    (event) => {
      if (isMobile) return;
      event.preventDefault();
      setIsDragging(true);
      const startX = "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
      const startWidth = width;
      const move = (clientX) => {
        const delta = startX - clientX;
        setWidth(_clamp(startWidth + delta, window.innerWidth));
      };
      const onMouseMove = (e) => move(e.clientX);
      const onTouchMove = (e) => {
        if (e.touches[0]) move(e.touches[0].clientX);
      };
      const stop = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("mouseup", stop);
        document.removeEventListener("touchend", stop);
        setWidth((current) => {
          _persistWidth(current);
          return current;
        });
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("mouseup", stop);
      document.addEventListener("touchend", stop);
    },
    [isMobile, width]
  );
  return {
    width: isMobile ? viewportWidth : width,
    isMobile,
    isDragging,
    startResize
  };
}

// src/ui/sheet.tsx
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";

// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/ui/sheet.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function Sheet({ ...props }) {
  return /* @__PURE__ */ jsx3(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetPortal({ ...props }) {
  return /* @__PURE__ */ jsx3(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx3(
    SheetPrimitive.Overlay,
    {
      "data-slot": "sheet-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function SheetContent({
  className,
  children,
  side = "right",
  widthPx,
  onResizeStart,
  isDragging = false,
  style,
  ...props
}) {
  const hasCustomWidth = widthPx !== void 0 && (side === "right" || side === "left");
  const mergedStyle = {
    ...style,
    ...hasCustomWidth ? { width: `${widthPx}px`, maxWidth: "100vw" } : {},
    ...isDragging ? { transition: "none" } : {}
  };
  const handleSideClass = side === "right" ? "left-0 -translate-x-1/2 cursor-col-resize" : "right-0 translate-x-1/2 cursor-col-resize";
  return /* @__PURE__ */ jsxs2(SheetPortal, { children: [
    /* @__PURE__ */ jsx3(SheetOverlay, {}),
    /* @__PURE__ */ jsxs2(
      SheetPrimitive.Content,
      {
        "data-slot": "sheet-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" && !hasCustomWidth && "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "right" && hasCustomWidth && "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full border-l",
          side === "left" && !hasCustomWidth && "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "left" && hasCustomWidth && "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full border-r",
          side === "top" && "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" && "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        ),
        style: mergedStyle,
        ...props,
        children: [
          onResizeStart && hasCustomWidth ? (
            // Drag-resize affordance — full-height invisible strip for
            // the hit target + a centered circular pill with chevrons so
            // users can see the handle. Mirrors the image-comparison
            // slider pattern: thin spine + visible round grip in the
            // middle. Pure dark-on-RL3-palette styling so it does not
            // clash with the brand.
            /* @__PURE__ */ jsxs2(
              "div",
              {
                className: cn(
                  "absolute top-0 z-20 h-full w-3 select-none cursor-ew-resize",
                  handleSideClass
                ),
                onMouseDown: onResizeStart,
                onTouchStart: onResizeStart,
                "data-feedback-id": "feedback.sheet_resize_handle",
                role: "separator",
                "aria-orientation": "vertical",
                "aria-label": "Resize panel",
                children: [
                  /* @__PURE__ */ jsx3(
                    "span",
                    {
                      "aria-hidden": "true",
                      className: cn(
                        "pointer-events-none absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 transition-colors",
                        isDragging ? "bg-primary/70" : "bg-input/60 group-hover:bg-primary/40"
                      )
                    }
                  ),
                  /* @__PURE__ */ jsxs2(
                    "button",
                    {
                      type: "button",
                      tabIndex: -1,
                      "aria-hidden": "true",
                      className: cn(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                        "inline-flex h-9 w-9 items-center justify-center rounded-full",
                        "border border-input bg-card text-foreground shadow-md",
                        "transition-transform duration-150 ease-out",
                        isDragging ? "scale-110 shadow-lg border-primary" : "hover:scale-105 hover:border-primary/60"
                      ),
                      children: [
                        /* @__PURE__ */ jsx3(ChevronLeft, { className: "h-3.5 w-3.5 -mr-1" }),
                        /* @__PURE__ */ jsx3(ChevronRight, { className: "h-3.5 w-3.5 -ml-1" })
                      ]
                    }
                  )
                ]
              }
            )
          ) : null,
          children,
          /* @__PURE__ */ jsxs2(SheetPrimitive.Close, { className: "ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none", children: [
            /* @__PURE__ */ jsx3(XIcon, { className: "size-4" }),
            /* @__PURE__ */ jsx3("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] });
}
function SheetHeader({ className, ...props }) {
  return /* @__PURE__ */ jsx3(
    "div",
    {
      "data-slot": "sheet-header",
      className: cn("flex flex-col gap-1.5 p-4", className),
      ...props
    }
  );
}
function SheetTitle({ className, ...props }) {
  return /* @__PURE__ */ jsx3(
    SheetPrimitive.Title,
    {
      "data-slot": "sheet-title",
      className: cn("text-foreground font-semibold", className),
      ...props
    }
  );
}
function SheetDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx3(
    SheetPrimitive.Description,
    {
      "data-slot": "sheet-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}

// src/chat/CapturePicker.tsx
import { Image as ImageIcon, MousePointer2 } from "lucide-react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function CapturePicker({
  mode,
  locked,
  onActivatePicker,
  onClearLocked,
  onModeChange,
  readOnly = false,
  compact = false
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  if (readOnly) {
    return /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2 text-[11px] text-muted-foreground", children: [
      /* @__PURE__ */ jsx4("span", { className: "uppercase tracking-wide", children: t("feedback.mode_label") }),
      mode === "element" && locked ? /* @__PURE__ */ jsxs3("code", { className: "font-mono truncate max-w-[220px] rounded bg-muted px-1.5 py-0.5", children: [
        /* @__PURE__ */ jsx4(MousePointer2, { className: "mr-1 inline h-3 w-3" }),
        locked.selector
      ] }) : /* @__PURE__ */ jsxs3("span", { className: "inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5", children: [
        /* @__PURE__ */ jsx4(ImageIcon, { className: "h-3 w-3" }),
        t("feedback.mode_whole_page")
      ] })
    ] });
  }
  if (compact) {
    const wholeActive = mode === "page";
    const elementActive = mode === "element";
    const baseBtn = "inline-flex h-7 w-7 items-center justify-center rounded-full transition";
    return /* @__PURE__ */ jsxs3(
      "div",
      {
        className: "inline-flex shrink-0 items-center gap-0.5 rounded-full border border-input/60 bg-muted/30 p-0.5",
        role: "group",
        "aria-label": "Capture mode",
        children: [
          /* @__PURE__ */ jsx4(
            "button",
            {
              type: "button",
              onClick: () => {
                onModeChange("page");
                onClearLocked();
              },
              "aria-pressed": wholeActive,
              "aria-label": t("feedback.mode_whole_page"),
              title: t("feedback.mode_whole_page"),
              "data-feedback-id": "feedback.mode_whole_page",
              className: [
                baseBtn,
                wholeActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              ].join(" "),
              children: /* @__PURE__ */ jsx4(ImageIcon, { className: "h-3.5 w-3.5" })
            }
          ),
          /* @__PURE__ */ jsx4(
            "button",
            {
              type: "button",
              onClick: onActivatePicker,
              "aria-pressed": elementActive,
              "aria-label": t("feedback.mode_select_element"),
              title: t("feedback.mode_select_element"),
              "data-feedback-id": "feedback.mode_select_element",
              className: [
                baseBtn,
                elementActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              ].join(" "),
              children: /* @__PURE__ */ jsx4(MousePointer2, { className: "h-3.5 w-3.5" })
            }
          )
        ]
      }
    );
  }
  return /* @__PURE__ */ jsx4("div", { className: "flex flex-wrap items-center gap-2", children: /* @__PURE__ */ jsxs3("div", { className: "inline-flex items-center rounded-full border border-input/60 bg-muted/30 p-0.5", children: [
    /* @__PURE__ */ jsxs3(
      "button",
      {
        type: "button",
        onClick: () => {
          onModeChange("page");
          onClearLocked();
        },
        "data-feedback-id": "feedback.mode_whole_page",
        "aria-label": t("feedback.mode_whole_page"),
        className: [
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
          mode === "page" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        ].join(" "),
        children: [
          /* @__PURE__ */ jsx4(ImageIcon, { className: "h-3.5 w-3.5" }),
          t("feedback.mode_whole_page")
        ]
      }
    ),
    /* @__PURE__ */ jsxs3(
      "button",
      {
        type: "button",
        onClick: onActivatePicker,
        "data-feedback-id": "feedback.mode_select_element",
        "aria-label": t("feedback.mode_select_element"),
        className: [
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
          mode === "element" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        ].join(" "),
        children: [
          /* @__PURE__ */ jsx4(MousePointer2, { className: "h-3.5 w-3.5" }),
          t("feedback.mode_select_element")
        ]
      }
    )
  ] }) });
}

// src/chat/AttachmentTray.tsx
import { File as FileIcon, FileText, Image as ImageIcon3, X as X2 } from "lucide-react";
import { useEffect as useEffect3, useState as useState3 } from "react";

// src/chat/CapturePreview.tsx
import { Image as ImageIcon2, X } from "lucide-react";
import { useEffect as useEffect2, useState as useState2 } from "react";
import { Fragment, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function Lightbox({
  url,
  onClose
}) {
  useEffect2(() => {
    function handler(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: "fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Attached capture \u2014 expanded view",
      onClick: onBackdropClick,
      children: [
        /* @__PURE__ */ jsx5(
          "button",
          {
            type: "button",
            onClick: onClose,
            "aria-label": "Cerrar vista ampliada",
            className: "absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background",
            children: /* @__PURE__ */ jsx5(X, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx5(
          "img",
          {
            src: url,
            alt: "Attached capture \u2014 expanded view",
            className: "max-h-[90vh] max-w-[90vw] rounded-md border border-input/40 shadow-2xl"
          }
        )
      ]
    }
  );
}

// src/chat/AttachmentTray.tsx
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function _formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function _iconFor(contentType) {
  if (contentType.startsWith("image/")) return /* @__PURE__ */ jsx6(ImageIcon3, { className: "h-5 w-5" });
  if (contentType === "application/pdf") return /* @__PURE__ */ jsx6(FileText, { className: "h-5 w-5" });
  if (contentType.startsWith("text/") || contentType === "application/json")
    return /* @__PURE__ */ jsx6(FileText, { className: "h-5 w-5" });
  return /* @__PURE__ */ jsx6(FileIcon, { className: "h-5 w-5" });
}
function AttachmentTray({
  sessionId,
  screenshotBlob,
  captureMode,
  elementSelector,
  onClearScreenshot,
  canRemove = true,
  includeScreenshots = false
}) {
  const detail = useFeedbackDetailQuery(sessionId);
  const deleteAttachment = useDeleteChatAttachmentMutation();
  const [activeThumb, setActiveThumb] = useState3(null);
  const [screenshotUrl, setScreenshotUrl] = useState3(null);
  useEffect3(() => {
    if (!screenshotBlob) {
      setScreenshotUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshotBlob);
    setScreenshotUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshotBlob]);
  const items = [];
  if (screenshotBlob && screenshotUrl) {
    const isElement = captureMode === "element" && elementSelector;
    items.push({
      key: "local-screenshot",
      kind: isElement ? "element_local" : "screenshot_local",
      previewUrl: screenshotUrl,
      label: isElement ? "Captured element" : "Full page",
      sublabel: isElement ? elementSelector : _formatBytes(screenshotBlob.size),
      byteSize: screenshotBlob.size,
      onRemove: canRemove ? onClearScreenshot : void 0
    });
  }
  const serverAttachments = detail.data?.attachments ?? [];
  for (const a of serverAttachments) {
    if (a.kind === "screenshot" && !includeScreenshots) continue;
    const isImage = a.content_type.startsWith("image/");
    items.push({
      key: `server-${a.id}`,
      kind: "user_attachment",
      previewUrl: isImage ? a.presigned_url ?? null : null,
      label: a.filename ?? "Attachment",
      sublabel: `${a.content_type} \xB7 ${_formatBytes(a.byte_size)}`,
      byteSize: a.byte_size,
      onRemove: canRemove && sessionId ? () => deleteAttachment.mutate({
        sessionId,
        attachmentId: a.id
      }) : void 0
    });
  }
  if (items.length === 0) return null;
  return /* @__PURE__ */ jsxs5(Fragment2, { children: [
    /* @__PURE__ */ jsx6(
      "div",
      {
        className: "flex items-center gap-2 overflow-x-auto px-3 py-2",
        "data-feedback-id": "feedback.attachment_tray",
        children: items.map((item) => /* @__PURE__ */ jsx6(
          _ThumbButton,
          {
            item,
            onClick: () => setActiveThumb(item)
          },
          item.key
        ))
      }
    ),
    activeThumb ? /* @__PURE__ */ jsx6(
      _ThumbDetailModal,
      {
        item: activeThumb,
        onClose: () => setActiveThumb(null)
      }
    ) : null
  ] });
}
function _ThumbButton({
  item,
  onClick
}) {
  return /* @__PURE__ */ jsxs5("div", { className: "group relative shrink-0", children: [
    /* @__PURE__ */ jsx6(
      "button",
      {
        type: "button",
        onClick,
        "aria-label": `View ${item.label}`,
        title: item.label,
        "data-feedback-id": "feedback.attachment_thumb",
        className: "block h-14 w-14 overflow-hidden rounded-md border border-input/60 bg-muted/40 transition hover:ring-2 hover:ring-primary/40",
        children: item.previewUrl ? /* @__PURE__ */ jsx6(
          "img",
          {
            src: item.previewUrl,
            alt: item.label,
            className: "h-full w-full object-cover"
          }
        ) : /* @__PURE__ */ jsx6("span", { className: "flex h-full w-full items-center justify-center text-muted-foreground", children: _iconFor(item.sublabel?.split(" ")[0] ?? "") })
      }
    ),
    item.onRemove ? /* @__PURE__ */ jsx6(
      "button",
      {
        type: "button",
        onClick: (e) => {
          e.stopPropagation();
          item.onRemove?.();
        },
        "aria-label": `Remove ${item.label}`,
        "data-feedback-id": "feedback.attachment_remove",
        className: "absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-input bg-background text-muted-foreground opacity-0 transition hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100",
        children: /* @__PURE__ */ jsx6(X2, { className: "h-3 w-3" })
      }
    ) : null
  ] });
}
function _ThumbDetailModal({
  item,
  onClose
}) {
  if (item.previewUrl) {
    return /* @__PURE__ */ jsx6(Lightbox, { url: item.previewUrl, onClose });
  }
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      className: "fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 p-6",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `Attachment details \u2014 ${item.label}`,
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      children: [
        /* @__PURE__ */ jsx6(
          "button",
          {
            type: "button",
            onClick: onClose,
            "aria-label": "Close",
            className: "absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background",
            children: /* @__PURE__ */ jsx6(X2, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxs5("div", { className: "flex max-w-sm flex-col gap-2 rounded-md border border-input/60 bg-background p-4 shadow-2xl", children: [
          /* @__PURE__ */ jsx6("h3", { className: "text-sm font-semibold", children: item.label }),
          item.sublabel ? /* @__PURE__ */ jsx6("p", { className: "text-xs text-muted-foreground", children: item.sublabel }) : null,
          item.byteSize !== null ? /* @__PURE__ */ jsxs5("p", { className: "text-xs text-muted-foreground", children: [
            "Size: ",
            _formatBytes(item.byteSize)
          ] }) : null
        ] })
      ]
    }
  );
}

// src/chat/ChatTimeline.tsx
import { useEffect as useEffect4, useMemo as useMemo3, useRef } from "react";

// src/chat/ChatBubble.tsx
import { Users } from "lucide-react";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function AssistantAvatar() {
  return /* @__PURE__ */ jsx7(
    "div",
    {
      className: "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-card border border-primary/50 text-[10px] font-bold text-primary shadow-sm",
      "aria-hidden": "true",
      children: "RL3"
    }
  );
}
function ChatBubble({ role, text, caption }) {
  const isUser = role === "user";
  const isAdmin = role === "admin";
  const isAssistant = role === "assistant";
  const bubbleClass = isUser ? "rounded-2xl rounded-tr-md border-primary/40 bg-primary/20 text-foreground" : isAdmin ? "rounded-2xl rounded-tl-md border-violet-500/40 bg-violet-500/15 text-foreground" : "rounded-2xl rounded-tl-md border-input bg-card text-foreground shadow-sm";
  return /* @__PURE__ */ jsxs6("div", { className: `flex w-full ${isUser ? "justify-end" : "justify-start"}`, children: [
    isAssistant || isAdmin ? /* @__PURE__ */ jsx7("div", { className: "mr-2 mt-0.5", children: /* @__PURE__ */ jsx7(AssistantAvatar, {}) }) : null,
    /* @__PURE__ */ jsxs6("div", { className: `flex max-w-[78%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`, children: [
      isAdmin && caption ? /* @__PURE__ */ jsxs6("span", { className: "inline-flex items-center gap-1 text-[10px] font-medium text-violet-700", children: [
        /* @__PURE__ */ jsx7(Users, { className: "h-3 w-3", "aria-hidden": "true" }),
        caption
      ] }) : null,
      /* @__PURE__ */ jsx7(
        "div",
        {
          className: [
            "whitespace-pre-wrap break-words border px-3.5 py-2 text-sm leading-relaxed",
            bubbleClass
          ].join(" "),
          "data-feedback-id": isAdmin ? "feedback.chat_bubble.admin" : isAssistant ? "feedback.chat_bubble.assistant" : "feedback.chat_bubble.user",
          children: text
        }
      )
    ] })
  ] });
}

// src/chat/SynthesisCard.tsx
import { Check, Pencil, X as X3 } from "lucide-react";
import { useState as useState4 } from "react";

// src/ui/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { jsx as jsx8 } from "react/jsx-runtime";
var buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return /* @__PURE__ */ jsx8(
    Comp,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}

// src/ui/input.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
function Input({ className, type, ...props }) {
  return /* @__PURE__ */ jsx9(
    "input",
    {
      type,
      "data-slot": "input",
      className: cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-md border bg-secondary px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

// src/ui/textarea.tsx
import { jsx as jsx10 } from "react/jsx-runtime";
function Textarea({ className, ...props }) {
  return /* @__PURE__ */ jsx10(
    "textarea",
    {
      "data-slot": "textarea",
      className: cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input min-h-16 w-full rounded-md border bg-secondary px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

// src/chat/SynthesisCard.tsx
import { Fragment as Fragment3, jsx as jsx11, jsxs as jsxs7 } from "react/jsx-runtime";
function SectionTitle({ label }) {
  return /* @__PURE__ */ jsx11("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: label });
}
function PersonasBlock({ personas }) {
  return /* @__PURE__ */ jsxs7("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx11(SectionTitle, { label: "Personas" }),
    /* @__PURE__ */ jsx11("ul", { className: "flex flex-col gap-2 text-sm text-foreground", children: personas.map((p, idx) => /* @__PURE__ */ jsxs7(
      "li",
      {
        className: "rounded border border-input/60 bg-muted/30 px-2 py-1",
        children: [
          /* @__PURE__ */ jsx11("p", { className: "font-medium", children: p.name }),
          /* @__PURE__ */ jsxs7("p", { className: "text-xs text-muted-foreground", children: [
            "Goal: ",
            p.goal
          ] }),
          /* @__PURE__ */ jsxs7("p", { className: "text-xs text-muted-foreground", children: [
            "Friction: ",
            p.frustration
          ] })
        ]
      },
      `persona-${idx}-${p.name.slice(0, 16)}`
    )) })
  ] });
}
function BulletList({
  label,
  items,
  muted = false
}) {
  return /* @__PURE__ */ jsxs7("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx11(SectionTitle, { label }),
    /* @__PURE__ */ jsx11(
      "ul",
      {
        className: `list-disc space-y-1 pl-5 text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`,
        children: items.map((item, idx) => /* @__PURE__ */ jsx11("li", { children: item }, `${label}-${idx}-${item.slice(0, 16)}`))
      }
    )
  ] });
}
function DiagramBlock({ source }) {
  return /* @__PURE__ */ jsxs7("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx11(SectionTitle, { label: "Diagram" }),
    /* @__PURE__ */ jsx11(
      "pre",
      {
        "data-feedback-mermaid-source": "true",
        className: "overflow-x-auto rounded border border-input/60 bg-muted/40 p-2 text-xs text-foreground",
        children: /* @__PURE__ */ jsx11("code", { children: source })
      }
    )
  ] });
}
function SynthesisCard({
  synthesis,
  confirmed = false,
  lockedByOtherWinner = false,
  onApprove,
  onEdit,
  busy = false
}) {
  const [editing, setEditing] = useState4(false);
  const [draftTitle, setDraftTitle] = useState4(synthesis.title);
  const [draftSummary, setDraftSummary] = useState4(synthesis.summary);
  const [draftStory, setDraftStory] = useState4(synthesis.user_story);
  const [draftCriteria, setDraftCriteria] = useState4(
    synthesis.acceptance_criteria.join("\n")
  );
  const editable = Boolean(onEdit) && !lockedByOtherWinner;
  const approvable = Boolean(onApprove) && !lockedByOtherWinner;
  const enterEdit = () => {
    if (!editable || busy) return;
    setDraftTitle(synthesis.title);
    setDraftSummary(synthesis.summary);
    setDraftStory(synthesis.user_story);
    setDraftCriteria(synthesis.acceptance_criteria.join("\n"));
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const submitEdit = async () => {
    if (!onEdit) return;
    const patch = {
      title: draftTitle.trim(),
      summary: draftSummary.trim(),
      user_story: draftStory.trim(),
      acceptance_criteria: draftCriteria.split("\n").map((s) => s.trim()).filter(Boolean)
    };
    await onEdit(patch);
    setEditing(false);
  };
  const headerBadge = confirmed ? /* @__PURE__ */ jsxs7("span", { className: "ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600", children: [
    /* @__PURE__ */ jsx11(Check, { className: "h-3 w-3" }),
    " Confirmed"
  ] }) : lockedByOtherWinner ? /* @__PURE__ */ jsx11("span", { className: "ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground", children: "Superseded" }) : null;
  const extraStories = (synthesis.user_stories ?? []).filter(
    (s) => s && s !== synthesis.user_story
  );
  return /* @__PURE__ */ jsxs7(
    "div",
    {
      className: [
        "flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm",
        confirmed ? "border-emerald-500/50 bg-emerald-500/5" : "border-input",
        editable && !editing ? "cursor-pointer hover:border-primary/40" : ""
      ].join(" "),
      "data-feedback-id": "feedback.chat_synthesis_card",
      onClick: editing ? void 0 : enterEdit,
      children: [
        /* @__PURE__ */ jsxs7("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx11("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-primary", children: "Spec card" }),
          headerBadge
        ] }),
        editing ? /* @__PURE__ */ jsxs7(
          "div",
          {
            className: "flex flex-col gap-3",
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxs7("label", { className: "flex flex-col gap-1 text-xs", children: [
                /* @__PURE__ */ jsx11("span", { className: "text-muted-foreground", children: "Title" }),
                /* @__PURE__ */ jsx11(
                  Input,
                  {
                    value: draftTitle,
                    onChange: (e) => setDraftTitle(e.target.value),
                    maxLength: 200
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs7("label", { className: "flex flex-col gap-1 text-xs", children: [
                /* @__PURE__ */ jsx11("span", { className: "text-muted-foreground", children: "Summary" }),
                /* @__PURE__ */ jsx11(
                  Textarea,
                  {
                    value: draftSummary,
                    onChange: (e) => setDraftSummary(e.target.value),
                    rows: 3,
                    maxLength: 4e3
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs7("label", { className: "flex flex-col gap-1 text-xs", children: [
                /* @__PURE__ */ jsx11("span", { className: "text-muted-foreground", children: "User story" }),
                /* @__PURE__ */ jsx11(
                  Textarea,
                  {
                    value: draftStory,
                    onChange: (e) => setDraftStory(e.target.value),
                    rows: 3,
                    maxLength: 4e3
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs7("label", { className: "flex flex-col gap-1 text-xs", children: [
                /* @__PURE__ */ jsx11("span", { className: "text-muted-foreground", children: "Acceptance criteria \xB7 one per line" }),
                /* @__PURE__ */ jsx11(
                  Textarea,
                  {
                    value: draftCriteria,
                    onChange: (e) => setDraftCriteria(e.target.value),
                    rows: 4
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-end gap-2", children: [
                /* @__PURE__ */ jsxs7(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    onClick: cancelEdit,
                    disabled: busy,
                    children: [
                      /* @__PURE__ */ jsx11(X3, { className: "mr-1 h-3.5 w-3.5" }),
                      " Cancel"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs7(
                  Button,
                  {
                    type: "button",
                    size: "sm",
                    onClick: submitEdit,
                    disabled: busy,
                    "data-feedback-id": "feedback.chat_synthesis_confirm_edit",
                    children: [
                      /* @__PURE__ */ jsx11(Check, { className: "mr-1 h-3.5 w-3.5" }),
                      " Confirm edit"
                    ]
                  }
                )
              ] })
            ]
          }
        ) : /* @__PURE__ */ jsxs7(Fragment3, { children: [
          /* @__PURE__ */ jsx11("h3", { className: "text-base font-bold text-foreground", children: synthesis.title }),
          /* @__PURE__ */ jsx11("p", { className: "text-sm text-muted-foreground", children: synthesis.summary }),
          /* @__PURE__ */ jsx11("blockquote", { className: "border-l-2 border-primary pl-3 text-sm italic text-foreground", children: synthesis.user_story }),
          extraStories.length > 0 ? /* @__PURE__ */ jsx11(BulletList, { label: "Additional user stories", items: extraStories }) : null,
          synthesis.personas && synthesis.personas.length > 0 ? /* @__PURE__ */ jsx11(PersonasBlock, { personas: synthesis.personas }) : null,
          synthesis.acceptance_criteria.length > 0 ? /* @__PURE__ */ jsx11(
            BulletList,
            {
              label: "Acceptance criteria",
              items: synthesis.acceptance_criteria
            }
          ) : null,
          synthesis.assumptions && synthesis.assumptions.length > 0 ? /* @__PURE__ */ jsx11(BulletList, { label: "Assumptions", items: synthesis.assumptions, muted: true }) : null,
          synthesis.diagram ? /* @__PURE__ */ jsx11(DiagramBlock, { source: synthesis.diagram }) : null,
          synthesis.open_questions.length > 0 ? /* @__PURE__ */ jsx11(
            BulletList,
            {
              label: "Open questions",
              items: synthesis.open_questions,
              muted: true
            }
          ) : null,
          (approvable || editable) && /* @__PURE__ */ jsxs7(
            "div",
            {
              className: "flex items-center justify-end gap-2 pt-1",
              onClick: (e) => e.stopPropagation(),
              children: [
                editable ? /* @__PURE__ */ jsxs7(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    onClick: enterEdit,
                    disabled: busy,
                    "data-feedback-id": "feedback.chat_synthesis_edit",
                    children: [
                      /* @__PURE__ */ jsx11(Pencil, { className: "mr-1 h-3.5 w-3.5" }),
                      " Edit"
                    ]
                  }
                ) : null,
                approvable ? /* @__PURE__ */ jsxs7(
                  Button,
                  {
                    type: "button",
                    size: "sm",
                    onClick: onApprove,
                    disabled: busy,
                    "data-feedback-id": "feedback.chat_synthesis_approve",
                    children: [
                      /* @__PURE__ */ jsx11(Check, { className: "mr-1 h-3.5 w-3.5" }),
                      " Approve"
                    ]
                  }
                ) : null
              ]
            }
          )
        ] })
      ]
    }
  );
}

// src/chat/ChatTimeline.tsx
import { jsx as jsx12, jsxs as jsxs8 } from "react/jsx-runtime";
function ChatTimeline({
  messages,
  isThinking = false,
  thinkingLabel,
  onApproveSynthesis,
  onEditSynthesis,
  synthesisBusy = false
}) {
  const endRef = useRef(null);
  useEffect4(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);
  const latestSynthesisIdx = useMemo3(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "synthesis" && messages[i].synthesis) return i;
    }
    return -1;
  }, [messages]);
  return /* @__PURE__ */ jsxs8("div", { className: "flex flex-col gap-3 px-4 py-3", children: [
    messages.map((m, idx) => {
      if (m.role === "synthesis" && m.synthesis) {
        if (idx !== latestSynthesisIdx) return null;
        const tsKey = String(m.ts);
        return /* @__PURE__ */ jsx12(
          SynthesisCard,
          {
            synthesis: m.synthesis,
            confirmed: m.confirmed === true,
            lockedByOtherWinner: false,
            onApprove: onApproveSynthesis ? () => onApproveSynthesis(tsKey) : void 0,
            onEdit: onEditSynthesis ? (patch) => onEditSynthesis(tsKey, patch) : void 0,
            busy: synthesisBusy
          },
          `synthesis-${tsKey}-${idx}`
        );
      }
      return /* @__PURE__ */ jsx12(
        ChatBubble,
        {
          role: m.role,
          text: m.text
        },
        `${m.role}-${m.ts}-${idx}`
      );
    }),
    isThinking ? /* @__PURE__ */ jsx12(_ThinkingIndicator, { label: thinkingLabel }) : null,
    /* @__PURE__ */ jsx12("div", { ref: endRef, "aria-hidden": "true" })
  ] });
}
function _ThinkingIndicator({ label }) {
  return /* @__PURE__ */ jsx12("div", { className: "flex w-full justify-start", children: /* @__PURE__ */ jsxs8("div", { className: "flex items-center gap-2 rounded-2xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground", children: [
    /* @__PURE__ */ jsxs8("span", { className: "flex items-center gap-1", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx12("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" }),
      /* @__PURE__ */ jsx12("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" }),
      /* @__PURE__ */ jsx12("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current" })
    ] }),
    label ? /* @__PURE__ */ jsx12("span", { className: "text-xs", children: label }) : null
  ] }) });
}

// src/chat/Composer.tsx
import { Mic, Paperclip, SendHorizontal } from "lucide-react";
import {
  useCallback as useCallback3,
  useEffect as useEffect6,
  useRef as useRef3,
  useState as useState6
} from "react";

// src/chat/useVoiceCapture.ts
import { useCallback as useCallback2, useEffect as useEffect5, useRef as useRef2, useState as useState5 } from "react";
var _MAX_DURATION_MS = 6e4;
var _TICK_INTERVAL_MS = 250;
var AUDIO_LEVEL_BARS = 40;
var _LEVEL_FRAME_INTERVAL_MS = 1e3 / 30;
var _PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus"
];
function isVoiceCaptureSupported() {
  if (typeof window === "undefined") return false;
  if (typeof window.MediaRecorder === "undefined") return false;
  const md = window.navigator?.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return false;
  return true;
}
function _pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const mt of _PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(mt)) return mt;
    } catch {
    }
  }
  return "audio/webm";
}
function _getAudioContextCtor() {
  if (typeof window === "undefined") return null;
  const w = window;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}
function useVoiceCapture() {
  const [state, setState] = useState5("idle");
  const [duration_ms, setDurationMs] = useState5(0);
  const [error, setError] = useState5(null);
  const recorderRef = useRef2(null);
  const streamRef = useRef2(null);
  const chunksRef = useRef2([]);
  const startedAtRef = useRef2(0);
  const tickTimerRef = useRef2(null);
  const autoStopTimerRef = useRef2(null);
  const stopResolverRef = useRef2(null);
  const audioCtxRef = useRef2(null);
  const analyserRef = useRef2(null);
  const sourceRef = useRef2(null);
  const levelsRef = useRef2(new Float32Array(AUDIO_LEVEL_BARS));
  const levelsCursorRef = useRef2(0);
  const levelRafRef = useRef2(null);
  const levelLastTsRef = useRef2(0);
  const analyserBufRef = useRef2(null);
  const _stopLevelLoop = useCallback2(() => {
    if (levelRafRef.current !== null) {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(levelRafRef.current);
      }
      levelRafRef.current = null;
    }
    levelLastTsRef.current = 0;
  }, []);
  const _resetLevels = useCallback2(() => {
    levelsRef.current.fill(0);
    levelsCursorRef.current = 0;
  }, []);
  const _disposeAudioGraph = useCallback2(() => {
    _stopLevelLoop();
    try {
      sourceRef.current?.disconnect();
    } catch {
    }
    sourceRef.current = null;
    try {
      analyserRef.current?.disconnect();
    } catch {
    }
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx) {
      try {
        void ctx.close();
      } catch {
      }
    }
    audioCtxRef.current = null;
    analyserBufRef.current = null;
  }, [_stopLevelLoop]);
  const _cleanup = useCallback2(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    _disposeAudioGraph();
    _resetLevels();
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
        }
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
  }, [_disposeAudioGraph, _resetLevels]);
  const _tickLevel = useCallback2((ts) => {
    const analyser = analyserRef.current;
    const buf = analyserBufRef.current;
    if (!analyser || !buf) {
      levelRafRef.current = null;
      return;
    }
    const last = levelLastTsRef.current;
    if (last !== 0 && ts - last < _LEVEL_FRAME_INTERVAL_MS) {
      levelRafRef.current = window.requestAnimationFrame(_tickLevel);
      return;
    }
    levelLastTsRef.current = ts;
    analyser.getByteTimeDomainData(buf);
    let sumSquares = 0;
    const bufLen = buf.length;
    for (let i = 0; i < bufLen; i++) {
      const sample = ((buf[i] ?? 128) - 128) / 128;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufLen);
    const normalised = Math.min(1, Math.max(0, rms * 1.8));
    const cursor = levelsCursorRef.current;
    levelsRef.current[cursor] = normalised;
    levelsCursorRef.current = (cursor + 1) % AUDIO_LEVEL_BARS;
    levelRafRef.current = window.requestAnimationFrame(_tickLevel);
  }, []);
  const _startLevelLoop = useCallback2(
    (stream) => {
      const Ctor = _getAudioContextCtor();
      if (!Ctor) return;
      try {
        const ctx = new Ctor();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        sourceRef.current = src;
        analyserRef.current = analyser;
        analyserBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        _resetLevels();
        levelLastTsRef.current = 0;
        levelRafRef.current = window.requestAnimationFrame(_tickLevel);
      } catch {
        _disposeAudioGraph();
      }
    },
    [_disposeAudioGraph, _resetLevels, _tickLevel]
  );
  const getAudioLevels = useCallback2(() => levelsRef.current, []);
  useEffect5(() => {
    return () => {
      _cleanup();
    };
  }, [_cleanup]);
  const startRecording = useCallback2(async () => {
    if (!isVoiceCaptureSupported()) {
      setError("Voice recording is not supported in this browser.");
      setState("error");
      return;
    }
    if (state === "recording" || state === "stopping") return;
    setError(null);
    setDurationMs(0);
    let stream;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err?.message ?? String(err);
      setError(`Microphone access denied: ${msg}`);
      setState("error");
      return;
    }
    const mimeType = _pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream);
      } catch (err2) {
        for (const track of stream.getTracks()) track.stop();
        const msg = err2?.message ?? String(err2);
        setError(`MediaRecorder unavailable: ${msg}`);
        setState("error");
        return;
      }
      void err;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };
    recorder.onstop = () => {
      const usedType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: usedType });
      const elapsed = startedAtRef.current === 0 ? 0 : Date.now() - startedAtRef.current;
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      _cleanup();
      setState("idle");
      setDurationMs(0);
      if (resolver) {
        if (blob.size === 0) {
          resolver(null);
        } else {
          resolver({ blob, duration_ms: elapsed, mime_type: usedType });
        }
      }
    };
    recorder.onerror = (ev) => {
      const detail = ev?.message ?? "MediaRecorder error";
      setError(detail);
      setState("error");
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      _cleanup();
      if (resolver) resolver(null);
    };
    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    try {
      recorder.start();
    } catch (err) {
      const msg = err?.message ?? String(err);
      _cleanup();
      setError(`Failed to start recorder: ${msg}`);
      setState("error");
      return;
    }
    setState("recording");
    _startLevelLoop(stream);
    tickTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(elapsed);
    }, _TICK_INTERVAL_MS);
    autoStopTimerRef.current = window.setTimeout(() => {
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        setState("stopping");
        try {
          r.stop();
        } catch {
        }
      }
    }, _MAX_DURATION_MS);
  }, [_cleanup, _startLevelLoop, state]);
  const stopRecording = useCallback2(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return null;
    }
    setState("stopping");
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        stopResolverRef.current = null;
        _cleanup();
        setState("idle");
        resolve(null);
      }
    });
  }, [_cleanup]);
  const cancelRecording = useCallback2(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
      }
    }
    const resolver = stopResolverRef.current;
    stopResolverRef.current = null;
    _cleanup();
    setState("idle");
    setDurationMs(0);
    setError(null);
    if (resolver) resolver(null);
  }, [_cleanup]);
  return {
    state,
    duration_ms,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    getAudioLevels
  };
}

// src/chat/Composer.tsx
import { Fragment as Fragment4, jsx as jsx13, jsxs as jsxs9 } from "react/jsx-runtime";
var _ACCEPT_ATTRIBUTE = "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,application/json,.log";
var DEFAULT_PLACEHOLDER = "Type what's on your mind\u2026";
var MIN_TEXTAREA_HEIGHT = 24;
var MAX_TEXTAREA_HEIGHT = 160;
function Composer({
  onSend,
  disabled = false,
  placeholder,
  onVoiceToggle,
  onAttachFiles,
  attachDisabled = false,
  value: valueProp,
  onValueChange,
  autoFocus = false
}) {
  const [localValue, setLocalValue] = useState6("");
  const [focused, setFocused] = useState6(false);
  const isControlled = valueProp !== void 0;
  const value = isControlled ? valueProp : localValue;
  const textareaRef = useRef3(null);
  const fileInputRef = useRef3(null);
  const voiceSupported = isVoiceCaptureSupported();
  const showVoice = typeof onVoiceToggle === "function" && voiceSupported;
  const showAttach = typeof onAttachFiles === "function";
  const onPickFiles = useCallback3(
    (event) => {
      const picked = event.target.files;
      if (!picked || picked.length === 0) return;
      const arr = Array.from(picked);
      onAttachFiles?.(arr);
      event.target.value = "";
    },
    [onAttachFiles]
  );
  useEffect6(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(
      MAX_TEXTAREA_HEIGHT,
      Math.max(MIN_TEXTAREA_HEIGHT, el.scrollHeight)
    );
    el.style.height = `${next}px`;
  }, [value]);
  useEffect6(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
    }
  }, [autoFocus]);
  const setValue = useCallback3(
    (next) => {
      if (isControlled) onValueChange?.(next);
      else setLocalValue(next);
    },
    [isControlled, onValueChange]
  );
  const submit = useCallback3(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }, [disabled, onSend, setValue, value]);
  const handleKeyDown = useCallback3(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit]
  );
  const hasText = value.trim().length > 0;
  return /* @__PURE__ */ jsx13("div", { className: "border-t border-input/40 bg-background/95 px-3 py-3 backdrop-blur", children: /* @__PURE__ */ jsxs9(
    "div",
    {
      className: [
        "flex flex-col rounded-2xl border bg-card/60 transition shadow-sm",
        focused ? "border-primary/50 ring-2 ring-primary/20" : "border-input/60"
      ].join(" "),
      children: [
        /* @__PURE__ */ jsx13(
          "textarea",
          {
            ref: textareaRef,
            value,
            onChange: (e) => setValue(e.target.value),
            onKeyDown: handleKeyDown,
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
            disabled,
            placeholder: placeholder ?? DEFAULT_PLACEHOLDER,
            rows: 1,
            className: "resize-none border-0 bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none disabled:opacity-50",
            style: { minHeight: `${MIN_TEXTAREA_HEIGHT}px`, maxHeight: `${MAX_TEXTAREA_HEIGHT}px` },
            "data-feedback-id": "feedback.chat_composer"
          }
        ),
        /* @__PURE__ */ jsxs9("div", { className: "flex items-center justify-between gap-2 border-t border-input/30 px-2 py-1.5", children: [
          /* @__PURE__ */ jsxs9("div", { className: "flex items-center gap-1", children: [
            showAttach ? /* @__PURE__ */ jsxs9(Fragment4, { children: [
              /* @__PURE__ */ jsx13(
                "input",
                {
                  ref: fileInputRef,
                  type: "file",
                  multiple: true,
                  accept: _ACCEPT_ATTRIBUTE,
                  onChange: onPickFiles,
                  hidden: true,
                  "data-feedback-id": "feedback.chat_attach_input"
                }
              ),
              /* @__PURE__ */ jsx13(
                Button,
                {
                  type: "button",
                  variant: "ghost",
                  size: "icon",
                  onClick: () => fileInputRef.current?.click(),
                  disabled: disabled || attachDisabled,
                  "aria-label": "Attach files",
                  title: attachDisabled ? "Attachment limit reached (5 max)" : "Attach files",
                  "data-feedback-id": "feedback.chat_attach",
                  className: "h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground",
                  children: /* @__PURE__ */ jsx13(Paperclip, { className: "h-4 w-4" })
                }
              )
            ] }) : null,
            showVoice ? /* @__PURE__ */ jsx13(
              Button,
              {
                type: "button",
                variant: "ghost",
                size: "icon",
                onClick: onVoiceToggle,
                disabled,
                "aria-label": "Record voice message",
                "data-feedback-id": "feedback.chat_mic",
                className: "h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground",
                children: /* @__PURE__ */ jsx13(Mic, { className: "h-4 w-4" })
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsxs9(
            Button,
            {
              type: "button",
              onClick: () => void submit(),
              disabled: disabled || !hasText,
              "aria-label": "Send",
              "data-feedback-id": "feedback.chat_send",
              className: [
                "h-8 shrink-0 rounded-md px-3 text-xs font-medium transition flex items-center gap-1.5",
                hasText ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90" : "bg-secondary text-muted-foreground cursor-not-allowed"
              ].join(" "),
              children: [
                /* @__PURE__ */ jsx13(SendHorizontal, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsx13("span", { children: "Send" })
              ]
            }
          )
        ] })
      ]
    }
  ) });
}

// src/chat/FeedbackTabs.tsx
import { Inbox, MessageSquarePlus } from "lucide-react";
import { jsx as jsx14, jsxs as jsxs10 } from "react/jsx-runtime";
function FeedbackTabs({
  activeTab,
  mineTotalCount,
  unreadAdminRepliesCount = 0,
  onTabChange
}) {
  return /* @__PURE__ */ jsxs10(
    "div",
    {
      className: "grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium",
      role: "tablist",
      children: [
        /* @__PURE__ */ jsxs10(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "compose",
            onClick: () => onTabChange("compose"),
            className: `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${activeTab === "compose" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
            "data-feedback-id": "feedback.tab.compose",
            children: [
              /* @__PURE__ */ jsx14(MessageSquarePlus, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx14("span", { children: "New feedback" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs10(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "mine",
            onClick: () => onTabChange("mine"),
            className: `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${activeTab === "mine" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
            "data-feedback-id": "feedback.tab.mine",
            children: [
              /* @__PURE__ */ jsx14(Inbox, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx14("span", { children: "My tickets" }),
              mineTotalCount > 0 ? /* @__PURE__ */ jsx14(
                "span",
                {
                  className: `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${unreadAdminRepliesCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"}`,
                  title: unreadAdminRepliesCount > 0 ? `${unreadAdminRepliesCount} with a reply from the team` : `${mineTotalCount} total`,
                  children: unreadAdminRepliesCount > 0 ? unreadAdminRepliesCount : mineTotalCount
                }
              ) : null
            ]
          }
        )
      ]
    }
  );
}

// src/chat/FooterActions.tsx
import { Check as Check2, Loader2, RotateCcw } from "lucide-react";
import { jsx as jsx15, jsxs as jsxs11 } from "react/jsx-runtime";
function FooterActions({
  state,
  onConfirm,
  onAdjust,
  onRetry
}) {
  if (state === "error") {
    return /* @__PURE__ */ jsx15("div", { className: "flex gap-2 px-3 py-3 border-t border-border bg-background", children: /* @__PURE__ */ jsx15(Button, { type: "button", variant: "default", onClick: onRetry, className: "w-full", children: "\u21BB Reintentar" }) });
  }
  if (state === "confirming" || state === "synthesizing" || state === "finalizing") {
    const disabled = state !== "confirming";
    return /* @__PURE__ */ jsxs11("div", { className: "flex gap-2 px-3 py-3 border-t border-border bg-background", children: [
      /* @__PURE__ */ jsxs11(
        Button,
        {
          type: "button",
          variant: "outline",
          onClick: onAdjust,
          disabled,
          className: "flex-1",
          "data-feedback-id": "feedback.footer.adjust",
          children: [
            state === "synthesizing" ? /* @__PURE__ */ jsx15(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx15(RotateCcw, { className: "h-4 w-4 mr-1" }),
            "Keep iterating"
          ]
        }
      ),
      /* @__PURE__ */ jsxs11(
        Button,
        {
          type: "button",
          variant: "default",
          onClick: onConfirm,
          disabled,
          className: "flex-1",
          "data-feedback-id": "feedback.footer.confirm",
          children: [
            state === "finalizing" ? /* @__PURE__ */ jsx15(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx15(Check2, { className: "h-4 w-4 mr-1" }),
            "Confirm"
          ]
        }
      )
    ] });
  }
  return null;
}

// src/chat/MineFeedTab.tsx
import { ChevronLeft as ChevronLeft2, ChevronRight as ChevronRight2, Inbox as Inbox2, Search } from "lucide-react";
import { useState as useState7 } from "react";

// src/hooks/useCanTriageFeedback.ts
function useCanTriageFeedback() {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const user = adapter.useCurrentUser();
  if (!user) return false;
  const allowed = (bindings.triageRoles && bindings.triageRoles.length > 0 ? bindings.triageRoles : ["MASTER_ADMIN"]).map((r) => r.toUpperCase());
  return allowed.includes(user.role.toUpperCase());
}

// src/chat/TicketRow.tsx
import { Bug, Paperclip as Paperclip2, User as UserIcon } from "lucide-react";

// src/chat/StatusPill.tsx
import { jsx as jsx16 } from "react/jsx-runtime";
var _STATUS_STYLES = {
  open: {
    label: "Open",
    classes: "border-muted-foreground/30 bg-muted text-muted-foreground"
  },
  in_review: {
    label: "In review",
    classes: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700"
  },
  in_progress: {
    label: "In progress",
    classes: "border-blue-500/30 bg-blue-500/10 text-blue-700"
  },
  waiting_for_user: {
    label: "Waiting for you",
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-700"
  },
  resolved: {
    label: "Resolved",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  },
  wont_fix: {
    label: "Won't fix",
    classes: "border-destructive/30 bg-destructive/10 text-destructive"
  },
  closed: {
    label: "Closed",
    classes: "border-muted-foreground/40 bg-muted text-muted-foreground"
  }
};
function StatusPill({ status }) {
  const style = _STATUS_STYLES[status] ?? _STATUS_STYLES.open;
  return /* @__PURE__ */ jsx16(
    "span",
    {
      className: `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${style.classes}`,
      "data-feedback-id": "feedback.status_pill",
      "data-status": status,
      children: style.label
    }
  );
}

// src/chat/TicketRow.tsx
import { jsx as jsx17, jsxs as jsxs12 } from "react/jsx-runtime";
function _relativeTime(iso) {
  if (!iso) return "\u2014";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "\u2014";
  const diff = Date.now() - then;
  const s = Math.max(0, Math.floor(diff / 1e3));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}
function _shortId(id) {
  if (!id || id.length <= 10) return id || "?";
  return `${id.slice(0, 4)}\u2026${id.slice(-4)}`;
}
var _SEVERITY_STYLES = {
  blocker: "border-destructive/40 bg-destructive/10 text-destructive",
  major: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  minor: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  idea: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
};
function TicketRow({
  row,
  currentUserId,
  onClick
}) {
  const lastActivity = row.last_admin_msg_at ?? row.last_user_msg_at ?? row.updated_at ?? row.created_at;
  const isOwnTicket = currentUserId && row.user_id === currentUserId;
  const creatorLabel = isOwnTicket ? "You" : _shortId(row.user_id);
  const attachmentCount = row.attachments?.length ?? 0;
  return /* @__PURE__ */ jsxs12(
    "button",
    {
      type: "button",
      onClick,
      "data-feedback-id": "feedback.tickets.row",
      title: row.title ?? "(no title yet)",
      className: "flex w-full items-center gap-2 rounded-md border border-input/60 bg-background px-2.5 py-1.5 text-left text-xs transition hover:border-primary/40 hover:bg-accent/50",
      children: [
        /* @__PURE__ */ jsx17(StatusPill, { status: row.status }),
        row.severity ? /* @__PURE__ */ jsx17(
          "span",
          {
            className: `hidden md:inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${_SEVERITY_STYLES[row.severity] ?? "border-muted-foreground/30 bg-muted text-muted-foreground"}`,
            children: row.severity
          }
        ) : null,
        /* @__PURE__ */ jsx17("code", { className: "hidden sm:inline shrink-0 font-mono text-[10px] text-muted-foreground", children: row.ticket_code || "\u2014" }),
        row.user_action_required ? /* @__PURE__ */ jsx17(
          "span",
          {
            className: "inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500",
            title: "Action required",
            "aria-label": "Action required"
          }
        ) : null,
        /* @__PURE__ */ jsx17("span", { className: "min-w-0 flex-1 truncate text-foreground", children: row.title ?? /* @__PURE__ */ jsx17("span", { className: "italic text-muted-foreground", children: "(no title yet)" }) }),
        /* @__PURE__ */ jsxs12("span", { className: "ml-auto hidden md:inline-flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground", children: [
          /* @__PURE__ */ jsxs12("span", { className: "inline-flex items-center gap-1", children: [
            /* @__PURE__ */ jsx17(UserIcon, { className: "h-3 w-3" }),
            /* @__PURE__ */ jsx17("span", { className: "font-mono", children: creatorLabel })
          ] }),
          row.type ? /* @__PURE__ */ jsxs12("span", { className: "inline-flex items-center gap-1", children: [
            /* @__PURE__ */ jsx17(Bug, { className: "h-3 w-3" }),
            row.type
          ] }) : null,
          attachmentCount > 0 ? /* @__PURE__ */ jsxs12("span", { className: "inline-flex items-center gap-1", children: [
            /* @__PURE__ */ jsx17(Paperclip2, { className: "h-3 w-3" }),
            attachmentCount
          ] }) : null
        ] }),
        /* @__PURE__ */ jsx17("span", { className: "shrink-0 text-[10px] text-muted-foreground tabular-nums", children: _relativeTime(lastActivity) })
      ]
    }
  );
}

// src/chat/MineFeedTab.tsx
import { jsx as jsx18, jsxs as jsxs13 } from "react/jsx-runtime";
var _STATUS_OPTIONS = [
  "open",
  "in_review",
  "in_progress",
  "waiting_for_user",
  "resolved",
  "wont_fix",
  "closed"
];
var _TYPE_OPTIONS = [
  "bug",
  "ui",
  "performance",
  "new_feature",
  "extend_feature",
  "other"
];
var _PAGE_SIZE = 20;
function MineFeedTab({ onSelectFeedback }) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();
  const canTriage = useCanTriageFeedback();
  const [scope, setScope] = useState7("mine");
  const [search, setSearch] = useState7("");
  const [statusFilter, setStatusFilter] = useState7("");
  const [typeFilter, setTypeFilter] = useState7("");
  const [page, setPage] = useState7(1);
  const useAll = scope === "all" && canTriage;
  const mineQuery = useMyFeedbackQuery(100);
  const allQuery = useFeedbackListQuery({
    page,
    pageSize: _PAGE_SIZE,
    status: statusFilter || null,
    type: typeFilter || null,
    q: search.trim() || void 0
  });
  const isLoading = useAll ? allQuery.isLoading : mineQuery.isLoading;
  const isError = useAll ? allQuery.isError : mineQuery.isError;
  let rows = useAll ? allQuery.data?.data ?? [] : mineQuery.data ?? [];
  let total = useAll ? allQuery.data?.count ?? 0 : mineQuery.data?.length ?? 0;
  if (!useAll) {
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (typeFilter) rows = rows.filter((r) => r.type === typeFilter);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter(
        (r) => (r.title ?? "").toLowerCase().includes(needle) || (r.ticket_code ?? "").toLowerCase().includes(needle)
      );
    }
    total = rows.length;
    const start = (page - 1) * _PAGE_SIZE;
    rows = rows.slice(start, start + _PAGE_SIZE);
  }
  const totalPages = Math.max(1, Math.ceil(total / _PAGE_SIZE));
  const onResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setPage(1);
  };
  return /* @__PURE__ */ jsxs13("div", { className: "flex h-full flex-col gap-2 p-2", children: [
    canTriage ? /* @__PURE__ */ jsxs13("div", { className: "inline-flex w-full items-center gap-1 rounded-full border border-input/60 bg-muted/30 p-0.5", children: [
      /* @__PURE__ */ jsx18(
        "button",
        {
          type: "button",
          onClick: () => {
            setScope("mine");
            setPage(1);
          },
          "data-feedback-id": "feedback.tickets.scope_mine",
          className: [
            "flex-1 rounded-full px-3 py-1 text-xs font-medium transition",
            scope === "mine" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          ].join(" "),
          children: "Mine"
        }
      ),
      /* @__PURE__ */ jsx18(
        "button",
        {
          type: "button",
          onClick: () => {
            setScope("all");
            setPage(1);
          },
          "data-feedback-id": "feedback.tickets.scope_all",
          className: [
            "flex-1 rounded-full px-3 py-1 text-xs font-medium transition",
            scope === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          ].join(" "),
          children: "All"
        }
      )
    ] }) : null,
    /* @__PURE__ */ jsxs13("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsxs13("div", { className: "relative flex-1 min-w-[140px]", children: [
        /* @__PURE__ */ jsx18(Search, { className: "pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }),
        /* @__PURE__ */ jsx18(
          "input",
          {
            type: "search",
            value: search,
            onChange: (e) => {
              setSearch(e.target.value);
              setPage(1);
            },
            placeholder: "Search title or code\u2026",
            "data-feedback-id": "feedback.tickets.search",
            className: "w-full rounded-md border border-input bg-secondary pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs13(
        "select",
        {
          value: statusFilter,
          onChange: (e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          },
          "data-feedback-id": "feedback.tickets.status_filter",
          className: "rounded-md border border-input bg-secondary px-2 py-1 text-xs",
          children: [
            /* @__PURE__ */ jsx18("option", { value: "", children: "All statuses" }),
            _STATUS_OPTIONS.map((s) => /* @__PURE__ */ jsx18("option", { value: s, children: s }, s))
          ]
        }
      ),
      /* @__PURE__ */ jsxs13(
        "select",
        {
          value: typeFilter,
          onChange: (e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          },
          "data-feedback-id": "feedback.tickets.type_filter",
          className: "rounded-md border border-input bg-secondary px-2 py-1 text-xs",
          children: [
            /* @__PURE__ */ jsx18("option", { value: "", children: "All types" }),
            _TYPE_OPTIONS.map((tp) => /* @__PURE__ */ jsx18("option", { value: tp, children: tp }, tp))
          ]
        }
      ),
      search || statusFilter || typeFilter ? /* @__PURE__ */ jsx18(
        "button",
        {
          type: "button",
          onClick: onResetFilters,
          "data-feedback-id": "feedback.tickets.reset",
          className: "text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground",
          children: "Reset"
        }
      ) : null
    ] }),
    /* @__PURE__ */ jsx18("div", { className: "flex-1 min-h-0 overflow-hidden", children: isLoading ? /* @__PURE__ */ jsx18("p", { className: "text-sm text-muted-foreground p-4", children: t("feedback.mine.loading") }) : isError ? /* @__PURE__ */ jsx18("p", { className: "text-sm text-destructive p-4", children: t("feedback.mine.error") }) : rows.length === 0 ? /* @__PURE__ */ jsxs13("div", { className: "flex flex-col items-center justify-center gap-3 px-4 py-12 text-center", children: [
      /* @__PURE__ */ jsx18("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground", children: /* @__PURE__ */ jsx18(Inbox2, { className: "h-6 w-6" }) }),
      /* @__PURE__ */ jsx18("p", { className: "text-sm font-medium text-foreground", children: "No tickets yet" }),
      /* @__PURE__ */ jsxs13("p", { className: "max-w-[280px] text-xs text-muted-foreground", children: [
        "Switch to the ",
        /* @__PURE__ */ jsx18("span", { className: "text-foreground", children: "New feedback" }),
        " ",
        "tab to file your first one \u2014 every ticket lands here."
      ] })
    ] }) : /* @__PURE__ */ jsx18("ul", { className: "space-y-1", children: rows.map((r) => /* @__PURE__ */ jsx18("li", { children: /* @__PURE__ */ jsx18(
      TicketRow,
      {
        row: r,
        currentUserId: currentUser?.id ?? null,
        onClick: () => onSelectFeedback?.(r.id)
      }
    ) }, r.id)) }) }),
    totalPages > 1 ? /* @__PURE__ */ jsxs13("div", { className: "flex items-center justify-between gap-2 border-t border-input/40 pt-2", children: [
      /* @__PURE__ */ jsxs13("span", { className: "text-[10px] text-muted-foreground tabular-nums", children: [
        (page - 1) * _PAGE_SIZE + 1,
        "-",
        Math.min(page * _PAGE_SIZE, total),
        " of ",
        total
      ] }),
      /* @__PURE__ */ jsxs13("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx18(
          "button",
          {
            type: "button",
            onClick: () => setPage((p) => Math.max(1, p - 1)),
            disabled: page <= 1,
            "aria-label": "Previous page",
            "data-feedback-id": "feedback.tickets.prev",
            className: "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground transition hover:bg-accent disabled:opacity-30",
            children: /* @__PURE__ */ jsx18(ChevronLeft2, { className: "h-3.5 w-3.5" })
          }
        ),
        /* @__PURE__ */ jsxs13("span", { className: "text-[11px] tabular-nums text-foreground", children: [
          page,
          " / ",
          totalPages
        ] }),
        /* @__PURE__ */ jsx18(
          "button",
          {
            type: "button",
            onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
            disabled: page >= totalPages,
            "aria-label": "Next page",
            "data-feedback-id": "feedback.tickets.next",
            className: "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground transition hover:bg-accent disabled:opacity-30",
            children: /* @__PURE__ */ jsx18(ChevronRight2, { className: "h-3.5 w-3.5" })
          }
        )
      ] })
    ] }) : null
  ] });
}

// src/chat/TicketDetail.tsx
import { AlertTriangle, Download, Send, Trash2, User } from "lucide-react";
import { useEffect as useEffect7, useRef as useRef5, useState as useState9 } from "react";

// src/chat/useChatRunStream.ts
import { useCallback as useCallback4, useRef as useRef4, useState as useState8 } from "react";

// src/client/idempotency.ts
function newIdempotencyKey() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// src/chat/useChatRunStream.ts
function _base(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
function _prefix(b) {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}
async function _authHeaders(b) {
  const out = {};
  try {
    const csrf = await b.getCsrfToken();
    if (csrf) out["X-CSRF-Token"] = csrf;
  } catch {
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader();
      if (auth) out.Authorization = auth;
    } catch {
    }
  }
  return out;
}
function _parseSseFrame(raw) {
  if (raw.startsWith(":")) return null;
  let event = null;
  let dataStr = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataStr = (dataStr ?? "") + line.slice(5).trim();
    }
  }
  if (!event || dataStr === null) return null;
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}
function useChatRunStream(args) {
  const { bindings, sessionId } = args;
  const [state, setState] = useState8("idle");
  const [messages, setMessages] = useState8([]);
  const [partial_text, setPartialText] = useState8("");
  const [synthesis, setSynthesis] = useState8(null);
  const [error, setError] = useState8(null);
  const abortRef = useRef4(null);
  const reset = useCallback4(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setMessages([]);
    setPartialText("");
    setSynthesis(null);
    setError(null);
  }, []);
  const pushAssistantGreeting = useCallback4((text) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
    setState("awaiting_user");
  }, []);
  const pushAssistantMessage = useCallback4((text) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
  }, []);
  const setStateExternal = useCallback4((next) => {
    setState(next);
  }, []);
  const clearSynthesis = useCallback4(() => {
    setSynthesis(null);
  }, []);
  const updateSynthesisMsg = useCallback4(
    (ts, patch) => {
      setMessages((prev) => {
        let winnerJustSet = false;
        const next = prev.map((m) => {
          if (m.role !== "synthesis" || String(m.ts) !== ts) return m;
          const updated = { ...m };
          if (typeof patch.confirmed === "boolean") {
            updated.confirmed = patch.confirmed;
            if (patch.confirmed) winnerJustSet = true;
          }
          if (patch.synthesis) {
            updated.synthesis = patch.synthesis;
          }
          return updated;
        });
        if (winnerJustSet) {
          return next.map(
            (m) => m.role === "synthesis" && String(m.ts) !== ts ? { ...m, confirmed: false } : m
          );
        }
        return next;
      });
      if (patch.synthesis) setSynthesis(patch.synthesis);
    },
    []
  );
  const seedConversation = useCallback4(
    (args2) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setMessages(args2.messages);
      setSynthesis(args2.synthesis ?? null);
      setPartialText("");
      setError(null);
      setState(args2.nextState ?? "awaiting_user");
    },
    []
  );
  const sendMessageWithSessionId = useCallback4(
    async (sid, content, via = "text", screenshotB64, screenshotContentType) => {
      if (!sid) {
        setError("session not initialised");
        setState("error");
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, { role: "user", text: trimmed, ts: Date.now() }]);
      setPartialText("");
      setError(null);
      setState("bot_thinking");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const url = `${_base(bindings)}${_prefix(bindings)}/chat/sessions/${encodeURIComponent(sid)}/messages`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          credentials: "include",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Idempotency-Key": newIdempotencyKey(),
            ...await _authHeaders(bindings)
          },
          body: JSON.stringify({
            content: trimmed,
            via,
            screenshot_b64: screenshotB64 ?? null,
            screenshot_content_type: screenshotContentType ?? null
          })
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new Error(`chat stream failed (${resp.status}): ${detail || resp.statusText}`);
        }
        if (!resp.body) {
          throw new Error("chat stream: no response body");
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let bufferedPartial = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split = buffer.indexOf("\n\n");
          while (split !== -1) {
            const raw = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const frame = _parseSseFrame(raw);
            if (frame) {
              if (frame.event === "delta") {
                const txt = frame.data?.text ?? "";
                bufferedPartial += txt;
                setPartialText(bufferedPartial);
              } else if (frame.event === "turn_done") {
                const turn = frame.data?.turn;
                if (turn) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      text: turn.reply,
                      ts: Date.now(),
                      mode: turn.mode,
                      covered: turn.covered,
                      active_branch: turn.active_branch,
                      inferred: turn.inferred
                    }
                  ]);
                  bufferedPartial = "";
                  setPartialText("");
                  if (turn.mode !== "synthesize") {
                    setState("awaiting_user");
                  }
                }
              } else if (frame.event === "synthesizing") {
                setState("synthesizing");
              } else if (frame.event === "synthesis") {
                const payload = frame.data;
                const data = payload?.data;
                if (data) {
                  const synthTs = typeof payload.ts === "string" && payload.ts.length > 0 ? payload.ts : (/* @__PURE__ */ new Date()).toISOString();
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "synthesis",
                      text: "",
                      ts: synthTs,
                      synthesis: data,
                      confirmed: false
                    }
                  ]);
                  setSynthesis(data);
                  setState("confirming");
                }
              } else if (frame.event === "error") {
                const detail = frame.data?.detail ?? "stream error";
                setError(detail);
                setState("error");
              }
            }
            split = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(String(err.message ?? err));
        setState("error");
      } finally {
        abortRef.current = null;
      }
    },
    [bindings]
  );
  const sendMessage = useCallback4(
    async (content, via = "text", screenshotB64, screenshotContentType) => {
      if (!sessionId) {
        setError("session not initialised");
        setState("error");
        return;
      }
      return sendMessageWithSessionId(
        sessionId,
        content,
        via,
        screenshotB64,
        screenshotContentType
      );
    },
    [sessionId, sendMessageWithSessionId]
  );
  return {
    state,
    messages,
    partial_text,
    synthesis,
    error,
    sendMessage,
    sendMessageWithSessionId,
    reset,
    pushAssistantGreeting,
    pushAssistantMessage,
    setStateExternal,
    clearSynthesis,
    seedConversation,
    updateSynthesisMsg
  };
}

// src/chat/TicketDetail.tsx
import { Fragment as Fragment5, jsx as jsx19, jsxs as jsxs14 } from "react/jsx-runtime";
var _ADMIN_STATUSES = [
  "open",
  "in_review",
  "in_progress",
  "waiting_for_user",
  "resolved",
  "wont_fix",
  "closed"
];
var _TERMINAL_STATUSES = /* @__PURE__ */ new Set([
  "resolved",
  "wont_fix",
  "closed"
]);
function _formatTs(dt) {
  if (!dt) return "";
  return dt.slice(0, 16).replace("T", " ");
}
function _shortId2(id) {
  if (!id || id.length <= 10) return id ?? "?";
  return `${id.slice(0, 4)}\u2026${id.slice(-4)}`;
}
function _hydrateMessages(raw) {
  if (!raw) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item;
    const role = o.role;
    const tsRaw = o.ts;
    if (role !== "user" && role !== "assistant" && role !== "admin" && role !== "synthesis")
      continue;
    if (role === "synthesis") {
      const synth = o.synthesis;
      if (!synth || typeof synth !== "object") continue;
      const tsStr = typeof tsRaw === "string" ? tsRaw : (/* @__PURE__ */ new Date()).toISOString();
      out.push({
        role: "synthesis",
        text: "",
        ts: tsStr,
        synthesis: synth,
        confirmed: o.confirmed === true
      });
      continue;
    }
    const text = o.text;
    if (typeof text !== "string") continue;
    let ts = Date.now();
    if (typeof tsRaw === "string") {
      const parsed = Date.parse(tsRaw);
      if (!Number.isNaN(parsed)) ts = parsed;
    } else if (typeof tsRaw === "number") {
      ts = tsRaw;
    }
    out.push({ role, text, ts });
  }
  return out;
}
function TicketDetail({ feedbackId, onBack }) {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();
  const detail = useFeedbackDetailQuery(feedbackId);
  const adminAction = usePostFeedbackAdminActionMutation();
  const softDelete = useSoftDeleteTicketMutation();
  const adminSoftDelete = useAdminSoftDeleteTicketMutation();
  const adminHardDelete = useAdminHardDeleteTicketMutation();
  const [hardDeleteOpen, setHardDeleteOpen] = useState9(false);
  const [hardDeleteInput, setHardDeleteInput] = useState9("");
  const uploadAttachment = useUploadChatAttachmentMutation();
  const stream = useChatRunStream({ bindings, sessionId: feedbackId });
  const isAdmin = useCanTriageFeedback();
  const isOwner = !!(detail.data && currentUser && detail.data.user_id === currentUser.id);
  const isTerminal = detail.data ? _TERMINAL_STATUSES.has(detail.data.status) : false;
  const needsUserReply = !!(detail.data && detail.data.user_action_required && isOwner);
  const hydratedRef = useRef5(null);
  useEffect7(() => {
    if (!detail.data) return;
    const key = `${detail.data.id}::${detail.data.updated_at ?? ""}::${(detail.data.messages ?? []).length}`;
    if (hydratedRef.current === key) return;
    const hydrated = _hydrateMessages(detail.data.messages ?? null);
    stream.seedConversation({
      messages: hydrated,
      nextState: "awaiting_user"
    });
    hydratedRef.current = key;
  }, [detail.data?.id, detail.data?.updated_at, detail.data?.messages?.length]);
  const [adminDraft, setAdminDraft] = useState9("");
  const onSendAdmin = () => {
    const body = adminDraft.trim();
    if (!body) return;
    adminAction.mutate(
      { feedbackId, payload: { message_text: body } },
      {
        onSuccess: () => {
          setAdminDraft("");
          hydratedRef.current = null;
        },
        onError: () => adapter.toast.error(t("feedback.comments.send_error"))
      }
    );
  };
  const onAdminStatusChange = (next) => {
    if (!detail.data || next === detail.data.status) return;
    adminAction.mutate(
      { feedbackId, payload: { to_status: next } },
      { onSuccess: () => hydratedRef.current = null }
    );
  };
  const onSendUser = async (content) => {
    await stream.sendMessage(content, "text", null, null);
    hydratedRef.current = null;
  };
  const onAttachFiles = (files) => {
    for (const f of files) {
      uploadAttachment.mutate(
        { sessionId: feedbackId, file: f },
        {
          onError: (err) => adapter.toast.error(
            err instanceof Error ? err.message : "Upload failed."
          )
        }
      );
    }
  };
  const triggerBlobDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const onDownloadOwn = async () => {
    try {
      const { blob, filename } = await downloadOwnFeedbackBundleViaBindings(
        bindings,
        feedbackId
      );
      triggerBlobDownload(blob, filename);
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Download failed."
      );
    }
  };
  const onDownloadAdmin = async () => {
    try {
      const { blob, filename } = await downloadFeedbackBundleViaBindings(
        bindings,
        feedbackId
      );
      triggerBlobDownload(blob, filename);
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Download failed."
      );
    }
  };
  const approveSynthesis = useApproveSynthesisMutation();
  const editSynthesis = useEditSynthesisMutation();
  const synthesisBusy = approveSynthesis.isPending || editSynthesis.isPending;
  const onApproveSynthesis = async (ts) => {
    try {
      await approveSynthesis.mutateAsync({
        sessionId: feedbackId,
        synthesisTs: ts
      });
      stream.updateSynthesisMsg(ts, { confirmed: true });
      hydratedRef.current = null;
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Could not approve spec."
      );
    }
  };
  const onEditSynthesis = async (ts, patch) => {
    try {
      const res = await editSynthesis.mutateAsync({
        sessionId: feedbackId,
        synthesisTs: ts,
        patch
      });
      stream.updateSynthesisMsg(ts, {
        synthesis: res.synthesis
      });
      hydratedRef.current = null;
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Could not save edit."
      );
    }
  };
  return /* @__PURE__ */ jsxs14("div", { className: "flex h-full flex-col gap-2 p-2", children: [
    /* @__PURE__ */ jsxs14("div", { className: "flex flex-col gap-1 border-b border-input/40 pb-2", children: [
      /* @__PURE__ */ jsxs14("div", { className: "flex items-center justify-between gap-2", children: [
        detail.data ? /* @__PURE__ */ jsxs14("div", { className: "flex items-center gap-2", children: [
          detail.data.user_action_required ? /* @__PURE__ */ jsx19(
            "span",
            {
              className: "inline-flex h-2 w-2 rounded-full bg-amber-500",
              title: "Action required",
              "aria-label": "Action required"
            }
          ) : null,
          /* @__PURE__ */ jsx19(StatusPill, { status: detail.data.status })
        ] }) : /* @__PURE__ */ jsx19("span", {}),
        /* @__PURE__ */ jsx19(
          "button",
          {
            type: "button",
            onClick: onBack,
            className: "text-xs text-muted-foreground hover:text-foreground",
            "data-feedback-id": "feedback.ticket_detail.back",
            children: "\u2190 Back"
          }
        )
      ] }),
      detail.data ? /* @__PURE__ */ jsxs14(Fragment5, { children: [
        /* @__PURE__ */ jsxs14("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ jsx19("code", { className: "font-mono text-[11px] text-muted-foreground", children: detail.data.ticket_code || "\u2014" }),
          /* @__PURE__ */ jsx19("h2", { className: "truncate text-sm font-semibold text-foreground", children: detail.data.title ?? /* @__PURE__ */ jsx19("span", { className: "italic text-muted-foreground", children: "(no title yet)" }) })
        ] }),
        /* @__PURE__ */ jsxs14("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground", children: [
          /* @__PURE__ */ jsxs14("span", { className: "inline-flex items-center gap-1", children: [
            /* @__PURE__ */ jsx19(User, { className: "h-3 w-3" }),
            isOwner ? "You" : /* @__PURE__ */ jsx19("code", { className: "font-mono", children: _shortId2(detail.data.user_id) })
          ] }),
          detail.data.created_at ? /* @__PURE__ */ jsxs14("span", { children: [
            "created ",
            _formatTs(detail.data.created_at)
          ] }) : null,
          detail.data.last_admin_msg_at ? /* @__PURE__ */ jsxs14("span", { className: "text-primary", children: [
            "team replied ",
            _formatTs(detail.data.last_admin_msg_at)
          ] }) : null,
          detail.data.type ? /* @__PURE__ */ jsxs14("span", { children: [
            "type: ",
            detail.data.type
          ] }) : null,
          detail.data.severity ? /* @__PURE__ */ jsxs14("span", { children: [
            "severity: ",
            detail.data.severity
          ] }) : null
        ] })
      ] }) : null
    ] }),
    detail.isLoading ? /* @__PURE__ */ jsx19("p", { className: "p-4 text-sm text-muted-foreground", children: t("feedback.mine.loading") }) : detail.isError || !detail.data ? /* @__PURE__ */ jsx19("p", { className: "p-4 text-sm text-destructive", children: t("feedback.mine.error") }) : /* @__PURE__ */ jsxs14(Fragment5, { children: [
      isAdmin ? /* @__PURE__ */ jsxs14(
        "details",
        {
          className: "rounded-md border border-primary/30 bg-primary/5 p-2",
          open: true,
          children: [
            /* @__PURE__ */ jsx19("summary", { className: "cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-primary", children: "Admin actions" }),
            /* @__PURE__ */ jsxs14("div", { className: "mt-2 flex flex-col gap-2", children: [
              /* @__PURE__ */ jsxs14("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ jsxs14("label", { className: "flex items-center gap-1 text-xs", children: [
                  /* @__PURE__ */ jsx19("span", { className: "text-muted-foreground", children: "Status" }),
                  /* @__PURE__ */ jsx19(
                    "select",
                    {
                      value: detail.data.status,
                      disabled: adminAction.isPending,
                      onChange: (e) => onAdminStatusChange(e.target.value),
                      "data-feedback-id": "feedback.ticket_detail.status_select",
                      className: "rounded-md border border-input bg-background px-1.5 py-0.5 text-xs",
                      children: _ADMIN_STATUSES.map((s) => /* @__PURE__ */ jsx19("option", { value: s, children: s }, s))
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs14(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    onClick: onDownloadAdmin,
                    "data-feedback-id": "feedback.ticket_detail.download",
                    children: [
                      /* @__PURE__ */ jsx19(Download, { className: "h-3 w-3 mr-1" }),
                      " ZIP"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs14(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    className: "text-destructive hover:bg-destructive/10",
                    disabled: adminSoftDelete.isPending,
                    onClick: () => {
                      if (confirm("Soft-delete this ticket? (reversible via /restore)")) {
                        adminSoftDelete.mutate(
                          { ticketId: feedbackId },
                          { onSuccess: onBack }
                        );
                      }
                    },
                    "data-feedback-id": "feedback.ticket_detail.delete",
                    children: [
                      /* @__PURE__ */ jsx19(Trash2, { className: "h-3 w-3 mr-1" }),
                      " Soft delete"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs14(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    className: "text-destructive border border-destructive/40 hover:bg-destructive hover:text-destructive-foreground",
                    onClick: () => {
                      setHardDeleteInput("");
                      setHardDeleteOpen(true);
                    },
                    "data-feedback-id": "feedback.ticket_detail.hard_delete",
                    children: [
                      /* @__PURE__ */ jsx19(Trash2, { className: "h-3 w-3 mr-1" }),
                      " Hard delete"
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsx19(
                Textarea,
                {
                  value: adminDraft,
                  onChange: (e) => setAdminDraft(e.target.value),
                  placeholder: "Reply as admin \xB7 this lands inside the chat and the LLM sees it on the next user turn",
                  rows: 2,
                  maxLength: 5e3,
                  disabled: adminAction.isPending,
                  "data-feedback-id": "feedback.ticket_detail.admin_draft"
                }
              ),
              /* @__PURE__ */ jsx19("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs14(
                Button,
                {
                  type: "button",
                  size: "sm",
                  onClick: onSendAdmin,
                  disabled: adminAction.isPending || adminDraft.trim().length === 0,
                  "data-feedback-id": "feedback.ticket_detail.admin_send",
                  children: [
                    /* @__PURE__ */ jsx19(Send, { className: "mr-1 h-3.5 w-3.5" }),
                    adminAction.isPending ? t("feedback.comments.sending") : "Inject into chat"
                  ]
                }
              ) })
            ] })
          ]
        }
      ) : null,
      needsUserReply ? /* @__PURE__ */ jsxs14("div", { className: "flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700", children: [
        /* @__PURE__ */ jsx19(AlertTriangle, { className: "h-4 w-4 shrink-0" }),
        /* @__PURE__ */ jsxs14("span", { children: [
          /* @__PURE__ */ jsx19("span", { className: "font-semibold", children: "The team is waiting for your reply." }),
          " ",
          "Send a message below to continue the conversation."
        ] })
      ] }) : null,
      /* @__PURE__ */ jsxs14("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [
        /* @__PURE__ */ jsx19(
          ChatTimeline,
          {
            messages: stream.messages,
            isThinking: stream.state === "bot_thinking",
            thinkingLabel: "Thinking\u2026",
            onApproveSynthesis: isOwner ? onApproveSynthesis : void 0,
            onEditSynthesis: isOwner ? onEditSynthesis : void 0,
            synthesisBusy
          }
        ),
        stream.error ? /* @__PURE__ */ jsx19("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: stream.error }) : null
      ] }),
      /* @__PURE__ */ jsx19(
        AttachmentTray,
        {
          sessionId: feedbackId,
          screenshotBlob: null,
          captureMode: "page",
          elementSelector: null,
          canRemove: isOwner,
          includeScreenshots: true
        }
      ),
      isOwner ? /* @__PURE__ */ jsxs14("div", { className: "flex items-center justify-end gap-2", children: [
        /* @__PURE__ */ jsxs14(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            className: "text-destructive hover:bg-destructive/10",
            disabled: softDelete.isPending,
            onClick: () => {
              if (confirm(
                "Delete this ticket? It will be hidden from your list. Admins can restore or permanently delete it."
              )) {
                softDelete.mutate(
                  { ticketId: feedbackId },
                  { onSuccess: onBack }
                );
              }
            },
            "data-feedback-id": "feedback.ticket_detail.delete_mine_inline",
            children: [
              /* @__PURE__ */ jsx19(Trash2, { className: "h-3 w-3 mr-1" }),
              " Delete"
            ]
          }
        ),
        /* @__PURE__ */ jsxs14(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            onClick: onDownloadOwn,
            "data-feedback-id": "feedback.ticket_detail.download_mine",
            children: [
              /* @__PURE__ */ jsx19(Download, { className: "h-3 w-3 mr-1" }),
              " Download ZIP"
            ]
          }
        )
      ] }) : null,
      isOwner && !isTerminal ? /* @__PURE__ */ jsx19(
        Composer,
        {
          onSend: onSendUser,
          disabled: stream.state === "bot_thinking",
          placeholder: needsUserReply ? "Reply to the team's question\u2026" : "Continue the conversation\u2026",
          onAttachFiles,
          attachDisabled: uploadAttachment.isPending
        }
      ) : null,
      isOwner && isTerminal ? /* @__PURE__ */ jsx19("div", { className: "flex items-center justify-end gap-2 border-t border-input/40 pt-2", children: /* @__PURE__ */ jsxs14("span", { className: "text-[10px] italic text-muted-foreground", children: [
        "Ticket is ",
        detail.data.status,
        " \u2014 closed for replies."
      ] }) }) : null
    ] }),
    hardDeleteOpen ? /* @__PURE__ */ jsx19(
      "div",
      {
        className: "fixed inset-0 z-[2147483600] flex items-center justify-center bg-black/70 p-4",
        onClick: () => setHardDeleteOpen(false),
        children: /* @__PURE__ */ jsxs14(
          "div",
          {
            className: "w-full max-w-md rounded-lg border border-destructive/50 bg-card p-5 shadow-2xl",
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsx19("h3", { className: "text-sm font-bold text-destructive", children: "Permanently delete this ticket?" }),
              /* @__PURE__ */ jsxs14("p", { className: "mt-2 text-xs text-muted-foreground", children: [
                "This drops the ticket row + every S3 attachment + the chat history. ",
                /* @__PURE__ */ jsx19("span", { className: "font-semibold", children: "Not reversible." }),
                " ",
                'Prefer "Soft delete" unless you are certain.'
              ] }),
              /* @__PURE__ */ jsxs14("p", { className: "mt-3 text-xs", children: [
                "To confirm, type ",
                /* @__PURE__ */ jsx19("code", { className: "rounded bg-muted px-1 py-0.5 font-mono text-xs", children: "DELETE" }),
                " below:"
              ] }),
              /* @__PURE__ */ jsx19(
                "input",
                {
                  type: "text",
                  value: hardDeleteInput,
                  onChange: (e) => setHardDeleteInput(e.target.value),
                  autoFocus: true,
                  className: "mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono outline-none focus:border-destructive",
                  placeholder: "DELETE",
                  "data-feedback-id": "feedback.ticket_detail.hard_delete_confirm_input"
                }
              ),
              /* @__PURE__ */ jsxs14("div", { className: "mt-4 flex justify-end gap-2", children: [
                /* @__PURE__ */ jsx19(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    onClick: () => setHardDeleteOpen(false),
                    disabled: adminHardDelete.isPending,
                    children: "Cancel"
                  }
                ),
                /* @__PURE__ */ jsxs14(
                  Button,
                  {
                    type: "button",
                    size: "sm",
                    className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    disabled: hardDeleteInput !== "DELETE" || adminHardDelete.isPending,
                    onClick: () => {
                      adminHardDelete.mutate(
                        { ticketId: feedbackId },
                        {
                          onSuccess: () => {
                            setHardDeleteOpen(false);
                            onBack();
                          },
                          onError: (err) => adapter.toast.error(
                            err instanceof Error ? err.message : "Hard delete failed."
                          )
                        }
                      );
                    },
                    "data-feedback-id": "feedback.ticket_detail.hard_delete_confirm",
                    children: [
                      /* @__PURE__ */ jsx19(Trash2, { className: "h-3 w-3 mr-1" }),
                      " Permanently delete"
                    ]
                  }
                )
              ] })
            ]
          }
        )
      }
    ) : null
  ] });
}

// src/chat/VoiceRecorder.tsx
import { Check as Check3, Loader2 as Loader22, X as X4 } from "lucide-react";
import { useEffect as useEffect8, useRef as useRef6 } from "react";
import { Fragment as Fragment6, jsx as jsx20, jsxs as jsxs15 } from "react/jsx-runtime";
var _MAX_DURATION_MS2 = 6e4;
var _BAR_MIN_PX = 3;
var _BAR_MAX_PX = 26;
function _formatMs(ms) {
  const clamped = Math.max(0, Math.min(ms, _MAX_DURATION_MS2));
  const seconds = Math.floor(clamped / 1e3);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function _Waveform({
  active,
  getAudioLevels
}) {
  const barRefs = useRef6([]);
  const rafRef = useRef6(null);
  useEffect8(() => {
    if (!active) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const loop = () => {
      const levels = getAudioLevels();
      const bars = barRefs.current;
      const last = bars.length - 1;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const level = levels[last - i] ?? 0;
        const px = Math.max(
          _BAR_MIN_PX,
          Math.round(_BAR_MIN_PX + level * (_BAR_MAX_PX - _BAR_MIN_PX))
        );
        bar.style.height = `${px}px`;
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, getAudioLevels]);
  return /* @__PURE__ */ jsx20("div", { className: "flex flex-1 items-center justify-center gap-[2px] h-8 px-2", "aria-hidden": "true", children: Array.from({ length: AUDIO_LEVEL_BARS }).map((_, i) => /* @__PURE__ */ jsx20(
    "span",
    {
      ref: (el) => {
        barRefs.current[i] = el;
      },
      className: "w-[2px] rounded-full bg-foreground/80 transition-[height] duration-75",
      style: { height: `${_BAR_MIN_PX}px` }
    },
    i
  )) });
}
function VoiceRecorder({
  state,
  duration_ms,
  getAudioLevels,
  onStop,
  onCancel
}) {
  if (state !== "recording" && state !== "stopping" && state !== "transcribing") return null;
  const isRecording = state === "recording";
  const isWorking = state === "stopping" || state === "transcribing";
  const timer = _formatMs(duration_ms);
  return /* @__PURE__ */ jsxs15(
    "output",
    {
      "aria-live": "polite",
      "aria-label": isRecording ? "Recording" : "Transcribing",
      "data-feedback-id": "feedback.voice_recorder",
      className: "flex items-center gap-2 border-t border-input bg-background px-3 py-3",
      children: [
        /* @__PURE__ */ jsx20(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            onClick: onCancel,
            disabled: isWorking,
            "aria-label": "Discard recording",
            "data-feedback-id": "feedback.voice_cancel",
            className: "rounded-full",
            children: /* @__PURE__ */ jsx20(X4, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx20("div", { className: "flex-1 flex items-center gap-2 rounded-full bg-muted/40 px-2 py-1", children: isWorking ? /* @__PURE__ */ jsxs15("div", { className: "flex flex-1 items-center justify-center gap-2 h-8 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsx20(Loader22, { className: "h-4 w-4 animate-spin" }),
          /* @__PURE__ */ jsx20("span", { children: "Transcribing\u2026" })
        ] }) : /* @__PURE__ */ jsxs15(Fragment6, { children: [
          /* @__PURE__ */ jsx20(_Waveform, { active: isRecording, getAudioLevels }),
          /* @__PURE__ */ jsx20(
            "span",
            {
              className: "shrink-0 pr-1 text-[10px] tabular-nums text-muted-foreground",
              "aria-hidden": "true",
              children: timer
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx20(
          Button,
          {
            type: "button",
            size: "sm",
            onClick: onStop,
            disabled: isWorking,
            "aria-label": "Stop and send",
            "data-feedback-id": "feedback.voice_stop",
            className: "rounded-full",
            children: /* @__PURE__ */ jsx20(Check3, { className: "h-4 w-4" })
          }
        )
      ]
    }
  );
}

// src/chat/useFeedbackChat.ts
import { useCallback as useCallback5, useEffect as useEffect9, useRef as useRef7, useState as useState10 } from "react";

// src/capture/diagnostics.ts
var MAX_CONSOLE_ENTRIES = 20;
var MAX_NETWORK_ENTRIES = 20;
var MAX_TEXT_LENGTH = 240;
var consoleRing = [];
var networkRing = [];
var installed = false;
var originalConsoleError = null;
var originalConsoleWarn = null;
var originalFetch = null;
function truncate(s) {
  return s.length > MAX_TEXT_LENGTH ? `${s.slice(0, MAX_TEXT_LENGTH - 1)}\u2026` : s;
}
function pushRing(ring, entry, cap) {
  ring.push(truncate(entry));
  while (ring.length > cap) {
    ring.shift();
  }
}
function formatArgs(args) {
  return args.map((a) => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }).join(" ");
}
function installDiagnostics() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    pushRing(consoleRing, `[error] ${formatArgs(args)}`, MAX_CONSOLE_ENTRIES);
    originalConsoleError?.(...args);
  };
  originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args) => {
    pushRing(consoleRing, `[warn] ${formatArgs(args)}`, MAX_CONSOLE_ENTRIES);
    originalConsoleWarn?.(...args);
  };
  if (typeof window.fetch === "function") {
    originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const start = performance.now();
      try {
        const resp = await originalFetch(input, init);
        if (resp.status >= 400) {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          const dur = Math.round(performance.now() - start);
          pushRing(
            networkRing,
            `${resp.status} ${init?.method ?? "GET"} ${url} (${dur}ms)`,
            MAX_NETWORK_ENTRIES
          );
        }
        return resp;
      } catch (err) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        pushRing(
          networkRing,
          `network-error ${init?.method ?? "GET"} ${url}: ${err.message}`,
          MAX_NETWORK_ENTRIES
        );
        throw err;
      }
    };
  }
}
function getDiagnosticsSnapshot() {
  return {
    console_tail: [...consoleRing],
    network_errors_tail: [...networkRing],
    framework: detectFramework()
  };
}
function detectFramework() {
  if (typeof window === "undefined") return null;
  const w = window;
  if (w.__NEXT_DATA__) return "next.js";
  if (w.__NUXT__) return "nuxt";
  if (w.__REMIX_CONTEXT__) return "remix";
  if (w.__SVELTEKIT_DEV__ || w.__sveltekit_dev) return "sveltekit";
  if (w.ng) return "angular";
  if (w.Vue) return "vue";
  if (w.React) return "react";
  return null;
}
function snapshotElementOuterHtml(el) {
  if (!el) return null;
  const raw = el.outerHTML ?? "";
  return raw.length > 4096 ? `${raw.slice(0, 4095)}\u2026` : raw;
}

// src/capture/screenshot.ts
var DEFAULT_MAX_PIXELS = 1920 * 1080 * 2;
var DEFAULT_TYPE = "image/png";
var DEFAULT_EXCLUDE_PREDICATE = (node) => node.dataset?.feedbackWidgetRoot === "true" || Boolean(node.closest?.('[data-feedback-widget-root="true"]'));
function _blackoutRedactedNodes(root, selectors) {
  const overlays = [];
  if (typeof document === "undefined") return { restore: () => void 0 };
  const matches = /* @__PURE__ */ new Set();
  for (const sel of selectors) {
    let nodes;
    try {
      nodes = root.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const n of Array.from(nodes)) {
      if (n instanceof HTMLElement) matches.add(n);
    }
  }
  for (const node of matches) {
    const rect = node.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.setAttribute("data-feedback-blackout", "true");
    overlay.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "background:#000",
      "z-index:2147483646",
      "pointer-events:none"
    ].join(";");
    document.body.appendChild(overlay);
    overlays.push(overlay);
  }
  return {
    restore() {
      for (const o of overlays) o.remove();
    }
  };
}
async function _renderToBlob(target, options) {
  const exclude = options.excludePredicate ?? DEFAULT_EXCLUDE_PREDICATE;
  const filter = (node) => {
    if (!(node instanceof HTMLElement)) return true;
    if (node.dataset?.feedbackBlackout === "true") return true;
    return !exclude(node);
  };
  const blackout = _blackoutRedactedNodes(target, options.redactionSelectors);
  try {
    const lib = await import("html-to-image");
    const blob = await lib.toBlob(target, {
      filter,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      cacheBust: true,
      pixelRatio: window.devicePixelRatio || 1,
      type: DEFAULT_TYPE
    });
    if (!blob) {
      throw new Error("Screenshot capture returned no Blob");
    }
    const rect = target.getBoundingClientRect();
    let width = Math.round(rect.width);
    let height = Math.round(rect.height);
    if (width * height > DEFAULT_MAX_PIXELS) {
      const scale = Math.sqrt(DEFAULT_MAX_PIXELS / (width * height));
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
    return { blob, width, height };
  } finally {
    blackout.restore();
  }
}
async function capturePageScreenshot(options) {
  if (typeof document === "undefined") {
    throw new Error("Screenshot capture requires a browser environment");
  }
  return _renderToBlob(document.body, options);
}
function describeElement(el) {
  const rect = el.getBoundingClientRect();
  const selector = _cssSelectorOf(el);
  const xpath = _xpathOf(el);
  const accessibleName = el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.innerText?.trim().slice(0, 80) ?? null;
  const role = el.getAttribute("role");
  const outerHtml = el.outerHTML.slice(0, 500);
  return {
    selector,
    xpath,
    tag: el.tagName.toLowerCase(),
    role,
    accessible_name: accessibleName,
    bounding_box: {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height
    },
    outer_html_excerpt: outerHtml
  };
}
function _cssSelectorOf(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let cur = el;
  while (cur && cur !== document.body && parts.length < 8) {
    let part = cur.tagName.toLowerCase();
    if (cur.classList.length > 0) {
      part += `.${Array.from(cur.classList).slice(0, 2).map((c) => CSS.escape(c)).join(".")}`;
    }
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === cur?.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}
async function cropImageBlob(source, bbox) {
  if (typeof document === "undefined") return source;
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return source;
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const scale = typeof window !== "undefined" && window.innerWidth > 0 ? img.naturalWidth / window.innerWidth : 1;
    const sx = Math.max(0, Math.round(bbox.x * scale));
    const sy = Math.max(0, Math.round(bbox.y * scale));
    const sw = Math.max(1, Math.round(bbox.w * scale));
    const sh = Math.max(1, Math.round(bbox.h * scale));
    if (sx >= img.naturalWidth || sy >= img.naturalHeight) {
      return source;
    }
    const clampedW = Math.min(sw, img.naturalWidth - sx);
    const clampedH = Math.min(sh, img.naturalHeight - sy);
    const canvas = document.createElement("canvas");
    canvas.width = clampedW;
    canvas.height = clampedH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, sx, sy, clampedW, clampedH, 0, 0, clampedW, clampedH);
    const cropped = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    return cropped ?? source;
  } catch {
    return source;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function _xpathOf(el) {
  if (typeof document === "undefined") return null;
  const segments = [];
  let node = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    const elNode = node;
    let index = 1;
    let sibling = elNode.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === elNode.tagName) index += 1;
      sibling = sibling.previousElementSibling;
    }
    segments.unshift(`${elNode.tagName.toLowerCase()}[${index}]`);
    node = elNode.parentNode;
  }
  return segments.length > 0 ? `/${segments.join("/")}` : null;
}

// src/chat/useFeedbackChat.ts
function _buildConfirmUrl(bindings, sessionId) {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/confirm`;
}
function _buildAbandonUrl(bindings, sessionId) {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/abandon`;
}
function _buildVoiceUrl(bindings, sessionId) {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/voice`;
}
function _buildAutoContext(args) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "";
  const route = typeof window !== "undefined" ? window.location.pathname + window.location.search + window.location.hash : null;
  const viewport = typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio } : null;
  const diag = getDiagnosticsSnapshot();
  return {
    url,
    route,
    viewport,
    app_version: args.appVersion || null,
    git_commit_sha: args.gitSha || null,
    user_role: args.userRole,
    framework: diag.framework,
    // Sprint D — ship navigator.userAgent so the LLM (and the
    // resulting feedback row's metadata_bundle) carry browser/OS
    // context. AutoContext pydantic caps at 512 chars; truncate
    // here to stay deterministic.
    user_agent: typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent.slice(0, 512) : null,
    console_tail: diag.console_tail,
    network_errors_tail: diag.network_errors_tail,
    // S3F shell-hybrid: forward the locked element so backend can hang
    // turn context (and downstream feedback row) off the right DOM node.
    // Sprint A Phase 2 promotes these to feedback.element_* columns.
    element_selector: args.locked?.selector ?? null,
    element_xpath: args.locked?.xpath ?? null,
    element_bounding_box: args.locked?.bounding_box ?? null,
    element_outer_html: args.locked?.outer_html ?? null
  };
}
async function _blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function useFeedbackChat() {
  const bindings = useFeedbackBindings();
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const [sessionId, setSessionId] = useState10(null);
  const stream = useChatRunStream({ bindings, sessionId });
  const [overrideState, setOverrideState] = useState10(null);
  const [openError, setOpenError] = useState10(null);
  const [pageScreenshotBlob, setPageScreenshotBlob] = useState10(null);
  const [screenshotBlob, setScreenshotBlob] = useState10(null);
  const [screenshotCleared, setScreenshotCleared] = useState10(false);
  const openingRef = useRef7(false);
  const [captureMode, setCaptureMode] = useState10("page");
  const [lockedElement, setLockedElement] = useState10(null);
  const [activeTab, setActiveTab] = useState10("compose");
  const voiceCapture = useVoiceCapture();
  const [voiceState, setVoiceState] = useState10("idle");
  const [voiceTranscript, setVoiceTranscript] = useState10("");
  const [voiceLang, setVoiceLang] = useState10("");
  const [voiceError, setVoiceError] = useState10(null);
  const [composerValue, setComposerValue] = useState10("");
  const [composerAutoFocus, setComposerAutoFocus] = useState10(false);
  const composerFromVoiceRef = useRef7(false);
  const setMode = useCallback5((mode) => {
    setCaptureMode(mode);
  }, []);
  const clearLocked = useCallback5(() => {
    setLockedElement(null);
    setCaptureMode("page");
  }, []);
  const acceptLocked = useCallback5((info) => {
    let enriched = info;
    if (info.outer_html === void 0 && typeof document !== "undefined") {
      try {
        const node = document.querySelector(info.selector);
        const html = snapshotElementOuterHtml(node);
        if (html) {
          enriched = { ...info, outer_html: html };
        }
      } catch {
      }
    }
    setLockedElement(enriched);
    setCaptureMode("element");
  }, []);
  const selectTab = useCallback5((tab) => {
    setActiveTab(tab);
  }, []);
  const GREETING_CAPTURE = "Tell me what's on your mind.";
  const _createSessionLazily = useCallback5(async () => {
    const auto_context = _buildAutoContext({
      appVersion: adapter.appVersion,
      gitSha: adapter.gitSha,
      userRole: user?.role ?? null,
      locked: lockedElement
    });
    const base = bindings.apiBaseUrl.replace(/\/$/, "");
    const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
    const url = `${base}${prefix}/chat/sessions`;
    const headers = { "Content-Type": "application/json" };
    try {
      const csrf = await bindings.getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
    } catch {
    }
    if (bindings.authHeader) {
      try {
        const auth = await bindings.authHeader();
        if (auth) headers.Authorization = auth;
      } catch {
      }
    }
    const resp = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ mode: "capture", auto_context })
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`create session failed (${resp.status}): ${detail || resp.statusText}`);
    }
    const body = await resp.json();
    setSessionId(body.session_id);
    return body.session_id;
  }, [adapter.appVersion, adapter.gitSha, bindings, user?.role, lockedElement]);
  const openSheet = useCallback5(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    installDiagnostics();
    setOverrideState("opening");
    setOpenError(null);
    try {
      try {
        const result = await capturePageScreenshot({
          redactionSelectors: DEFAULT_REDACTION_SELECTORS
        });
        if (result?.blob) {
          setScreenshotCleared(false);
          setPageScreenshotBlob(result.blob);
          setScreenshotBlob(result.blob);
        }
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[feedback-chat] screenshot capture failed", err);
        }
      }
      stream.pushAssistantGreeting(GREETING_CAPTURE);
      setOverrideState(null);
    } catch (err) {
      setOpenError(String(err.message ?? err));
      setOverrideState("error");
    } finally {
      openingRef.current = false;
    }
  }, [stream]);
  const closeSheet = useCallback5(() => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    setComposerValue("");
    setComposerAutoFocus(false);
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceError(null);
    setVoiceState("idle");
    setScreenshotBlob(null);
    setPageScreenshotBlob(null);
    setScreenshotCleared(false);
    openingRef.current = false;
  }, [stream]);
  const clearScreenshot = useCallback5(() => {
    setScreenshotBlob(null);
    setPageScreenshotBlob(null);
    setScreenshotCleared(true);
  }, []);
  useEffect9(() => {
    if (screenshotCleared || !pageScreenshotBlob) return;
    let cancelled = false;
    const bbox = lockedElement?.bounding_box;
    if (captureMode === "element" && bbox && bbox.w > 0 && bbox.h > 0) {
      void cropImageBlob(pageScreenshotBlob, bbox).then((cropped) => {
        if (!cancelled) setScreenshotBlob(cropped);
      });
    } else {
      setScreenshotBlob(pageScreenshotBlob);
    }
    return () => {
      cancelled = true;
    };
  }, [captureMode, lockedElement, pageScreenshotBlob, screenshotCleared]);
  const sendUserMessage = useCallback5(
    async (content) => {
      const via = composerFromVoiceRef.current ? "voice" : "text";
      composerFromVoiceRef.current = false;
      setComposerValue("");
      let activeSid = sessionId;
      if (!activeSid) {
        try {
          activeSid = await _createSessionLazily();
        } catch (err) {
          setOpenError(String(err.message ?? err));
          stream.setStateExternal("error");
          return;
        }
      }
      let screenshotB64 = null;
      let screenshotCt = null;
      if (screenshotBlob) {
        try {
          screenshotB64 = await _blobToBase64(screenshotBlob);
          screenshotCt = screenshotBlob.type || "image/png";
        } catch {
          screenshotB64 = null;
        }
      }
      await stream.sendMessageWithSessionId(
        activeSid,
        content,
        via,
        screenshotB64,
        screenshotCt
      );
    },
    [stream, screenshotBlob, sessionId, _createSessionLazily]
  );
  const confirmSynthesis = useCallback5(async () => {
    if (!sessionId) {
      setOpenError("session not initialised");
      stream.setStateExternal("error");
      return;
    }
    stream.setStateExternal("finalizing");
    try {
      const url = _buildConfirmUrl(bindings, sessionId);
      const headers = { "Content-Type": "application/json" };
      try {
        const csrf = await bindings.getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
      }
      if (bindings.authHeader) {
        try {
          const auth = await bindings.authHeader();
          if (auth) headers.Authorization = auth;
        } catch {
        }
      }
      let screenshotB64 = null;
      if (screenshotBlob) {
        try {
          screenshotB64 = await _blobToBase64(screenshotBlob);
        } catch (err) {
          if (typeof console !== "undefined") {
            console.warn("[feedback-chat] screenshot encode failed", err);
          }
        }
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          synthesis_override: null,
          screenshot_b64: screenshotB64,
          screenshot_content_type: screenshotB64 ? "image/png" : null
        })
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const data = await resp.json();
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
        }
        const msg = `No pudimos registrar tu feedback (${resp.status}). ${detail}`;
        setOpenError(msg);
        stream.setStateExternal("error");
        try {
          adapter.toast?.error?.(msg);
        } catch {
        }
        return;
      }
      const body = await resp.json();
      const ticket = body.ticket_code || "FB-?";
      stream.pushAssistantMessage(
        `\u2713 \xA1Gracias! Tu feedback es ${ticket}. Te avisaremos cuando lo veamos.`
      );
      stream.setStateExternal("done");
    } catch (err) {
      const msg = String(err.message ?? err);
      setOpenError(msg);
      stream.setStateExternal("error");
      try {
        adapter.toast?.error?.(msg);
      } catch {
      }
    }
  }, [bindings, stream, sessionId, adapter, screenshotBlob]);
  const abandonSession = useCallback5(async () => {
    if (!sessionId) return;
    try {
      const url = _buildAbandonUrl(bindings, sessionId);
      const headers = {};
      try {
        const csrf = await bindings.getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
      }
      if (bindings.authHeader) {
        try {
          const auth = await bindings.authHeader();
          if (auth) headers.Authorization = auth;
        } catch {
        }
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers
      });
      if (!resp.ok && typeof console !== "undefined") {
        console.warn(`[feedback-chat] abandon failed (${resp.status})`);
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[feedback-chat] abandon network error", err);
      }
    }
  }, [bindings, sessionId]);
  const loadConversation = useCallback5(
    async (item) => {
      if (item.kind === "submitted") {
        const code = item.ticket_code ?? "\u2014";
        const status = item.status ?? "\u2014";
        const text = `Este es el ticket ${code} \u2014 ${item.title}. Estado: ${status}. (Los comentarios inline llegan en S3E.)`;
        setSessionId(null);
        stream.seedConversation({
          messages: [{ role: "assistant", text, ts: Date.now() }],
          synthesis: null,
          nextState: "awaiting_user"
        });
        setOverrideState(null);
        setOpenError(null);
        return;
      }
      const sid = item.session_id;
      if (!sid) {
        setOpenError("session id missing on previous conversation item");
        setOverrideState("error");
        return;
      }
      setOverrideState("opening");
      setOpenError(null);
      try {
        const base = bindings.apiBaseUrl.replace(/\/$/, "");
        const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
        const url = `${base}${prefix}/chat/sessions/${encodeURIComponent(sid)}`;
        const headers = {};
        try {
          const csrf = await bindings.getCsrfToken();
          if (csrf) headers["X-CSRF-Token"] = csrf;
        } catch {
        }
        if (bindings.authHeader) {
          try {
            const auth = await bindings.authHeader();
            if (auth) headers.Authorization = auth;
          } catch {
          }
        }
        const resp = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new Error(`resume session failed (${resp.status}): ${detail || resp.statusText}`);
        }
        const body = await resp.json();
        const messages = [];
        for (const m of body.messages ?? []) {
          if (m.role === "synthesis") {
            const synth2 = m.synthesis;
            if (!synth2 || typeof synth2 !== "object") continue;
            const tsStr = typeof m.ts === "string" ? m.ts : (/* @__PURE__ */ new Date()).toISOString();
            messages.push({
              role: "synthesis",
              text: "",
              ts: tsStr,
              synthesis: synth2,
              confirmed: m.confirmed === true
            });
            continue;
          }
          const role = m.role === "user" || m.role === "assistant" || m.role === "admin" ? m.role : null;
          if (!role) continue;
          const text = typeof m.text === "string" ? m.text : "";
          const ts = typeof m.ts === "string" ? Date.parse(m.ts) || Date.now() : Date.now();
          const msg = { role, text, ts };
          if (role === "assistant") {
            if (m.mode === "discover" || m.mode === "synthesize") msg.mode = m.mode;
            if (typeof m.active_branch === "string") msg.active_branch = m.active_branch;
            if (m.covered && typeof m.covered === "object") {
              msg.covered = m.covered;
            }
            if (m.inferred && typeof m.inferred === "object") {
              msg.inferred = m.inferred;
            }
          }
          messages.push(msg);
        }
        const synth = body.synthesis_json ?? null;
        const nextState = synth && body.status === "awaiting_confirm" ? "confirming" : "awaiting_user";
        setSessionId(sid);
        stream.seedConversation({ messages, synthesis: synth, nextState });
        setOverrideState(null);
      } catch (err) {
        setOpenError(String(err.message ?? err));
        setOverrideState("error");
      }
    },
    [bindings, stream]
  );
  const newConversation = useCallback5(async () => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    await openSheet();
  }, [stream, openSheet]);
  const adjustSynthesis = useCallback5(() => {
    stream.clearSynthesis();
    stream.pushAssistantMessage("\xBFQu\xE9 cambiar\xEDas del resumen?");
    stream.setStateExternal("awaiting_user");
  }, [stream]);
  const startVoice = useCallback5(async () => {
    setVoiceError(null);
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceState("recording");
    await voiceCapture.startRecording();
    if (voiceCapture.state === "error" || voiceCapture.error) {
      setVoiceError(voiceCapture.error ?? "Microphone unavailable");
      setVoiceState("error");
    }
  }, [voiceCapture]);
  const cancelVoice = useCallback5(() => {
    voiceCapture.cancelRecording();
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceError(null);
    setVoiceState("idle");
  }, [voiceCapture]);
  const stopVoice = useCallback5(async () => {
    if (!sessionId) {
      setVoiceError("session not initialised");
      setVoiceState("error");
      return;
    }
    const result = await voiceCapture.stopRecording();
    if (!result || result.blob.size === 0) {
      setVoiceState("idle");
      return;
    }
    setVoiceState("transcribing");
    try {
      const url = _buildVoiceUrl(bindings, sessionId);
      const headers = {};
      try {
        const csrf = await bindings.getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
      }
      if (bindings.authHeader) {
        try {
          const auth = await bindings.authHeader();
          if (auth) headers.Authorization = auth;
        } catch {
        }
      }
      const form = new FormData();
      const ext = result.mime_type.includes("mp4") ? "m4a" : result.mime_type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", result.blob, `clip.${ext}`);
      if (voiceLang) {
        form.append("language_hint", voiceLang);
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: form
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const data = await resp.json();
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
        }
        const msg = `Voice transcription failed (${resp.status}): ${detail}`;
        setVoiceError(msg);
        setVoiceState("error");
        return;
      }
      const body = await resp.json();
      const transcript = body.transcript ?? "";
      const lang = body.lang ?? "";
      setVoiceTranscript(transcript);
      setVoiceLang(lang);
      if (transcript.length > 0) {
        setComposerValue((current) => {
          if (current.trim().length === 0) return transcript;
          return `${current.replace(/\s+$/, "")} ${transcript}`;
        });
        setComposerAutoFocus(true);
        composerFromVoiceRef.current = true;
      }
      setVoiceState("idle");
    } catch (err) {
      const msg = String(err.message ?? err);
      setVoiceError(msg);
      setVoiceState("error");
    }
  }, [bindings, sessionId, voiceCapture]);
  const confirmVoiceTranscript = useCallback5(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setVoiceState("idle");
        return;
      }
      setVoiceTranscript("");
      setVoiceLang("");
      setVoiceState("idle");
      await stream.sendMessage(trimmed, "voice");
    },
    [stream]
  );
  const setComposerValueCb = useCallback5((next) => {
    setComposerValue((current) => {
      if (next !== current) {
        composerFromVoiceRef.current = false;
      }
      return next;
    });
  }, []);
  useEffect9(() => {
    if (!composerAutoFocus) return;
    const id = window.requestAnimationFrame(() => {
      setComposerAutoFocus(false);
    });
    return () => window.cancelAnimationFrame(id);
  }, [composerAutoFocus]);
  const effectiveState = overrideState ?? stream.state;
  const effectiveError = openError ?? stream.error;
  return {
    state: effectiveState,
    messages: stream.messages,
    partialText: stream.partial_text,
    synthesis: stream.synthesis,
    updateSynthesisMsg: stream.updateSynthesisMsg,
    error: effectiveError,
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    abandonSession,
    adjustSynthesis,
    loadConversation,
    newConversation,
    captureMode,
    lockedElement,
    activeTab,
    screenshotBlob,
    clearScreenshot,
    setMode,
    clearLocked,
    acceptLocked,
    selectTab,
    voiceState,
    voiceDurationMs: voiceCapture.duration_ms,
    voiceTranscript,
    voiceLang,
    voiceError,
    getVoiceAudioLevels: voiceCapture.getAudioLevels,
    startVoice,
    stopVoice,
    confirmVoiceTranscript,
    cancelVoice,
    composerValue,
    setComposerValue: setComposerValueCb,
    composerAutoFocus,
    /** Active ticket / chat-session id once openSheet succeeded.
     *  Null before the first turn lands. Exposed so the Composer can
     *  attach files to it via the S9 upload endpoint. */
    sessionId
  };
}

// src/chat/FeedbackChatSheet.tsx
import { Fragment as Fragment7, jsx as jsx21, jsxs as jsxs16 } from "react/jsx-runtime";
function _thinkingLabel(state) {
  if (state === "synthesizing") return "Sintetizando\u2026";
  if (state === "opening") return "Preparando\u2026";
  return void 0;
}
function _isThinking(state) {
  return state === "bot_thinking" || state === "synthesizing" || state === "opening";
}
function _showFooter(state) {
  return state === "confirming" || state === "synthesizing" || state === "finalizing" || state === "error";
}
function _showComposer(state) {
  return state === "awaiting_user" || state === "user_typing" || state === "bot_thinking";
}
function FeedbackChatSheet({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const chat = useFeedbackChat();
  const mineCount = useMyTicketsTotalCount();
  const mineActionRequired = useMyPendingActionCount();
  const resize = useResizableSheet();
  const uploadAttachment = useUploadChatAttachmentMutation();
  const approveSynthesis = useApproveSynthesisMutation();
  const editSynthesis = useEditSynthesisMutation();
  const {
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    abandonSession,
    adjustSynthesis,
    newConversation,
    state,
    messages,
    error,
    synthesis,
    captureMode,
    lockedElement,
    activeTab,
    screenshotBlob,
    clearScreenshot,
    setMode,
    clearLocked: clearHookLocked,
    acceptLocked,
    selectTab,
    voiceState,
    voiceDurationMs,
    voiceError,
    getVoiceAudioLevels,
    startVoice,
    stopVoice,
    cancelVoice,
    composerValue,
    setComposerValue,
    composerAutoFocus,
    sessionId: activeSessionId,
    updateSynthesisMsg
  } = chat;
  const [selectedFeedbackId, setSelectedFeedbackId] = useState11(null);
  useEffect10(() => {
    if (activeTab !== "mine") setSelectedFeedbackId(null);
  }, [activeTab]);
  useEffect10(() => {
    if (open) {
      void openSheet();
    } else {
      closeSheet();
    }
  }, [open]);
  useEffect10(() => {
    if (locked) acceptLocked(locked);
    else clearHookLocked();
  }, [locked]);
  useEffect10(() => {
    if (state !== "done") return;
    const tid = window.setTimeout(() => onOpenChange(false), 3e3);
    return () => window.clearTimeout(tid);
  }, [state, onOpenChange]);
  const handleOpenChange = useCallback6(
    (next) => {
      if (!next && state !== "done" && state !== "idle") {
        void abandonSession();
      }
      onOpenChange(next);
    },
    [state, abandonSession, onOpenChange]
  );
  const synthesisBusy = approveSynthesis.isPending || editSynthesis.isPending;
  const onApproveSynthesis = useCallback6(
    async (ts) => {
      if (!activeSessionId) return;
      let screenshotB64 = null;
      let screenshotCt = null;
      if (screenshotBlob) {
        try {
          const buf = await screenshotBlob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (const b of bytes) bin += String.fromCharCode(b);
          screenshotB64 = btoa(bin);
          screenshotCt = screenshotBlob.type || "image/png";
        } catch {
          screenshotB64 = null;
        }
      }
      try {
        await approveSynthesis.mutateAsync({
          sessionId: activeSessionId,
          synthesisTs: ts,
          screenshotB64,
          screenshotContentType: screenshotCt
        });
        updateSynthesisMsg(ts, { confirmed: true });
      } catch (err) {
        adapter.toast.error(
          err instanceof Error ? err.message : "Could not approve spec."
        );
      }
    },
    [
      activeSessionId,
      approveSynthesis,
      updateSynthesisMsg,
      adapter.toast,
      screenshotBlob
    ]
  );
  const onEditSynthesis = useCallback6(
    async (ts, patch) => {
      if (!activeSessionId) return;
      try {
        const res = await editSynthesis.mutateAsync({
          sessionId: activeSessionId,
          synthesisTs: ts,
          patch
        });
        updateSynthesisMsg(ts, {
          synthesis: res.synthesis
        });
      } catch (err) {
        adapter.toast.error(
          err instanceof Error ? err.message : "Could not save edit."
        );
      }
    },
    [activeSessionId, editSynthesis, updateSynthesisMsg, adapter.toast]
  );
  void synthesis;
  return /* @__PURE__ */ jsx21(Sheet, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsxs16(
    SheetContent,
    {
      side: "right",
      widthPx: resize.width,
      isDragging: resize.isDragging,
      onResizeStart: resize.isMobile ? void 0 : resize.startResize,
      className: "rl3-feedback-scope dark flex h-full flex-col gap-0 border-l border-input/50 bg-background/95 backdrop-blur-xl p-0 shadow-2xl",
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs16(SheetHeader, { className: "border-b border-input/60 px-4 pt-4 pb-3", children: [
          /* @__PURE__ */ jsxs16(SheetTitle, { className: "flex items-center gap-2 text-base", children: [
            /* @__PURE__ */ jsx21(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx21("span", { children: t("feedback.panel_title") })
          ] }),
          /* @__PURE__ */ jsx21(SheetDescription, { className: "sr-only", children: t("feedback.panel_description") })
        ] }),
        /* @__PURE__ */ jsxs16("div", { className: "flex items-center gap-2 px-4 pt-3 pb-2", children: [
          /* @__PURE__ */ jsx21("div", { className: "flex-1 min-w-0", children: /* @__PURE__ */ jsx21(
            FeedbackTabs,
            {
              activeTab,
              mineTotalCount: mineCount,
              unreadAdminRepliesCount: mineActionRequired,
              onTabChange: selectTab
            }
          ) }),
          activeTab === "compose" ? /* @__PURE__ */ jsx21(
            CapturePicker,
            {
              mode: captureMode,
              locked: lockedElement,
              onActivatePicker,
              onClearLocked,
              onModeChange: setMode,
              compact: true
            }
          ) : null
        ] }),
        activeTab === "compose" ? /* @__PURE__ */ jsxs16(Fragment7, { children: [
          /* @__PURE__ */ jsxs16("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [
            /* @__PURE__ */ jsx21(
              ChatTimeline,
              {
                messages,
                isThinking: _isThinking(state),
                thinkingLabel: _thinkingLabel(state),
                onApproveSynthesis,
                onEditSynthesis,
                synthesisBusy
              }
            ),
            error ? /* @__PURE__ */ jsx21("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: error }) : null,
            voiceError ? /* @__PURE__ */ jsx21("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: voiceError }) : null
          ] }),
          /* @__PURE__ */ jsx21(
            AttachmentTray,
            {
              sessionId: activeSessionId,
              screenshotBlob,
              captureMode,
              elementSelector: lockedElement?.selector ?? null,
              onClearScreenshot: clearScreenshot
            }
          ),
          voiceState === "recording" || voiceState === "transcribing" ? /* @__PURE__ */ jsx21(
            VoiceRecorder,
            {
              state: voiceState === "transcribing" ? "transcribing" : "recording",
              duration_ms: voiceDurationMs,
              getAudioLevels: getVoiceAudioLevels,
              onStop: () => void stopVoice(),
              onCancel: cancelVoice
            }
          ) : _showComposer(state) ? /* @__PURE__ */ jsx21(
            Composer,
            {
              onSend: sendUserMessage,
              disabled: state === "bot_thinking",
              onVoiceToggle: () => void startVoice(),
              onAttachFiles: activeSessionId ? (files) => {
                for (const f of files) {
                  uploadAttachment.mutate(
                    { sessionId: activeSessionId, file: f },
                    {
                      onError: (err) => {
                        adapter.toast.error(
                          err instanceof Error ? err.message : "Could not upload the file."
                        );
                      }
                    }
                  );
                }
              } : void 0,
              attachDisabled: uploadAttachment.isPending,
              value: composerValue,
              onValueChange: setComposerValue,
              autoFocus: composerAutoFocus
            }
          ) : null,
          _showFooter(state) ? /* @__PURE__ */ jsx21(
            FooterActions,
            {
              state,
              onConfirm: () => void confirmSynthesis(),
              onAdjust: adjustSynthesis,
              onRetry: () => void newConversation()
            }
          ) : null
        ] }) : /* @__PURE__ */ jsx21("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-4", children: selectedFeedbackId ? /* @__PURE__ */ jsx21(
          TicketDetail,
          {
            feedbackId: selectedFeedbackId,
            onBack: () => setSelectedFeedbackId(null)
          }
        ) : /* @__PURE__ */ jsx21(MineFeedTab, { onSelectFeedback: (fid) => setSelectedFeedbackId(fid) }) })
      ]
    }
  ) });
}

export {
  redactString,
  DEFAULT_API_PATH_PREFIX,
  SubmitFeedbackError,
  createAdapter,
  FeedbackProvider,
  useFeedbackAdapter,
  useFeedbackConfig,
  useFeedbackBindings,
  useCanTriageFeedback,
  Rl3Mark,
  describeElement,
  useMyPendingActionCount,
  CapturePicker,
  SynthesisCard,
  FeedbackTabs,
  FooterActions,
  StatusPill,
  MineFeedTab,
  newIdempotencyKey,
  TicketDetail,
  FeedbackChatSheet
};
//# sourceMappingURL=chunk-Q47BSZRO.js.map