import {
  Badge,
  CommentThread,
  Input,
  Rl3Mark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  captureElementScreenshot,
  capturePageScreenshot,
  getConsoleTail,
  getErrorsTail,
  getNetworkSuccessTail,
  getNetworkTail
} from "./chunk-Q3HXJY7X.js";
import {
  AssumptionCard,
  RenderedMarkdown,
  StreamingSkeleton,
  modelLatencyHint,
  useIterRunStream
} from "./chunk-BUIWLOT4.js";
import {
  Button,
  SubmitFeedbackError,
  Textarea,
  abandonIterSession,
  cn,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  listIterAssumptions,
  listIterVersions,
  redactBundle,
  resolveIterAssumption,
  startIterSession,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig,
  useMyFeedbackQuery
} from "./chunk-QB73WXKP.js";

// src/FeedbackPanel.tsx
import { useState as useState7 } from "react";

// src/Canvas.tsx
import { ChevronDown as ChevronDown2, ChevronUp, Sparkles as Sparkles2 } from "lucide-react";
import { useCallback, useEffect as useEffect5, useRef as useRef3, useState as useState6 } from "react";

// src/Compose.tsx
import { Send, Sparkles } from "lucide-react";
import { useEffect as useEffect2, useMemo as useMemo2, useState as useState2 } from "react";

// src/capture/breadcrumbs.ts
var _buffer = [];
function getBreadcrumbs() {
  return [..._buffer];
}

// src/capture/metadata.ts
function _readNavigationTiming() {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return {
      ttfb_ms: null,
      dom_content_loaded_ms: null,
      load_event_end_ms: null,
      dom_interactive_ms: null
    };
  }
  try {
    const entries = performance.getEntriesByType("navigation");
    const nav = entries[0];
    if (!nav) {
      return {
        ttfb_ms: null,
        dom_content_loaded_ms: null,
        load_event_end_ms: null,
        dom_interactive_ms: null
      };
    }
    return {
      ttfb_ms: nav.responseStart > 0 && nav.requestStart > 0 ? Math.round(nav.responseStart - nav.requestStart) : null,
      dom_content_loaded_ms: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
      load_event_end_ms: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
      dom_interactive_ms: nav.domInteractive ? Math.round(nav.domInteractive) : null
    };
  } catch {
    return {
      ttfb_ms: null,
      dom_content_loaded_ms: null,
      load_event_end_ms: null,
      dom_interactive_ms: null
    };
  }
}
function _readConnectionInfo() {
  if (typeof navigator === "undefined") return null;
  const conn = navigator.connection;
  if (!conn) return null;
  return {
    effective_type: typeof conn.effectiveType === "string" ? conn.effectiveType : null,
    downlink_mbps: typeof conn.downlink === "number" ? conn.downlink : null,
    rtt_ms: typeof conn.rtt === "number" ? conn.rtt : null,
    save_data: typeof conn.saveData === "boolean" ? conn.saveData : null
  };
}
function _readPageInfo() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { title: "", referrer: "", age_ms: 0 };
  }
  const age = typeof performance !== "undefined" && performance.timeOrigin ? Math.round(Date.now() - performance.timeOrigin) : 0;
  return {
    title: document.title || "",
    referrer: document.referrer || "",
    age_ms: age
  };
}
function _readMemoryInfo() {
  if (typeof performance === "undefined") return null;
  const mem = performance.memory;
  if (!mem) return null;
  return {
    used_js_heap_size: mem.usedJSHeapSize,
    total_js_heap_size: mem.totalJSHeapSize,
    js_heap_size_limit: mem.jsHeapSizeLimit
  };
}
function buildMetadataBundle(args) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "";
  const documentHeight = typeof document !== "undefined" && document.documentElement ? document.documentElement.scrollHeight : 0;
  const visibilityState = typeof document !== "undefined" && document.visibilityState ? document.visibilityState : "";
  const viewport = typeof window !== "undefined" ? {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio,
    scroll_y: window.scrollY,
    document_height: documentHeight,
    visibility_state: visibilityState
  } : {
    w: 0,
    h: 0,
    dpr: 1,
    scroll_y: 0,
    document_height: 0,
    visibility_state: ""
  };
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform ?? "" : "";
  const locale = typeof navigator !== "undefined" ? navigator.language : "";
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  })();
  const raw = {
    url,
    route_name: args.routeName,
    viewport,
    user_agent: ua,
    platform,
    locale,
    timezone,
    app_version: args.appVersion,
    git_commit_sha: args.gitSha,
    current_user: args.user ? { id: args.user.id, email: args.user.email, role: args.user.role } : null,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    console_tail: getConsoleTail(),
    network_tail: getNetworkTail(),
    network_successes: getNetworkSuccessTail(),
    errors_tail: getErrorsTail(),
    breadcrumbs: getBreadcrumbs(),
    selected_element: args.selectedElement,
    feature_flags: args.featureFlags ?? {},
    timing: _readNavigationTiming(),
    connection: _readConnectionInfo(),
    page: _readPageInfo(),
    memory: _readMemoryInfo()
  };
  return redactBundle(raw);
}

// src/ui/label.tsx
import * as LabelPrimitive from "@radix-ui/react-label";
import { jsx } from "react/jsx-runtime";
function Label({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    LabelPrimitive.Root,
    {
      "data-slot": "label",
      className: cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      ),
      ...props
    }
  );
}

// src/forms/AttachmentsField.tsx
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var MAX_ATTACHMENTS = 5;
var MAX_BYTES = 10 * 1024 * 1024;
var ALLOWED_MIMES = /* @__PURE__ */ new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/x-ndjson"
]);
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".log",
  ".md",
  ".json",
  ".ndjson"
]);
var ACCEPT_ATTR = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".log",
  ".md",
  ".json",
  ".ndjson",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/x-ndjson"
].join(",");
function _formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function _isImage(file) {
  return file.type.startsWith("image/");
}
function _hasAllowedExtension(filename) {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}
function _isMimeAllowed(file) {
  if (file.type && ALLOWED_MIMES.has(file.type)) return true;
  if ((file.type === "" || file.type === "application/octet-stream") && _hasAllowedExtension(file.name)) {
    return true;
  }
  return false;
}
function AttachmentsField({
  value,
  onChange,
  error
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const previews = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const f of value) {
      if (_isImage(f)) {
        map.set(f, URL.createObjectURL(f));
      }
    }
    return map;
  }, [value]);
  useEffect(() => {
    return () => {
      for (const url of previews.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previews]);
  const acceptIncoming = (files) => {
    const incoming = Array.from(files);
    const accepted = [];
    const room = MAX_ATTACHMENTS - value.length;
    if (room <= 0) {
      adapter.toast.error(t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) }));
      return;
    }
    let truncated = false;
    for (const file of incoming) {
      if (accepted.length >= room) {
        truncated = true;
        break;
      }
      if (file.size > MAX_BYTES) {
        adapter.toast.error(
          t("feedback.attachments.too_big", {
            name: file.name,
            max: "10 MB"
          })
        );
        continue;
      }
      if (!_isMimeAllowed(file)) {
        adapter.toast.error(t("feedback.attachments.bad_type", { name: file.name }));
        continue;
      }
      accepted.push(file);
    }
    if (truncated) {
      adapter.toast.error(t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) }));
    }
    if (accepted.length > 0) {
      onChange([...value, ...accepted]);
    }
  };
  const onPick = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      acceptIncoming(e.target.files);
      e.target.value = "";
    }
  };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptIncoming(e.dataTransfer.files);
    }
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const removeAt = (index) => {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs(Label, { htmlFor: "feedback-attachments", title: t("feedback.attachments.hint"), children: [
      t("feedback.attachments.label"),
      /* @__PURE__ */ jsx2(
        "span",
        {
          className: "ml-1 cursor-help text-[11px] text-muted-foreground",
          "aria-label": t("feedback.attachments.hint"),
          children: "\u24D8"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => inputRef.current?.click(),
        onDragOver,
        onDragLeave,
        onDrop,
        "aria-label": t("feedback.attachments.dropzone"),
        className: `w-full cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors
          ${dragActive ? "border-primary bg-primary/5 text-foreground" : error ? "border-destructive bg-destructive/5 text-destructive" : "border-input bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`,
        "data-feedback-id": "feedback.attachments.dropzone",
        children: [
          /* @__PURE__ */ jsx2("p", { children: t("feedback.attachments.dropzone") }),
          /* @__PURE__ */ jsx2("p", { className: "mt-1 text-[11px] text-muted-foreground", children: t("feedback.attachments.hint") }),
          /* @__PURE__ */ jsx2(
            "input",
            {
              ref: inputRef,
              id: "feedback-attachments",
              type: "file",
              multiple: true,
              accept: ACCEPT_ATTR,
              onChange: onPick,
              className: "hidden"
            }
          )
        ]
      }
    ),
    error ? /* @__PURE__ */ jsx2("p", { className: "text-xs text-destructive", children: error }) : null,
    value.length > 0 ? /* @__PURE__ */ jsx2("ul", { className: "space-y-1.5", children: value.map((file, index) => {
      const previewUrl = previews.get(file);
      return /* @__PURE__ */ jsxs(
        "li",
        {
          className: "flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-xs",
          children: [
            previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              /* @__PURE__ */ jsx2(
                "img",
                {
                  src: previewUrl,
                  alt: file.name,
                  className: "h-8 w-8 shrink-0 rounded object-cover"
                }
              )
            ) : _isImage(file) ? /* @__PURE__ */ jsx2(ImageIcon, { className: "h-4 w-4 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx2(FileText, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
            /* @__PURE__ */ jsx2("span", { className: "flex-1 truncate", children: file.name }),
            /* @__PURE__ */ jsx2("span", { className: "text-[11px] text-muted-foreground", children: _formatBytes(file.size) }),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: () => removeAt(index),
                className: "rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                "aria-label": t("feedback.attachments.remove", {
                  name: file.name
                }),
                "data-feedback-id": "feedback.attachments.remove",
                children: /* @__PURE__ */ jsx2(X, { className: "h-3.5 w-3.5" })
              }
            )
          ]
        },
        `${file.name}-${index}`
      );
    }) }) : null
  ] });
}

