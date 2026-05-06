// src/adapter.ts
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { useMemo as useMemo2 } from "react";

// src/FeedbackProvider.tsx
import { createContext, useContext, useMemo } from "react";
import { jsx } from "react/jsx-runtime";
var _ENV_ENABLED = (import.meta.env.VITE_FEEDBACK_ENABLED ?? "true").toString().toLowerCase() !== "false";
var _ENV_POSITION = import.meta.env.VITE_FEEDBACK_POSITION ?? "bottom_right";
var _ENV_BRAND = import.meta.env.VITE_FEEDBACK_BRAND_PRIMARY_HEX || "";
var _ENV_LOCALE = "en";
var DEFAULT_CONFIG = Object.freeze({
  enabled: _ENV_ENABLED,
  position: _ENV_POSITION,
  brandPrimaryHex: _ENV_BRAND,
  locale: _ENV_LOCALE
});
var FeedbackContext = createContext(null);
function FeedbackProvider({ children, bindings, adapter, config }) {
  if (!bindings || typeof bindings.useCurrentUser !== "function") {
    throw new Error(
      "FeedbackProvider: `bindings` prop is required and must include `useCurrentUser`. See @rl3/feedback-widget README for the FeedbackHostBindings contract."
    );
  }
  const value = useMemo(
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
  "feedback.panel_description": "Tell us what's happening, what you'd expect instead, and attach anything that helps. We capture page URL and basic context to help triage.",
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
function redactBundle(value) {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactBundle);
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactBundle(v);
    }
    return out;
  }
  return value;
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
  return b.apiPathPrefix ?? "/api/v1/feedback";
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
async function _patchJson(bindings, path, body) {
  const headers = await _buildHeaders(bindings, {
    "Content-Type": "application/json"
  });
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    await _throwApiError(`PATCH ${path}`, resp);
  }
  return await resp.json();
}
async function _deleteJson(bindings, path) {
  const headers = await _buildHeaders(bindings);
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    await _throwApiError(`DELETE ${path}`, resp);
  }
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
  return useMemo2(() => createTranslator({ locale: config.locale }), [config.locale]);
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
function useUpdateFeedbackStatusMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => _patchJson(bindings, `/${encodeURIComponent(input.id)}/status`, {
      status: input.status,
      triage_note: input.triage_note ?? null
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    }
  });
}
function useDeleteFeedbackMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => _deleteJson(bindings, `/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    }
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
function useFeedbackCommentsQuery(feedbackId) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "comments", feedbackId],
    queryFn: () => feedbackId ? _getJson(
      bindings,
      `/${encodeURIComponent(feedbackId)}/comments`
    ) : Promise.resolve({
      data: [],
      count: 0
    }),
    enabled: !!feedbackId,
    refetchInterval: 3e4,
    staleTime: 15e3
  });
}
function usePostFeedbackCommentMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => _postJson(
      bindings,
      `/${encodeURIComponent(input.feedbackId)}/comments`,
      { body: input.body }
    ),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "comments", input.feedbackId]
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

// src/client/iter.ts
var IterApiError = class extends Error {
  constructor(status, path, detail, retryAfter) {
    super(`${path} failed with ${status}`);
    this.status = status;
    this.path = path;
    this.detail = detail;
    this.retryAfter = retryAfter;
    this.name = "IterApiError";
  }
  status;
  path;
  detail;
  retryAfter;
};
function _base(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
function _prefix(b) {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}
async function _headers(b, extra = {}) {
  const out = { ...extra };
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
async function _throwOn(path, resp) {
  let detail;
  try {
    const data = await resp.json();
    detail = typeof data === "string" ? data : data && typeof data === "object" && "detail" in data ? String(data.detail) : JSON.stringify(data);
  } catch {
    detail = await resp.text().catch(() => "");
  }
  throw new IterApiError(
    resp.status,
    path,
    detail,
    resp.headers.get("Retry-After")
  );
}
function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `k_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
async function startIterSession(bindings, body) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...await _headers(bindings)
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function getIterSession(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function listIterSessionsForFeedback(bindings, feedbackId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/feedbacks/${feedbackId}/sessions`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function abandonIterSession(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/abandon`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function listIterVersions(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/iterations`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function editIterVersionMarkdown(bindings, sessionId, versionId, body) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/iterations/${versionId}/markdown`;
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...await _headers(bindings)
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function listIterAssumptions(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/assumptions`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function resolveIterAssumption(bindings, assumptionId, body) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/assumptions/${assumptionId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...await _headers(bindings)
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function finalizeIterSession(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/finalize`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...await _headers(bindings)
    },
    body: JSON.stringify({})
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function getIterPackage(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/package`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function runIterationStream(opts) {
  const url = `${_base(opts.bindings)}${_prefix(opts.bindings)}/iterate/sessions/${opts.sessionId}/iterations`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": opts.idempotencyKey,
      ...await _headers(opts.bindings)
    },
    body: JSON.stringify(opts.body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  if (!resp.body) {
    throw new IterApiError(resp.status, url, "no response body", null);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const evt = _parseSseFrame(raw);
      if (evt) opts.onEvent(evt);
      split = buffer.indexOf("\n\n");
    }
  }
}
function _parseSseFrame(frame) {
  if (frame.startsWith(":")) {
    return { type: "heartbeat" };
  }
  let event = null;
  let data = null;
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data = (data ?? "") + line.slice(5).trim();
    }
  }
  if (!event || data === null) return null;
  try {
    const parsed = JSON.parse(data);
    return {
      type: event,
      ...parsed
    };
  } catch {
    return null;
  }
}

// src/ui/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/ui/button.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx2(
    Comp,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}

// src/ui/textarea.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
function Textarea({ className, ...props }) {
  return /* @__PURE__ */ jsx3(
    "textarea",
    {
      "data-slot": "textarea",
      className: cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

export {
  redactBundle,
  SubmitFeedbackError,
  FeedbackApiError,
  useFeedbackListQuery,
  useMyFeedbackQuery,
  useFeedbackDetailQuery,
  useUpdateFeedbackStatusMutation,
  useDeleteFeedbackMutation,
  useFeedbackCommentsQuery,
  usePostFeedbackCommentMutation,
  createAdapter,
  FeedbackProvider,
  useFeedbackAdapter,
  useFeedbackConfig,
  useFeedbackBindings,
  IterApiError,
  newIdempotencyKey,
  startIterSession,
  getIterSession,
  listIterSessionsForFeedback,
  abandonIterSession,
  listIterVersions,
  editIterVersionMarkdown,
  listIterAssumptions,
  resolveIterAssumption,
  finalizeIterSession,
  getIterPackage,
  runIterationStream,
  cn,
  Button,
  Textarea
};
//# sourceMappingURL=chunk-4JYIKY4G.js.map