// src/forms/types.ts
var TYPE_DEFS = [
  {
    key: "bug",
    labelKey: "feedback.type.bug",
    hintKey: "feedback.type.bug_hint"
  },
  {
    key: "ui",
    labelKey: "feedback.type.ui",
    hintKey: "feedback.type.ui_hint"
  },
  {
    key: "performance",
    labelKey: "feedback.type.performance",
    hintKey: "feedback.type.performance_hint"
  },
  {
    key: "new_feature",
    labelKey: "feedback.type.new_feature",
    hintKey: "feedback.type.new_feature_hint"
  },
  {
    key: "extend_feature",
    labelKey: "feedback.type.extend_feature",
    hintKey: "feedback.type.extend_feature_hint"
  },
  {
    key: "other",
    labelKey: "feedback.type.other",
    hintKey: "feedback.type.other_hint"
  }
];

// src/forms/FeedbackForm.tsx
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var EMPTY_FORM = {
  type: null,
  title: "",
  description: "",
  expected_outcome: "",
  attachments: []
};
var _RequiredMark = () => /* @__PURE__ */ jsx3("span", { "aria-hidden": "true", className: "ml-0.5 text-destructive", children: "*" });
function FeedbackForm({
  values,
  onChange,
  errors = {}
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const setField = (key, val) => {
    onChange({ ...values, [key]: val });
  };
  const handleTypeChange = (next) => {
    if (next === values.type) return;
    onChange({ ...values, type: next });
  };
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx3(
        Label,
        {
          htmlFor: "feedback-type",
          className: "text-xs uppercase tracking-wide text-muted-foreground",
          children: t("feedback.type_label")
        }
      ),
      /* @__PURE__ */ jsxs2(
        Select,
        {
          value: values.type ?? "",
          onValueChange: (v) => handleTypeChange(v),
          children: [
            /* @__PURE__ */ jsx3(
              SelectTrigger,
              {
                id: "feedback-type",
                "data-feedback-id": "feedback.type_select",
                "aria-required": "true",
                children: /* @__PURE__ */ jsx3(SelectValue, { placeholder: t("feedback.type_placeholder") })
              }
            ),
            /* @__PURE__ */ jsx3(SelectContent, { children: TYPE_DEFS.map((def) => /* @__PURE__ */ jsx3(
              SelectItem,
              {
                value: def.key,
                title: t(def.hintKey),
                "data-feedback-id": `feedback.type.${def.key}`,
                children: t(def.labelKey)
              },
              def.key
            )) })
          ]
        }
      )
    ] }),
    values.type ? /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs2(Label, { htmlFor: "feedback-title", title: t("feedback.field.title_hint"), children: [
          t("feedback.field.title"),
          /* @__PURE__ */ jsx3(_RequiredMark, {})
        ] }),
        /* @__PURE__ */ jsx3(
          Input,
          {
            id: "feedback-title",
            value: values.title,
            onChange: (e) => setField("title", e.target.value),
            placeholder: t("feedback.field.title_placeholder"),
            "data-feedback-id": "feedback.field.title",
            maxLength: 200,
            "aria-invalid": !!errors.title,
            "aria-required": "true",
            className: errors.title ? "border-destructive ring-1 ring-destructive" : ""
          }
        ),
        errors.title ? /* @__PURE__ */ jsx3("p", { className: "text-xs text-destructive", children: errors.title }) : null
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs2(Label, { htmlFor: "feedback-description", children: [
          t("feedback.field.description"),
          /* @__PURE__ */ jsx3(_RequiredMark, {})
        ] }),
        /* @__PURE__ */ jsx3(
          Textarea,
          {
            id: "feedback-description",
            value: values.description,
            onChange: (e) => setField("description", e.target.value),
            placeholder: t("feedback.field.description_placeholder"),
            rows: 5,
            "data-feedback-id": "feedback.field.description",
            "aria-invalid": !!errors.description,
            "aria-required": "true",
            className: errors.description ? "border-destructive ring-1 ring-destructive" : ""
          }
        ),
        errors.description ? /* @__PURE__ */ jsx3("p", { className: "text-xs text-destructive", children: errors.description }) : null
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs2(Label, { htmlFor: "feedback-expected-outcome", children: [
          t("feedback.field.expected_outcome"),
          /* @__PURE__ */ jsxs2("span", { className: "ml-1 text-[11px] text-muted-foreground", children: [
            "(",
            t("feedback.optional"),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsx3(
          Textarea,
          {
            id: "feedback-expected-outcome",
            value: values.expected_outcome,
            onChange: (e) => setField("expected_outcome", e.target.value),
            placeholder: t("feedback.field.expected_outcome_placeholder"),
            rows: 3,
            "data-feedback-id": "feedback.field.expected_outcome"
          }
        )
      ] }),
      /* @__PURE__ */ jsx3(
        AttachmentsField,
        {
          value: values.attachments,
          onChange: (next) => setField("attachments", next),
          error: errors.attachments
        }
      ),
      /* @__PURE__ */ jsx3("p", { className: "text-[11px] text-muted-foreground", children: t("feedback.metadata_disclosure") })
    ] }) : null
  ] });
}

// src/Compose.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function Compose({
  locked,
  onActivatePicker,
  onClearLocked,
  onSubmitted
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [values, setValues] = useState2(() => ({ ...EMPTY_FORM }));
  const [mode, setMode] = useState2(locked ? "element" : "page");
  const [submitting, setSubmitting] = useState2(false);
  const [submittingWithIter, setSubmittingWithIter] = useState2(false);
  const [fieldErrors, setFieldErrors] = useState2({});
  useEffect2(() => {
    if (locked) setMode("element");
  }, [locked]);
  useEffect2(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    const cleared = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (k === "title" && values.title.trim()) continue;
      if (k === "description" && values.description.trim()) continue;
      cleared[k] = v;
    }
    if (Object.keys(cleared).length !== Object.keys(fieldErrors).length) {
      setFieldErrors(cleared);
    }
  }, [values, fieldErrors]);
  const selectorInfo = useMemo2(() => {
    if (!locked) return null;
    return {
      selector: locked.info.selector,
      xpath: locked.info.xpath,
      bounding_box: { ...locked.info.bounding_box }
    };
  }, [locked]);
  const validate = () => {
    if (!values.type) return { ok: false, reason: "type" };
    if (!values.title.trim()) return { ok: false, reason: "title" };
    if (!values.description.trim()) return { ok: false, reason: "description" };
    return { ok: true };
  };
  const captureScreenshot = async () => {
    const opts = { redactionSelectors: adapter.getDefaultRedactionSelectors() };
    try {
      if (mode === "element" && locked?.el) {
        return await captureElementScreenshot(locked.el, opts);
      }
      return await capturePageScreenshot(opts);
    } catch {
      adapter.toast.error(t("feedback.toast_screenshot_failed"));
      return null;
    }
  };
  const onSubmit = async (opts) => {
    const thenIterate = opts?.thenIterate ?? false;
    const v = validate();
    if (!v.ok) {
      const reason = v.reason;
      const fieldLabel = (() => {
        switch (reason) {
          case "type":
            return t("feedback.type_label");
          case "title":
            return t("feedback.field.title");
          case "description":
            return t("feedback.field.description");
          default:
            return reason;
        }
      })();
      const message = t("feedback.toast_error_required_field", { field: fieldLabel });
      setFieldErrors({ [reason]: message });
      adapter.toast.error(message);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    setSubmittingWithIter(thenIterate);
    try {
      const shotPromise = (async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return captureScreenshot();
      })();
      const shot = await shotPromise;
      const metadata = buildMetadataBundle({
        routeName: typeof window !== "undefined" ? window.location.pathname : null,
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        user: null,
        selectedElement: locked?.info ?? null
      });
      const payload = {
        type: values.type,
        title: values.title.trim(),
        description: values.description,
        expected_outcome: values.expected_outcome.trim() || null,
        url_captured: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "",
        route_name: typeof window !== "undefined" ? window.location.pathname : null,
        element: selectorInfo,
        metadata_bundle: metadata,
        app_version: adapter.appVersion,
        git_commit_sha: adapter.gitSha,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null
      };
      const created = await adapter.submitFeedback(
        JSON.stringify(payload),
        shot?.blob ?? null,
        values.attachments
      );
      const link = adapter.getDeepLinkToFeedback(created.id);
      const ticketLabel = created.ticket_code || created.id.slice(0, 8);
      adapter.toast.success(t("feedback.toast_success", { id: ticketLabel }), {
        url: link,
        actionLabel: t("feedback.toast_success_link")
      });
      setValues({ ...EMPTY_FORM });
      onClearLocked();
      setMode("page");
      onSubmitted(created.id, { thenIterate });
    } catch (err) {
      if (err instanceof SubmitFeedbackError && err.status === 429) {
        const seconds = err.retryAfter ?? "?";
        adapter.toast.error(t("feedback.toast_error_429", { seconds: String(seconds) }));
      } else {
        adapter.toast.error(t("feedback.toast_error_generic"));
      }
    } finally {
      setSubmitting(false);
      setSubmittingWithIter(false);
    }
  };
  return /* @__PURE__ */ jsxs3("div", { className: "rounded-md border border-input bg-background p-3 space-y-3 shadow-sm", children: [
    /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx4("span", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: t("feedback.mode_label") }),
      /* @__PURE__ */ jsx4(
        Button,
        {
          type: "button",
          variant: mode === "page" ? "default" : "outline",
          size: "sm",
          onClick: () => {
            setMode("page");
            onClearLocked();
          },
          "data-feedback-id": "feedback.mode_whole_page",
          children: t("feedback.mode_whole_page")
        }
      ),
      /* @__PURE__ */ jsx4(
        Button,
        {
          type: "button",
          variant: mode === "element" ? "default" : "outline",
          size: "sm",
          onClick: onActivatePicker,
          "data-feedback-id": "feedback.mode_select_element",
          children: t("feedback.mode_select_element")
        }
      ),
      mode === "element" && locked ? /* @__PURE__ */ jsxs3("span", { className: "ml-auto inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px]", children: [
        /* @__PURE__ */ jsx4("code", { className: "font-mono truncate max-w-[180px]", children: locked.info.selector }),
        /* @__PURE__ */ jsx4(
          "button",
          {
            type: "button",
            onClick: () => {
              onClearLocked();
              setMode("page");
            },
            className: "text-primary underline-offset-2 hover:underline",
            "data-feedback-id": "feedback.clear_element",
            children: "\u2715"
          }
        )
      ] }) : null
    ] }),
    /* @__PURE__ */ jsx4(FeedbackForm, { values, onChange: setValues, errors: fieldErrors }),
    /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap justify-end gap-2 pt-1", children: [
      /* @__PURE__ */ jsxs3(
        Button,
        {
          type: "button",
          variant: "outline",
          onClick: () => onSubmit({ thenIterate: false }),
          disabled: submitting || !values.type,
          "data-feedback-id": "feedback.submit",
          size: "sm",
          children: [
            /* @__PURE__ */ jsx4(Send, { className: "h-3.5 w-3.5" }),
            submitting && !submittingWithIter ? t("feedback.submitting") : t("feedback.submit")
          ]
        }
      ),
      /* @__PURE__ */ jsxs3(
        Button,
        {
          type: "button",
          onClick: () => onSubmit({ thenIterate: true }),
          disabled: submitting || !values.type,
          "data-feedback-id": "feedback.submit-and-iterate",
          title: "Submit the feedback and immediately open the inline AI iteration",
          size: "sm",
          children: [
            /* @__PURE__ */ jsx4(Sparkles, { className: "h-3.5 w-3.5" }),
            submitting && submittingWithIter ? "Submitting\u2026" : "Send and Iterate"
          ]
        }
      )
    ] })
  ] });
}

// src/iter/InlineIterPane.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X as X2 } from "lucide-react";
import { useMemo as useMemo3, useState as useState3 } from "react";

// src/iter/forbiddenWords.ts
var defaultForbiddenWords = [
  // Networking / API
  "endpoint",
  "asynchronous",
  "synchronous",
  "backend",
  "frontend",
  "middleware",
  "webhook",
  "websocket",
  "grpc",
  // Caching / perf
  "debounce",
  "throttle",
  "ttl",
  "gzip",
  "deserialization",
  "serialization",
  // Auth / security
  "jwt",
  "oauth",
  "csrf",
  "xss",
  "sql injection",
  // Storage / data
  "json",
  "yaml",
  "schema",
  "migration",
  "foreign key",
  "sql",
  "orm",
  "dao",
  // Concurrency
  "race condition",
  "mutex",
  "coroutine",
  "event loop",
  // Frontend internals
  "dom",
  "query selector",
  "hydration",
  "ssr",
  "csr",
  // Build / deploy
  "config file",
  "env var",
  "environment variable",
  "ci/cd",
  "kernel",
  "syscall"
];
var _cachedRegex = null;
var _cachedKey = null;
var _NEVER_MATCHES = /a^/;
function _buildRegex(words) {
  const sorted = [...words].filter((w) => w?.trim()).map((w) => w.trim().toLowerCase()).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return _NEVER_MATCHES;
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  try {
    return new RegExp(`(?<![A-Za-z0-9])(?:${escaped.join("|")})(?![A-Za-z0-9])`, "i");
  } catch {
    return _NEVER_MATCHES;
  }
}
function containsForbidden(text, words) {
  if (!text || words.length === 0) return false;
  const key = words.join("|");
  if (_cachedKey !== key || _cachedRegex === null) {
    _cachedRegex = _buildRegex(words);
    _cachedKey = key;
  }
  try {
    return _cachedRegex.test(text);
  } catch {
    return false;
  }
}

// src/iter/InlineIterPane.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var SKIP_MARKER = "__skip_inferred__";
function InlineIterPane({ sessionId, onClose }) {
  const bindings = useFeedbackBindings();
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ["iter-session", sessionId],
    queryFn: () => getIterSession(bindings, sessionId),
    refetchInterval: 5e3
  });
  const versions = useQuery({
    queryKey: ["iter-versions", sessionId],
    queryFn: () => listIterVersions(bindings, sessionId),
    enabled: !!session.data
  });
  const assumptions = useQuery({
    queryKey: ["iter-assumptions", sessionId],
    queryFn: () => listIterAssumptions(bindings, sessionId),
    enabled: !!session.data?.current_iteration_id
  });
  const stream = useIterRunStream(bindings, sessionId);
  const resolveMutation = useMutation({
    mutationFn: ({
      assumptionId,
      body
    }) => resolveIterAssumption(bindings, assumptionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  });
  const finalizeMutation = useMutation({
    mutationFn: () => finalizeIterSession(bindings, sessionId),
    onSuccess: (pkg) => {
      qc.setQueryData(["iter-package", sessionId], pkg);
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    }
  });
  const abandonMutation = useMutation({
    mutationFn: () => abandonIterSession(bindings, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    }
  });
  const pkgQuery = useQuery({
    queryKey: ["iter-package", sessionId],
    queryFn: () => getIterPackage(bindings, sessionId),
    enabled: session.data?.status === "finalized"
  });
  const userFacing = useMemo3(() => {
    const out = [];
    for (const a of assumptions.data ?? []) {
      if (a.kind === "technical") continue;
      const haystack = `${a.statement}
${a.rationale}`;
      if (containsForbidden(haystack, defaultForbiddenWords)) {
        console.warn("[iter] hid jargon-leaking assumption", a.slot_key);
        continue;
      }
      out.push(a);
    }
    return out;
  }, [assumptions.data]);
  const openAssumptions = userFacing.filter((a) => a.status === "open");
  const otherAssumptions = userFacing.filter((a) => a.status !== "open");
  const focused = openAssumptions[0] ?? null;
  const remainingOpen = openAssumptions.slice(1);
  const sess = session.data;
  const status = sess?.status ?? "loading";
  const isStreaming = stream.state.status === "running";
  const isComplete = !!sess?.is_complete;
  const remainingTurns = sess?.remaining_turns ?? 0;
  const maxTurns = sess?.max_turns ?? 0;
  const usedTurns = Math.max(0, maxTurns - remainingTurns);
  const turnBudgetSpent = maxTurns > 0 && remainingTurns <= 0;
  const streamBudgetExhausted = stream.state.status === "error" && stream.state.errorCode === "turn_budget_exhausted";
  const [msg, setMsg] = useState3("");
  const handleSkip = (a) => resolveMutation.mutateAsync({
    assumptionId: a.id,
    body: { status: "irrelevant", user_response: SKIP_MARKER }
  });
  const onMarkReady = () => {
    if (openAssumptions.length === 0) {
      void finalizeMutation.mutateAsync();
      return;
    }
    void finalizeMutation.mutateAsync();
  };
  if (status === "loading") {
    return /* @__PURE__ */ jsx5("div", { className: "rounded-md border border-input bg-card p-3 text-xs text-muted-foreground", children: "Loading iter session\u2026" });
  }
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: "rounded-md border border-primary/30 bg-card p-3 space-y-3 text-xs",
      "data-feedback-id": "iter.inline-pane",
      children: [
        /* @__PURE__ */ jsxs4("header", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx5("span", { className: "font-semibold", children: "Iterate with AI" }),
          maxTurns > 0 && /* @__PURE__ */ jsxs4("span", { className: "rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground", children: [
            "Round ",
            Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns),
            " of ",
            maxTurns
          ] }),
          isStreaming && /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-1 text-[11px] text-primary", children: [
            /* @__PURE__ */ jsx5(Loader2, { className: "h-3 w-3 animate-spin" }),
            " writing\u2026"
          ] }),
          isComplete && /* @__PURE__ */ jsx5("span", { className: "rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-900", children: "Spec ready" }),
          onClose && /* @__PURE__ */ jsxs4(
            Button,
            {
              size: "sm",
              variant: "ghost",
              onClick: onClose,
              className: "ml-auto h-6 px-2 text-[11px]",
              children: [
                /* @__PURE__ */ jsx5(X2, { className: "h-3 w-3" }),
                " Close"
              ]
            }
          )
        ] }),
        isComplete && sess?.completion_reason && /* @__PURE__ */ jsxs4("p", { className: "rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900", children: [
          /* @__PURE__ */ jsx5("strong", { className: "font-semibold", children: "Why ready: " }),
          sess.completion_reason
        ] }),
        focused ? /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx5(
            AssumptionCard,
            {
              assumption: focused,
              disabled: status === "finalized" || status === "abandoned",
              onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: focused.id, body }),
              onSkip: () => handleSkip(focused)
            }
          ),
          remainingOpen.length > 0 && /* @__PURE__ */ jsxs4("details", { className: "rounded border bg-muted/40 p-2", children: [
            /* @__PURE__ */ jsxs4("summary", { className: "cursor-pointer font-medium", children: [
              "More to review (",
              remainingOpen.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx5("div", { className: "mt-2 space-y-2", children: remainingOpen.map((a) => /* @__PURE__ */ jsx5(
              AssumptionCard,
              {
                assumption: a,
                disabled: status === "finalized" || status === "abandoned",
                onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: a.id, body }),
                onSkip: () => handleSkip(a)
              },
              a.id
            )) })
          ] })
        ] }) : status !== "finalized" && status !== "abandoned" ? /* @__PURE__ */ jsx5("p", { className: "text-muted-foreground", children: versions.data?.length ? "All assumptions on this round are resolved. Run another iteration to refresh the spec, or mark it ready if you're happy with it." : "Run the first iteration to see the AI's draft and any assumptions it needs you to confirm." }) : null,
        otherAssumptions.length > 0 && /* @__PURE__ */ jsxs4("details", { className: "rounded border bg-muted/40 p-2", children: [
          /* @__PURE__ */ jsxs4("summary", { className: "cursor-pointer font-medium", children: [
            "Resolved (",
            otherAssumptions.length,
            ")"
          ] }),
          /* @__PURE__ */ jsx5("div", { className: "mt-2 space-y-2", children: otherAssumptions.map((a) => /* @__PURE__ */ jsx5(
            AssumptionCard,
            {
              assumption: a,
              disabled: status === "finalized" || status === "abandoned",
              onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: a.id, body }),
              onSkip: () => handleSkip(a)
            },
            a.id
          )) })
        ] }),
        (stream.state.errorMessage || streamBudgetExhausted) && stream.state.status === "error" && /* @__PURE__ */ jsx5("div", { className: "rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900", children: streamBudgetExhausted ? "You've used all the iteration rounds for this spec. Mark it ready or abandon the session." : stream.state.errorMessage }),
        status === "finalized" && pkgQuery.data?.presigned_zip_url && /* @__PURE__ */ jsx5(
          "a",
          {
            href: pkgQuery.data.presigned_zip_url,
            download: true,
            className: "inline-block text-primary underline",
            children: "Download package ZIP"
          }
        ),
        status !== "finalized" && status !== "abandoned" && /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
          !turnBudgetSpent && !isComplete && /* @__PURE__ */ jsx5(
            Textarea,
            {
              value: msg,
              onChange: (e) => setMsg(e.target.value),
              placeholder: "Optional: anything else for the next iteration?",
              rows: 2,
              disabled: isStreaming
            }
          ),
          /* @__PURE__ */ jsxs4("div", { className: "flex flex-wrap items-center gap-2", children: [
            !turnBudgetSpent && !isComplete && /* @__PURE__ */ jsx5(
              Button,
              {
                size: "sm",
                disabled: isStreaming || openAssumptions.length > 0,
                onClick: () => {
                  stream.start({ user_message: msg, restructure_allowed: false });
                  setMsg("");
                },
                title: openAssumptions.length > 0 ? "Resolve the open assumption(s) first" : "Run the next iteration",
                children: isStreaming ? "Running\u2026" : "Run iteration"
              }
            ),
            /* @__PURE__ */ jsx5(
              Button,
              {
                size: "sm",
                variant: turnBudgetSpent || isComplete ? "default" : "secondary",
                onClick: onMarkReady,
                disabled: !sess?.current_iteration_id || finalizeMutation.isPending || isStreaming,
                title: "Finalize the spec and produce the developer package",
                children: finalizeMutation.isPending ? "Marking ready\u2026" : "Mark ready"
              }
            ),
            /* @__PURE__ */ jsx5(
              Button,
              {
                size: "sm",
                variant: "ghost",
                onClick: () => abandonMutation.mutate(),
                disabled: abandonMutation.isPending || isStreaming,
                className: "text-muted-foreground",
                children: "Abandon"
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/iter/IterFocusView.tsx
import { useMutation as useMutation2, useQuery as useQuery2, useQueryClient as useQueryClient2 } from "@tanstack/react-query";
import { ArrowLeft, Loader2 as Loader22 } from "lucide-react";
import { useEffect as useEffect4, useMemo as useMemo4, useRef as useRef2, useState as useState5 } from "react";

// src/iter/IterContextPanel.tsx
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect as useEffect3, useState as useState4 } from "react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var _STORAGE_PREFIX = "rl3-iter-context-open:";
function _readPersistedOpen(feedbackId) {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(_STORAGE_PREFIX + feedbackId) === "1";
  } catch {
    return false;
  }
}
function _writePersistedOpen(feedbackId, open) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(_STORAGE_PREFIX + feedbackId, open ? "1" : "0");
  } catch {
  }
}
function IterContextPanel({
  feedback,
  defaultOpen = false
}) {
  const fbId = feedback?.id ?? "";
  const [open, setOpen] = useState4(
    () => fbId ? _readPersistedOpen(fbId) || defaultOpen : defaultOpen
  );
  useEffect3(() => {
    if (!fbId) return;
    _writePersistedOpen(fbId, open);
  }, [fbId, open]);
  if (!feedback) {
    return /* @__PURE__ */ jsx6("div", { className: "rounded-md border border-input bg-muted/30 p-2 text-[11px] text-muted-foreground", children: "Loading original feedback\u2026" });
  }
  const screenshot = feedback.attachments?.find(
    (a) => a.kind === "screenshot"
  );
  const userAttachments = (feedback.attachments ?? []).filter(
    (a) => a.kind !== "screenshot"
  );
  return /* @__PURE__ */ jsxs5(
    "details",
    {
      className: "rounded-md border border-input bg-card text-xs",
      open,
      onToggle: (e) => setOpen(e.target.open),
      children: [
        /* @__PURE__ */ jsxs5("summary", { className: "flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-accent rounded-md select-none", children: [
          open ? /* @__PURE__ */ jsx6(ChevronDown, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx6(ChevronRight, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsx6("span", { className: "font-medium", children: "Contexto original" }),
          /* @__PURE__ */ jsx6("code", { className: "ml-auto rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground", children: feedback.ticket_code || "\u2014" })
        ] }),
        /* @__PURE__ */ jsxs5("div", { className: "border-t border-input px-3 py-3 space-y-3", children: [
          screenshot?.presigned_url ? /* @__PURE__ */ jsx6(
            "a",
            {
              href: screenshot.presigned_url,
              target: "_blank",
              rel: "noreferrer",
              className: "block",
              title: "Open full-size screenshot",
              children: /* @__PURE__ */ jsx6(
                "img",
                {
                  src: screenshot.presigned_url,
                  alt: "Screenshot at submission time",
                  className: "w-full rounded border border-input object-contain max-h-64",
                  loading: "lazy"
                }
              )
            }
          ) : null,
          /* @__PURE__ */ jsxs5("section", { children: [
            /* @__PURE__ */ jsx6("h4", { className: "mb-1 font-semibold text-foreground", children: "T\xEDtulo" }),
            /* @__PURE__ */ jsx6("p", { className: "whitespace-pre-wrap", children: feedback.title })
          ] }),
          /* @__PURE__ */ jsxs5("section", { children: [
            /* @__PURE__ */ jsx6("h4", { className: "mb-1 font-semibold text-foreground", children: "Description" }),
            /* @__PURE__ */ jsx6("p", { className: "whitespace-pre-wrap", children: feedback.description || /* @__PURE__ */ jsx6("span", { className: "italic text-muted-foreground", children: "(no description)" }) })
          ] }),
          feedback.expected_outcome ? /* @__PURE__ */ jsxs5("section", { children: [
            /* @__PURE__ */ jsx6("h4", { className: "mb-1 font-semibold text-foreground", children: "Expected outcome" }),
            /* @__PURE__ */ jsx6("p", { className: "whitespace-pre-wrap", children: feedback.expected_outcome })
          ] }) : null,
          userAttachments.length > 0 ? /* @__PURE__ */ jsxs5("section", { children: [
            /* @__PURE__ */ jsxs5("h4", { className: "mb-1 font-semibold text-foreground", children: [
              "Attachments (",
              userAttachments.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx6("ul", { className: "space-y-1", children: userAttachments.map((a) => /* @__PURE__ */ jsxs5(
              "li",
              {
                className: "flex items-center gap-2 rounded border border-input bg-background p-1.5",
                children: [
                  /* @__PURE__ */ jsx6("span", { className: "flex-1 truncate font-mono text-[11px]", children: a.filename ?? a.kind }),
                  /* @__PURE__ */ jsxs5("span", { className: "text-muted-foreground shrink-0 text-[10px]", children: [
                    (a.byte_size / 1024).toFixed(1),
                    " KB"
                  ] }),
                  a.presigned_url ? /* @__PURE__ */ jsx6(
                    "a",
                    {
                      href: a.presigned_url,
                      target: "_blank",
                      rel: "noreferrer",
                      className: "shrink-0 text-primary hover:underline text-[11px]",
                      children: "Open"
                    }
                  ) : null
                ]
              },
              a.id
            )) })
          ] }) : null
        ] })
      ]
    }
  );
}

// src/iter/IterFocusView.tsx
import { Fragment as Fragment2, jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var SKIP_MARKER2 = "__skip_inferred__";
function IterFocusView({ sessionId, feedbackId, onExit }) {
  const bindings = useFeedbackBindings();
  const qc = useQueryClient2();
  const session = useQuery2({
    queryKey: ["iter-session", sessionId],
    queryFn: () => getIterSession(bindings, sessionId),
    refetchInterval: 5e3
  });
  const versions = useQuery2({
    queryKey: ["iter-versions", sessionId],
    queryFn: () => listIterVersions(bindings, sessionId),
    enabled: !!session.data
  });
  const assumptions = useQuery2({
    queryKey: ["iter-assumptions", sessionId],
    queryFn: () => listIterAssumptions(bindings, sessionId),
    enabled: !!session.data?.current_iteration_id
  });
  const myFeedback = useMyFeedbackQuery(25);
  const feedback = useMemo4(
    () => (myFeedback.data ?? []).find((f) => f.id === feedbackId),
    [myFeedback.data, feedbackId]
  );
  const stream = useIterRunStream(bindings, sessionId);
  const resolveMutation = useMutation2({
    mutationFn: ({
      assumptionId,
      body
    }) => resolveIterAssumption(bindings, assumptionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  });
  const finalizeMutation = useMutation2({
    mutationFn: () => finalizeIterSession(bindings, sessionId),
    onSuccess: (pkg) => {
      qc.setQueryData(["iter-package", sessionId], pkg);
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    }
  });
  const abandonMutation = useMutation2({
    mutationFn: () => abandonIterSession(bindings, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    }
  });
  const pkgQuery = useQuery2({
    queryKey: ["iter-package", sessionId],
    queryFn: () => getIterPackage(bindings, sessionId),
    enabled: session.data?.status === "finalized"
  });
  useEffect4(() => {
    if (stream.state.status === "done" && stream.state.versionId) {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  }, [stream.state.status, stream.state.versionId, qc, sessionId]);
  const status = session.data?.status ?? "loading";
  const onExitRef = useRef2(onExit);
  useEffect4(() => {
    onExitRef.current = onExit;
  }, [onExit]);
  useEffect4(() => {
    if (status === "abandoned") {
      const id = window.setTimeout(() => onExitRef.current(), 1200);
      return () => window.clearTimeout(id);
    }
    return void 0;
  }, [status]);
  const userFacing = useMemo4(
    () => (assumptions.data ?? []).filter((a) => a.kind !== "technical"),
    [assumptions.data]
  );
  const visibleAssumptions = useMemo4(() => {
    const out = [];
    for (const a of userFacing) {
      const haystack = `${a.statement}
${a.rationale}`;
      if (containsForbidden(haystack, defaultForbiddenWords)) {
        console.warn("[iter] hid jargon-leaking assumption", a.slot_key);
        continue;
      }
      out.push(a);
    }
    return out;
  }, [userFacing]);
  const openAssumptions = visibleAssumptions.filter((a) => a.status === "open");
  const otherAssumptions = visibleAssumptions.filter((a) => a.status !== "open");
  const focused = openAssumptions[0] ?? null;
  const remainingOpen = openAssumptions.slice(1);
  const sess = session.data;
  const isStreaming = stream.state.status === "running";
  const isComplete = !!sess?.is_complete;
  const remainingTurns = sess?.remaining_turns ?? 0;
  const maxTurns = sess?.max_turns ?? 0;
  const usedTurns = Math.max(0, maxTurns - remainingTurns);
  const turnBudgetSpent = maxTurns > 0 && remainingTurns <= 0;
  const streamBudgetExhausted = stream.state.status === "error" && stream.state.errorCode === "turn_budget_exhausted";
  const latestVersion = useMemo4(() => {
    const list = versions.data ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.version_number - a.version_number)[0] ?? null;
  }, [versions.data]);
  const renderedMarkdown = isStreaming ? "" : latestVersion?.output_markdown ?? "";
  const [msg, setMsg] = useState5("");
  const handleSkip = (a) => resolveMutation.mutateAsync({
    assumptionId: a.id,
    body: { status: "irrelevant", user_response: SKIP_MARKER2 }
  });
  const onMarkReady = () => {
    void finalizeMutation.mutateAsync();
  };
  const modelHint = modelLatencyHint(
    sess?.current_primary_model_id ?? sess?.last_call_model_id ?? sess?.model_id ?? ""
  );
  return /* @__PURE__ */ jsxs6("div", { className: "flex h-full flex-col gap-3", "data-feedback-id": "iter.focus-view", children: [
    /* @__PURE__ */ jsxs6("header", { className: "flex items-center gap-2 border-b border-input pb-2", children: [
      /* @__PURE__ */ jsxs6(Button, { size: "sm", variant: "ghost", onClick: onExit, className: "-ml-2 h-7 px-2", children: [
        /* @__PURE__ */ jsx7(ArrowLeft, { className: "h-3.5 w-3.5" }),
        " Volver"
      ] }),
      /* @__PURE__ */ jsx7("code", { className: "rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground", children: feedback?.ticket_code ?? "\u2014" }),
      /* @__PURE__ */ jsx7("span", { className: "truncate font-semibold text-sm", children: feedback?.title ?? "Iter session" }),
      maxTurns > 0 ? /* @__PURE__ */ jsxs6(Badge, { variant: "outline", className: "ml-auto shrink-0 text-[10px] uppercase tracking-wide", children: [
        "Round ",
        Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns),
        " / ",
        maxTurns
      ] }) : null,
      isComplete ? /* @__PURE__ */ jsx7(Badge, { className: "shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 text-[10px] uppercase tracking-wide", children: "Spec ready" }) : null
    ] }),
    session.error ? /* @__PURE__ */ jsxs6("div", { className: "rounded border border-destructive/60 bg-destructive/10 p-2 text-[11px] text-destructive", children: [
      /* @__PURE__ */ jsx7("strong", { className: "font-semibold", children: "Couldn't load this session." }),
      " ",
      String(session.error.message ?? session.error)
    ] }) : null,
    /* @__PURE__ */ jsx7(IterContextPanel, { feedback, defaultOpen: !sess?.current_iteration_id }),
    isComplete && sess?.completion_reason ? /* @__PURE__ */ jsxs6("p", { className: "rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900", children: [
      /* @__PURE__ */ jsx7("strong", { className: "font-semibold", children: "Why ready: " }),
      sess.completion_reason
    ] }) : null,
    /* @__PURE__ */ jsxs6("div", { className: "flex flex-1 min-h-0 flex-col lg:flex-row gap-3", children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex flex-1 min-w-0 flex-col gap-3 overflow-hidden", children: [
        focused ? /* @__PURE__ */ jsxs6("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx7(
            AssumptionCard,
            {
              assumption: focused,
              disabled: status === "finalized" || status === "abandoned",
              onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: focused.id, body }),
              onSkip: () => handleSkip(focused)
            }
          ),
          remainingOpen.length > 0 ? /* @__PURE__ */ jsxs6("details", { className: "rounded border border-input bg-muted/30 p-2 text-xs", children: [
            /* @__PURE__ */ jsxs6("summary", { className: "cursor-pointer font-medium select-none", children: [
              "More to review (",
              remainingOpen.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx7("div", { className: "mt-2 space-y-2", children: remainingOpen.map((a) => /* @__PURE__ */ jsx7(
              AssumptionCard,
              {
                assumption: a,
                disabled: status === "finalized" || status === "abandoned",
                onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: a.id, body }),
                onSkip: () => handleSkip(a)
              },
              a.id
            )) })
          ] }) : null
        ] }) : status !== "finalized" && status !== "abandoned" ? /* @__PURE__ */ jsx7("p", { className: "rounded border border-input bg-muted/30 p-3 text-xs text-muted-foreground", children: (versions.data?.length ?? 0) > 0 ? "All assumptions on this round are resolved. Run another iteration to refresh the spec, or mark it ready if you're happy with it." : "Run the first iteration to see the AI's draft and any assumptions it needs you to confirm." }) : null,
        /* @__PURE__ */ jsx7("div", { className: "flex-1 min-h-0 overflow-auto", children: isStreaming ? /* @__PURE__ */ jsx7(StreamingSkeleton, { activeSection: stream.state.activeSection, modelHint }) : renderedMarkdown ? /* @__PURE__ */ jsx7(RenderedMarkdown, { markdown: renderedMarkdown }) : /* @__PURE__ */ jsx7("div", { className: "rounded border border-input bg-muted/30 p-3 text-xs text-muted-foreground", children: "The spec document will appear here once you run the first iteration." }) })
      ] }),
      /* @__PURE__ */ jsx7("aside", { className: "lg:w-60 lg:shrink-0", children: /* @__PURE__ */ jsxs6("details", { className: "rounded-md border border-input bg-card text-xs", children: [
        /* @__PURE__ */ jsxs6("summary", { className: "cursor-pointer px-2 py-1.5 font-medium select-none flex items-center gap-2", children: [
          /* @__PURE__ */ jsx7("span", { children: "Resueltas" }),
          /* @__PURE__ */ jsx7("span", { className: "rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900", children: otherAssumptions.length })
        ] }),
        /* @__PURE__ */ jsx7("div", { className: "border-t border-input p-2 space-y-2 max-h-72 overflow-auto", children: otherAssumptions.length === 0 ? /* @__PURE__ */ jsx7("p", { className: "text-[11px] text-muted-foreground italic", children: "Nada resuelto todav\xEDa." }) : otherAssumptions.map((a) => /* @__PURE__ */ jsxs6(
          "div",
          {
            className: "rounded border border-input bg-background p-1.5 text-[11px]",
            children: [
              /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1", children: [
                /* @__PURE__ */ jsx7("span", { "aria-hidden": "true", children: a.status === "confirmed" ? "\u2705" : a.status === "corrected" ? "\u270F\uFE0F" : "\u2014" }),
                /* @__PURE__ */ jsx7("code", { className: "truncate font-mono text-[10px] text-muted-foreground", children: a.slot_key })
              ] }),
              /* @__PURE__ */ jsx7("p", { className: "mt-0.5 leading-snug line-clamp-2", children: a.statement })
            ]
          },
          a.id
        )) })
      ] }) })
    ] }),
    (stream.state.errorMessage || streamBudgetExhausted) && stream.state.status === "error" ? /* @__PURE__ */ jsx7("div", { className: "rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900", children: streamBudgetExhausted ? "Has usado todas las rondas para este spec. Marca como listo o abandona la sesi\xF3n." : stream.state.errorMessage }) : null,
    status === "finalized" && pkgQuery.data?.presigned_zip_url ? /* @__PURE__ */ jsxs6("div", { className: "rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-2", children: [
      /* @__PURE__ */ jsx7("p", { className: "font-semibold", children: "Spec finalized \u2014 your package is ready." }),
      /* @__PURE__ */ jsx7(
        "a",
        {
          href: pkgQuery.data.presigned_zip_url,
          download: true,
          className: "inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-white text-[11px] font-semibold hover:bg-emerald-700",
          children: "\u2B07 Download package ZIP"
        }
      ),
      /* @__PURE__ */ jsx7("p", { className: "text-[10px] text-emerald-800/80", children: "You can also re-download anytime from the ticket card after returning to the feed." })
    ] }) : null,
    status !== "finalized" && status !== "abandoned" ? /* @__PURE__ */ jsxs6("footer", { className: "space-y-2 border-t border-input pt-3", children: [
      !turnBudgetSpent && !isComplete ? /* @__PURE__ */ jsx7(
        Textarea,
        {
          value: msg,
          onChange: (e) => setMsg(e.target.value),
          placeholder: "Optional: anything else for the next iteration?",
          rows: 2,
          disabled: isStreaming
        }
      ) : null,
      /* @__PURE__ */ jsxs6("div", { className: "flex flex-wrap items-center gap-2", children: [
        !turnBudgetSpent && !isComplete ? /* @__PURE__ */ jsx7(
          Button,
          {
            size: "sm",
            disabled: isStreaming || openAssumptions.length > 0,
            onClick: () => {
              stream.start({ user_message: msg, restructure_allowed: false });
              setMsg("");
            },
            title: openAssumptions.length > 0 ? "Resolve the open assumption(s) first" : "Run the next iteration",
            children: isStreaming ? /* @__PURE__ */ jsxs6(Fragment2, { children: [
              /* @__PURE__ */ jsx7(Loader22, { className: "h-3.5 w-3.5 animate-spin" }),
              " Running\u2026"
            ] }) : "Run iteration"
          }
        ) : null,
        /* @__PURE__ */ jsx7(
          Button,
          {
            size: "sm",
            variant: turnBudgetSpent || isComplete ? "default" : "secondary",
            onClick: onMarkReady,
            disabled: !sess?.current_iteration_id || finalizeMutation.isPending || isStreaming,
            title: "Finalize the spec and produce the developer package",
            children: finalizeMutation.isPending ? "Marking ready\u2026" : "Mark ready"
          }
        ),
        /* @__PURE__ */ jsx7(
          Button,
          {
            size: "sm",
            variant: "ghost",
            onClick: () => abandonMutation.mutate(),
            disabled: abandonMutation.isPending || isStreaming,
            className: "ml-auto text-muted-foreground",
            title: "Discard this iter session permanently",
            children: "Abandon"
          }
        )
      ] })
    ] }) : null
  ] });
}

// src/Canvas.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function statusVariant(s) {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}
function humanStatus(s) {
  switch (s) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Closed (won't fix)";
    default:
      return s;
  }
}
function Canvas({
  locked,
  onActivatePicker,
  onClearLocked,
  onFocusChange
}) {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const config = useFeedbackConfig();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);
  const [expandedId, setExpandedId] = useState6(null);
  const [iterByFeedback, setIterByFeedback] = useState6({});
  const [iterStartingId, setIterStartingId] = useState6(null);
  const [iterError, setIterError] = useState6(null);
  const [focusedFeedbackId, setFocusedFeedbackId] = useState6(null);
  const [tab, setTab] = useState6("compose");
  const cardRefs = useRef3({});
  const openIter = useCallback(
    async (feedbackId) => {
      setIterStartingId(feedbackId);
      setIterError(null);
      try {
        const session = await startIterSession(bindings, { feedback_id: feedbackId });
        setIterByFeedback((prev) => ({ ...prev, [feedbackId]: session.id }));
        setExpandedId(feedbackId);
        if (config.iterStyle === "focus") {
          setFocusedFeedbackId(feedbackId);
        }
      } catch (err) {
        const e = err;
        setIterError(e.detail ?? e.message ?? String(err));
      } finally {
        setIterStartingId(null);
      }
    },
    [bindings, config.iterStyle]
  );
  const handleSubmitted = useCallback(
    (feedbackId, opts) => {
      void query.refetch();
      setExpandedId(feedbackId);
      setTab("mine");
      setTimeout(() => {
        cardRefs.current[feedbackId]?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 250);
      if (opts.thenIterate) {
        void openIter(feedbackId);
      }
    },
    [openIter, query]
  );
  useEffect5(() => {
    const known = new Set((query.data ?? []).map((r) => r.id));
    setIterByFeedback((prev) => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) if (known.has(k)) next[k] = v;
      return next;
    });
  }, [query.data]);
  useEffect5(() => {
    onFocusChange?.(focusedFeedbackId !== null);
  }, [focusedFeedbackId, onFocusChange]);
  if (focusedFeedbackId && iterByFeedback[focusedFeedbackId]) {
    return /* @__PURE__ */ jsx8("div", { className: "h-full", children: /* @__PURE__ */ jsx8(
      IterFocusView,
      {
        sessionId: iterByFeedback[focusedFeedbackId] ?? "",
        feedbackId: focusedFeedbackId,
        onExit: () => setFocusedFeedbackId(null)
      }
    ) });
  }
  const minePendingCount = (query.data ?? []).filter((r) => r.status === "done").length;
  const mineTotalCount = (query.data ?? []).length;
  return /* @__PURE__ */ jsxs7("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxs7(
      "div",
      {
        className: "grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium",
        role: "tablist",
        children: [
          /* @__PURE__ */ jsx8(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": tab === "compose",
              onClick: () => setTab("compose"),
              className: `px-3 py-1.5 rounded transition-colors ${tab === "compose" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
              "data-feedback-id": "feedback.tab.compose",
              children: "\u270E Nuevo feedback"
            }
          ),
          /* @__PURE__ */ jsxs7(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": tab === "mine",
              onClick: () => setTab("mine"),
              className: `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${tab === "mine" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
              "data-feedback-id": "feedback.tab.mine",
              children: [
                /* @__PURE__ */ jsx8("span", { children: "\u{1F4CB} Mis feedbacks" }),
                mineTotalCount > 0 ? /* @__PURE__ */ jsx8(
                  "span",
                  {
                    className: `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${minePendingCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"}`,
                    title: minePendingCount > 0 ? `${minePendingCount} con respuesta del equipo` : `${mineTotalCount} en total`,
                    children: minePendingCount > 0 ? minePendingCount : mineTotalCount
                  }
                ) : null
              ]
            }
          )
        ]
      }
    ),
    tab === "compose" ? /* @__PURE__ */ jsx8(
      Compose,
      {
        locked,
        onActivatePicker,
        onClearLocked,
        onSubmitted: handleSubmitted
      }
    ) : query.isLoading ? /* @__PURE__ */ jsx8("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.loading") }) : query.isError ? /* @__PURE__ */ jsx8("p", { className: "text-sm text-destructive", children: t("feedback.mine.error") }) : (query.data ?? []).length === 0 ? /* @__PURE__ */ jsx8("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.empty") }) : /* @__PURE__ */ jsx8("ul", { className: "space-y-2", children: (query.data ?? []).map((r) => {
      const recentlyResolved = r.status === "done";
      const isOpen = expandedId === r.id;
      const iterSessionId = iterByFeedback[r.id] ?? null;
      return /* @__PURE__ */ jsx8(
        "li",
        {
          ref: (el) => {
            cardRefs.current[r.id] = el;
          },
          children: /* @__PURE__ */ jsxs7(
            "div",
            {
              className: `rounded-md border ${recentlyResolved ? "border-primary bg-primary/5" : "border-input"}`,
              children: [
                /* @__PURE__ */ jsxs7("div", { className: "w-full p-2 text-sm flex flex-col gap-1 hover:bg-accent rounded-md", children: [
                  /* @__PURE__ */ jsxs7("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxs7(
                      "button",
                      {
                        type: "button",
                        onClick: () => setExpandedId(isOpen ? null : r.id),
                        className: "flex flex-1 items-center gap-2 text-left",
                        "aria-expanded": isOpen,
                        "aria-controls": `ticket-detail-${r.id}`,
                        "data-feedback-id": "feedback.canvas.row",
                        children: [
                          /* @__PURE__ */ jsx8("code", { className: "font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0", children: r.ticket_code || "\u2014" }),
                          /* @__PURE__ */ jsx8(Badge, { variant: statusVariant(r.status), className: "shrink-0", children: humanStatus(r.status) }),
                          /* @__PURE__ */ jsx8("span", { className: "truncate flex-1 font-medium", children: r.title }),
                          isOpen ? /* @__PURE__ */ jsx8(ChevronUp, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx8(ChevronDown2, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" })
                        ]
                      }
                    ),
                    !iterSessionId && /* @__PURE__ */ jsxs7(
                      Button,
                      {
                        type: "button",
                        size: "sm",
                        variant: "default",
                        onClick: (e) => {
                          e.stopPropagation();
                          void openIter(r.id);
                        },
                        disabled: iterStartingId === r.id,
                        className: "shrink-0",
                        "data-feedback-id": "feedback.canvas.iterate",
                        title: "Iterate with AI",
                        children: [
                          /* @__PURE__ */ jsx8(Sparkles2, { className: "h-3.5 w-3.5" }),
                          iterStartingId === r.id ? "Opening\u2026" : "Iterate"
                        ]
                      }
                    )
                  ] }),
                  recentlyResolved && !isOpen ? /* @__PURE__ */ jsx8("span", { className: "text-[11px] text-primary", children: t("feedback.mine.action_hint") }) : null
                ] }),
                isOpen ? /* @__PURE__ */ jsxs7(
                  "div",
                  {
                    id: `ticket-detail-${r.id}`,
                    className: "border-t border-input px-3 py-3 space-y-3 text-xs",
                    children: [
                      r.created_at ? /* @__PURE__ */ jsx8("p", { className: "text-muted-foreground", children: t("feedback.mine.submitted_at", {
                        date: r.created_at.slice(0, 16).replace("T", " ")
                      }) }) : null,
                      /* @__PURE__ */ jsxs7("section", { children: [
                        /* @__PURE__ */ jsx8("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.field.description") }),
                        /* @__PURE__ */ jsx8("p", { className: "whitespace-pre-wrap", children: r.description || /* @__PURE__ */ jsx8("span", { className: "italic text-muted-foreground", children: t("feedback.mine.no_description") }) })
                      ] }),
                      r.expected_outcome ? /* @__PURE__ */ jsxs7("section", { children: [
                        /* @__PURE__ */ jsx8("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.field.expected_outcome") }),
                        /* @__PURE__ */ jsx8("p", { className: "whitespace-pre-wrap", children: r.expected_outcome })
                      ] }) : null,
                      r.triage_note ? /* @__PURE__ */ jsxs7("section", { className: "rounded bg-muted/50 p-2", children: [
                        /* @__PURE__ */ jsx8("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.mine.triage_note") }),
                        /* @__PURE__ */ jsx8("p", { className: "whitespace-pre-wrap", children: r.triage_note })
                      ] }) : null,
                      r.attachments && r.attachments.length > 0 ? /* @__PURE__ */ jsxs7("section", { children: [
                        /* @__PURE__ */ jsx8("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.mine.attachments", {
                          count: String(r.attachments.length)
                        }) }),
                        /* @__PURE__ */ jsx8("ul", { className: "space-y-1.5", children: r.attachments.map((a) => {
                          const isImage = a.content_type.startsWith("image/");
                          const label = a.filename ?? a.kind;
                          return /* @__PURE__ */ jsxs7(
                            "li",
                            {
                              className: "flex items-center gap-2 rounded border border-input bg-background p-1.5",
                              children: [
                                isImage && a.presigned_url ? /* @__PURE__ */ jsx8(
                                  "a",
                                  {
                                    href: a.presigned_url,
                                    target: "_blank",
                                    rel: "noreferrer",
                                    className: "shrink-0",
                                    children: /* @__PURE__ */ jsx8(
                                      "img",
                                      {
                                        src: a.presigned_url,
                                        alt: label,
                                        className: "h-10 w-10 rounded object-cover",
                                        loading: "lazy"
                                      }
                                    )
                                  }
                                ) : null,
                                /* @__PURE__ */ jsx8("span", { className: "flex-1 truncate font-mono", children: label }),
                                /* @__PURE__ */ jsxs7("span", { className: "text-muted-foreground shrink-0", children: [
                                  (a.byte_size / 1024).toFixed(1),
                                  " KB"
                                ] }),
                                a.presigned_url ? /* @__PURE__ */ jsx8(
                                  "a",
                                  {
                                    href: a.presigned_url,
                                    target: "_blank",
                                    rel: "noreferrer",
                                    className: "shrink-0 text-primary hover:underline",
                                    children: t("feedback.mine.open")
                                  }
                                ) : null
                              ]
                            },
                            a.id
                          );
                        }) })
                      ] }) : null,
                      /* @__PURE__ */ jsx8(CommentThread, { feedbackId: r.id }),
                      iterSessionId && config.iterStyle === "inline" ? /* @__PURE__ */ jsx8(
                        InlineIterPane,
                        {
                          sessionId: iterSessionId,
                          onClose: () => {
                            setIterByFeedback((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            });
                          }
                        }
                      ) : iterSessionId && config.iterStyle === "focus" ? /* @__PURE__ */ jsxs7(
                        Button,
                        {
                          size: "sm",
                          onClick: () => setFocusedFeedbackId(r.id),
                          "data-feedback-id": "feedback.canvas.resume-focus",
                          children: [
                            /* @__PURE__ */ jsx8(Sparkles2, { className: "h-3.5 w-3.5" }),
                            " Resume iter"
                          ]
                        }
                      ) : /* @__PURE__ */ jsxs7(
                        Button,
                        {
                          size: "sm",
                          onClick: () => openIter(r.id),
                          disabled: iterStartingId === r.id,
                          "data-feedback-id": "feedback.canvas.iterate-inline",
                          children: [
                            /* @__PURE__ */ jsx8(Sparkles2, { className: "h-3.5 w-3.5" }),
                            iterStartingId === r.id ? "Opening\u2026" : "Iterate with AI"
                          ]
                        }
                      ),
                      iterError && iterStartingId === null ? /* @__PURE__ */ jsx8("p", { className: "text-xs text-destructive", children: iterError }) : null
                    ]
                  }
                ) : null
              ]
            }
          )
        },
        r.id
      );
    }) })
  ] });
}

// src/FeedbackPanel.tsx
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var _FEED_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-[560px]";
var _FOCUS_WIDTH = "w-full sm:max-w-lg md:max-w-2xl lg:max-w-[720px] xl:max-w-[800px]";
function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [isFocused, setIsFocused] = useState7(false);
  const widthClass = isFocused ? _FOCUS_WIDTH : _FEED_WIDTH;
  return /* @__PURE__ */ jsx9(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs8(
    SheetContent,
    {
      side: "right",
      className: `${widthClass} overflow-y-auto transition-[max-width] duration-200`,
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs8(SheetHeader, { children: [
          /* @__PURE__ */ jsxs8(SheetTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx9(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx9("span", { children: t("feedback.panel_title") })
          ] }),
          !isFocused ? /* @__PURE__ */ jsx9(SheetDescription, { children: t("feedback.panel_description") }) : null
        ] }),
        /* @__PURE__ */ jsxs8("div", { className: "px-4 mt-4 flex-1 min-h-0", children: [
          /* @__PURE__ */ jsx9(
            Canvas,
            {
              locked,
              onActivatePicker,
              onClearLocked,
              onFocusChange: setIsFocused
            }
          ),
          !isFocused ? /* @__PURE__ */ jsxs8(
            "a",
            {
              href: "https://rl3.dev",
              target: "_blank",
              rel: "noreferrer",
              className: "mt-4 flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
              "aria-label": t("feedback.powered_by_aria"),
              children: [
                /* @__PURE__ */ jsx9(Rl3Mark, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsxs8("span", { children: [
                  t("feedback.powered_by"),
                  " ",
                  /* @__PURE__ */ jsx9("strong", { className: "font-semibold", children: "RL3" })
                ] })
              ]
            }
          ) : null
        ] }),
        !isFocused ? /* @__PURE__ */ jsx9(SheetFooter, { className: "mt-4", children: /* @__PURE__ */ jsx9(
          Button,
          {
            variant: "outline",
            onClick: () => onOpenChange(false),
            "data-feedback-id": "feedback.cancel",
            children: t("feedback.cancel")
          }
        ) }) : null
      ]
    }
  ) });
}
var FeedbackPanel_default = FeedbackPanel;
export {
  FeedbackPanel,
  FeedbackPanel_default as default
};
//# sourceMappingURL=FeedbackPanel-33HKWF4F.js.map